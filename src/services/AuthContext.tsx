import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config/api.ts';
import { 
  IcuUser, 
  StaffRole, 
  UserPermissions 
} from '../types/schema.ts';
import { 
  auth, 
  googleProvider, 
  checkIfAnyAdminExists, 
  registerInitialSuperAdminWithFirebaseAuth,
  saveUserAccount,
  createSecondaryAuthUser,
  deleteUserAccount,
  fetchAllUsers,
  getDefaultPermissionsForRole,
  testFirestoreConnection,
  syncAdminAccountToFirebaseConsole,
  getFirebaseAuthErrorMessage,
  firestore,
  setDoc
} from './firebase.ts';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  User as FirebaseUser 
} from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../db/icuSyncDb.ts';

interface AuthContextType {
  currentUser: IcuUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsInitialAdminSetup: boolean;
  allUsers: IcuUser[];
  loginWithEmailOrBadge: (identifier: string, pinOrPass: string) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  quickDemoLogin: (role: StaffRole) => Promise<void>;
  registerFirstUser: (data: {
    username: string;
    password: string;
    fullName: string;
    jobTitle: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  createUser: (user: Partial<IcuUser>) => Promise<{ success: boolean; message?: string }>;
  updateUser: (user: IcuUser) => Promise<{ success: boolean; message?: string }>;
  changeUserPassword: (uid: string, newPassword: string, confirmPassword?: string) => Promise<{ success: boolean; message?: string }>;
  changeMyOwnPassword: (oldPassword: string, newPassword: string, confirmPassword?: string) => Promise<{ success: boolean; message?: string }>;
  toggleUserStatus: (uid: string) => Promise<void>;
  deleteUser: (uid: string) => Promise<{ success: boolean; message?: string }>;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<IcuUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [needsInitialAdminSetup, setNeedsInitialAdminSetup] = useState<boolean>(false);
  const [allUsers, setAllUsers] = useState<IcuUser[]>([]);

  // Initialize Auth & Check for Super Admin setup
  const checkInitialSetup = useCallback(async () => {
    try {
      const [remoteUsers, hasAdmin] = await Promise.all([
        fetchAllUsers().catch(() => [] as IcuUser[]),
        checkIfAnyAdminExists().catch(() => false)
      ]);

      // Deduplicate strictly by uid
      const uniqueRemote: IcuUser[] = [];
      const seenRemote = new Set<string>();
      for (const u of remoteUsers) {
        if (u && u.uid && !seenRemote.has(u.uid)) {
          seenRemote.add(u.uid);
          uniqueRemote.push(u);
        }
      }

      setAllUsers(uniqueRemote);
      setNeedsInitialAdminSetup(!hasAdmin && uniqueRemote.length === 0);
    } catch (e) {
      console.warn('Auth initial check notice:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkInitialSetup();

    // Firebase Auth state listener (Sole SSOT)
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.uid) {
        try {
          // 1. Fetch user directly from Firestore users/{uid}
          const userDocRef = doc(firestore, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);
          
          let resolvedUser: IcuUser | null = null;
          if (userSnap.exists()) {
            resolvedUser = userSnap.data() as IcuUser;
          }

          if (resolvedUser && resolvedUser.isActive !== false && resolvedUser.active !== false) {
            resolvedUser.uid = fbUser.uid;
            setCurrentUser(resolvedUser);
            localStorage.setItem('soli_icu_active_user', JSON.stringify(resolvedUser));
            // Keep local Dexie cache synchronized with Firestore SSOT
            await db.users.put(resolvedUser);
          } else {
            // User deleted, non-existent, or deactivated in Firestore
            await firebaseSignOut(auth);
            setCurrentUser(null);
            localStorage.removeItem('soli_icu_active_user');
          }
        } catch (e) {
          console.warn('Auth state verification error:', e);
          setCurrentUser(null);
          localStorage.removeItem('soli_icu_active_user');
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('soli_icu_active_user');
      }
      setIsLoading(false);
    });

    // Real-Time Cloud Firestore user subscription
    const usersCol = collection(firestore, 'users');
    const unsubscribeUsers = onSnapshot(usersCol, async (snapshot) => {
      const remoteUsers: IcuUser[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as IcuUser;
        if (d && d.uid) {
          remoteUsers.push(d);
        }
      });
      
      const uniqueUsers: IcuUser[] = [];
      const seen = new Set<string>();

      for (const u of remoteUsers) {
        if (u && u.uid && !seen.has(u.uid)) {
          seen.add(u.uid);
          uniqueUsers.push(u);
        }
      }

      setAllUsers(uniqueUsers);
      await db.users.clear();
      await db.users.bulkPut(uniqueUsers);

      // Verify active user status in real time
      if (auth.currentUser) {
        const activeUid = auth.currentUser.uid;
        const currentInCloud = uniqueUsers.find(u => u.uid === activeUid || (auth.currentUser?.email && u.email?.toLowerCase() === auth.currentUser.email.toLowerCase()));
        if (!currentInCloud || currentInCloud.isActive === false || currentInCloud.active === false) {
          await firebaseSignOut(auth);
          setCurrentUser(null);
          localStorage.removeItem('soli_icu_active_user');
        } else {
          setCurrentUser(currentInCloud);
          localStorage.setItem('soli_icu_active_user', JSON.stringify(currentInCloud));
        }
      }
    }, (err) => {
      console.warn('Real-time users subscription warning:', err);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, [checkInitialSetup]);

  const refreshUsers = useCallback(async () => {
    const users = await fetchAllUsers();
    setAllUsers(users);
  }, []);

  // Quick Demo Login (Disabled per security policy)
  const quickDemoLogin = async (_role: StaffRole) => {
    console.warn('Quick Demo Login is disabled. Firebase Authentication is the sole source of truth.');
  };

  // Register First User (Super Admin Setup Screen)
  const registerFirstUser = async (data: {
    username: string;
    password: string;
    fullName: string;
    jobTitle: string;
  }): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    const res = await registerInitialSuperAdminWithFirebaseAuth(data);
    setIsLoading(false);
    if (res.success) {
      setNeedsInitialAdminSetup(false);
      await refreshUsers();
    }
    return res;
  };

  // Login with Username / Email / Badge ID + Password (Firebase Auth SSOT)
  const loginWithEmailOrBadge = async (
    identifier: string, 
    pinOrPass: string
  ): Promise<{ success: boolean; message?: string }> => {
    const rawInput = identifier.trim();
    const rawPass = pinOrPass.trim();

    if (!rawInput || !rawPass) {
      return { success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' };
    }

    // 1. Resolve Target Email for Firebase Authentication
    let targetEmail = '';
    
    if (rawInput.includes('@')) {
      targetEmail = rawInput.toLowerCase();
    } else {
      // Search Firestore for the user record by badgeId, username, or email
      try {
        const inputLower = rawInput.toLowerCase();
        // Check in-memory allUsers list first
        const foundInList = allUsers.find(u => 
          (u.badgeId && u.badgeId.toLowerCase() === inputLower) ||
          (u.email && u.email.toLowerCase().startsWith(inputLower + '@')) ||
          (u.uid && u.uid.toLowerCase() === inputLower) ||
          (u.nameEn && u.nameEn.toLowerCase() === inputLower) ||
          (u.nameAr && u.nameAr === rawInput)
        );

        if (foundInList && foundInList.email) {
          targetEmail = foundInList.email.toLowerCase();
        } else {
          // Direct Firestore query
          const allDocsSnap = await getDocs(collection(firestore, 'users'));
          for (const d of allDocsSnap.docs) {
            const uData = d.data() as IcuUser;
            const uEmail = (uData.email || '').toLowerCase();
            const uBadge = (uData.badgeId || '').toLowerCase();
            const uName = (uData.nameEn || '').toLowerCase();
            const uNameAr = (uData.nameAr || '');
            if (
              uEmail === inputLower || 
              uEmail.startsWith(inputLower + '@') ||
              uBadge === inputLower ||
              uName === inputLower ||
              uNameAr === rawInput ||
              d.id.toLowerCase() === inputLower
            ) {
              targetEmail = uEmail;
              break;
            }
          }
        }
      } catch (queryErr) {
        console.warn('Firestore user lookup warning:', queryErr);
      }

      if (!targetEmail) {
        // Construct standard domain for username input
        const cleanUsername = rawInput.toLowerCase().replace(/\s+/g, '');
        targetEmail = `${cleanUsername}@solimedical-micu.org`;
      }
    }

    // 2. Authenticate via Firebase Authentication (SOLE Source of Truth)
    let fbUser: FirebaseUser | null = null;
    try {
      const authResult = await signInWithEmailAndPassword(auth, targetEmail, rawPass);
      fbUser = authResult.user;
    } catch (fbAuthErr: any) {
      const errCode = fbAuthErr?.code || '';
      if (errCode === 'auth/user-disabled') {
        return { success: false, message: 'هذا الحساب معطل من قبل الإدارة.' };
      }
      if (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-email') {
        return { success: false, message: 'اسم المستخدم أو البريد الإلكتروني غير مسجل في المنظومة.' };
      }
      if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
        return { success: false, message: 'كلمة المرور غير صحيحة. يرجى التأكد والمحاولة مرة أخرى.' };
      }
      return { success: false, message: fbAuthErr?.message || 'فشل تسجيل الدخول عبر Firebase Authentication.' };
    }

    if (!fbUser) {
      return { success: false, message: 'فشل التحقق من هوية المستخدم في Firebase Auth.' };
    }

    try {
      // 3. Load user record from Firestore users/{uid}
      const userDoc = await getDoc(doc(firestore, 'users', fbUser.uid));

      if (!userDoc.exists()) {
        await firebaseSignOut(auth);
        throw new Error('حساب المستخدم غير موجود في النظام');
      }

      const user = userDoc.data() as IcuUser;

      // 5) الحساب المعطل
      if (user.isActive === false || user.active === false) {
        await firebaseSignOut(auth);
        throw new Error('هذا الحساب غير مفعل');
      }

      // Update last login timestamp and set active user
      user.lastLoginAt = new Date().toISOString();
      user.uid = fbUser.uid;
      
      await setDoc(doc(firestore, 'users', fbUser.uid), { lastLoginAt: user.lastLoginAt }, { merge: true });
      await db.users.put(user);
      
      setCurrentUser(user);
      localStorage.setItem('soli_icu_active_user', JSON.stringify(user));
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'فشل تسجيل الدخول' };
    }
  };

  // Login with Google (Firebase Auth)
  const loginWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      
      let matchedUser: IcuUser | null = null;

      // Fetch from Firestore
      const userDocRef = doc(firestore, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) {
        await firebaseSignOut(auth);
        return { success: false, message: 'حساب Google هذا غير مسجل في منظومة المستشفى.' };
      }
      matchedUser = userSnap.data() as IcuUser;

      if (matchedUser.isActive === false || matchedUser.active === false) {
        await firebaseSignOut(auth);
        return { success: false, message: 'حسابك معطل حالياً من قبل الإدارة.' };
      }

      matchedUser.lastLoginAt = new Date().toISOString();
      matchedUser.uid = fbUser.uid;
      
      await setDoc(doc(firestore, 'users', fbUser.uid), { lastLoginAt: matchedUser.lastLoginAt }, { merge: true });
      await db.users.put(matchedUser);
      
      setCurrentUser(matchedUser);
      localStorage.setItem('soli_icu_active_user', JSON.stringify(matchedUser));
      return { success: true };
    } catch (err: any) {
      console.warn('Google Sign-in error:', err);
      return { success: false, message: err?.message || 'فشل تسجيل الدخول عبر Google' };
    }
  };

  // Create User
  const createUser = async (userData: Partial<IcuUser>): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser?.permissions.canManageUsers && !currentUser?.isSuperAdmin) {
      return { success: false, message: 'ليس لديك صلاحية لإضافة مستخدمين جدد (Permission Denied)' };
    }

    const role = userData.role || StaffRole.BEDSIDE_RN;
    const rawEmail = userData.email || `staff_${Date.now()}@solimedical-micu.org`;
    const email = rawEmail.includes('@') ? rawEmail.toLowerCase() : `${rawEmail.toLowerCase()}@solimedical-micu.org`;
    const password = userData.pinCode || '123456';

    if (password.length < 6) {
      return { success: false, message: 'كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام (auth/weak-password).' };
    }

    try {
      // 1. Create user in Firebase Authentication via isolated secondary instance
      // This strictly prevents the logged-in Admin from being signed out
      let uid: string | undefined;

      try {
        uid = await createSecondaryAuthUser(email, password);
      } catch (secErr) {
        console.warn('Secondary auth creation error, attempting backend API proxy:', secErr);
        // Try backend admin endpoint if available
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const res = await fetch(`${API_BASE_URL}/api/admin/users/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': idToken ? `Bearer ${idToken}` : ''
          },
          body: JSON.stringify({
            email,
            password,
            pinCode: password,
            nameEn: userData.nameEn,
            nameAr: userData.nameAr,
            role,
            department: userData.department,
            badgeId: userData.badgeId,
            licenseNumber: userData.licenseNumber,
            permissions: userData.permissions || getDefaultPermissionsForRole(role as StaffRole),
            active: userData.isActive ?? true
          })
        }).catch(() => null);

        if (res && res.ok) {
          const apiData = await res.json().catch(() => ({}));
          if (apiData?.user?.uid) {
            uid = apiData.user.uid;
          }
        }

        if (!uid) {
          throw secErr;
        }
      }

      const now = new Date().toISOString();

      const newUser: IcuUser = {
        uid,
        email,
        nameEn: userData.nameEn || 'Clinical Staff',
        nameAr: userData.nameAr || 'كادر سريري',
        role: role,
        department: userData.department || 'MICU',
        badgeId: userData.badgeId || `ID-${Math.floor(100 + Math.random() * 900)}`,
        licenseNumber: userData.licenseNumber || `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
        isActive: userData.isActive ?? true,
        isSuperAdmin: role === StaffRole.ADMIN,
        pinCode: password,
        createdAt: now,
        lastLoginAt: now,
        permissions: userData.permissions || getDefaultPermissionsForRole(role as StaffRole),
      };

      // 2. Save to Firestore and Dexie SSOT
      await saveUserAccount(newUser);
      await refreshUsers();
      return { success: true };
    } catch (err: any) {
      console.error('User creation failed:', err);
      const errorMessage = getFirebaseAuthErrorMessage(err);
      return { success: false, message: errorMessage };
    }
  };

  // Update User
  const updateUser = async (user: IcuUser): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser?.permissions.canManageUsers && !currentUser?.isSuperAdmin && currentUser?.uid !== user.uid) {
      return { success: false, message: 'ليس لديك صلاحية لتعديل بيانات هذا المستخدم (Permission Denied)' };
    }

    await saveUserAccount(user);
    if (currentUser?.uid === user.uid) {
      setCurrentUser(user);
      localStorage.setItem('soli_icu_active_user', JSON.stringify(user));
    }
    await refreshUsers();
    return { success: true };
  };

  // Change password for any user account via Firebase Admin SDK / Cloud Function endpoint (Admin only)
  const changeUserPassword = async (uid: string, newPassword: string, confirmPassword?: string): Promise<{ success: boolean; message?: string }> => {
    const isAdmin = currentUser?.isSuperAdmin || currentUser?.role === StaffRole.ADMIN;
    if (!isAdmin) {
      return { success: false, message: 'صلاحية تغيير كلمة المرور متاحة للمشرف (Admin) فقط (Permission Denied).' };
    }

    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, message: 'كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام (auth/weak-password).' };
    }

    if (confirmPassword !== undefined && newPassword.trim() !== confirmPassword.trim()) {
      return { success: false, message: 'كلمتا المرور غير متطابقتين.' };
    }

    const cleanPass = newPassword.trim();

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        return { success: false, message: 'تعذر الحصول على رمز المصادقة (ID Token).' };
      }
      const response = await fetch(`${API_BASE_URL}/api/admin/users/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ targetUid: uid, newPassword: cleanPass })
      });

      const data = await response.json();
      if (!data.success) {
        return { success: false, message: data.message || 'فشل تحديث كلمة المرور في Firebase Authentication.' };
      }

      await refreshUsers();
      return { success: true, message: 'تم تغيير كلمة المرور بنجاح في Firebase Authentication.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'حدث خطأ أثناء الاتصال بالخادم لتغيير كلمة المرور.' };
    }
  };

  // Change own password for currently logged in user by reauthenticating with old password
  const changeMyOwnPassword = async (oldPassword: string, newPassword: string, confirmPassword?: string): Promise<{ success: boolean; message?: string }> => {
    if (!auth.currentUser || !auth.currentUser.email) {
      return { success: false, message: 'لا يوجد مستخدم مسجل الدخول حالياً.' };
    }
    if (!oldPassword) {
      return { success: false, message: 'يرجى إدخال كلمة المرور القديمة.' };
    }
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, message: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو أرقام (auth/weak-password).' };
    }
    if (confirmPassword !== undefined && newPassword.trim() !== confirmPassword.trim()) {
      return { success: false, message: 'كلمتا المرور غير متطابقتين.' };
    }

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword.trim());

      if (currentUser) {
        const updated = { ...currentUser, pinCode: newPassword.trim() };
        setCurrentUser(updated);
        localStorage.setItem('soli_icu_active_user', JSON.stringify(updated));
        await saveUserAccount(updated);
      }

      await refreshUsers();
      return { success: true, message: 'تم تغيير كلمة المرور بنجاح في النظام.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'كلمة المرور القديمة غير صحيحة أو فشل تحديث كلمة المرور.' };
    }
  };

  // Toggle user status directly in Firestore. Auth token revocation requires a backend.
  const toggleUserStatus = async (uid: string) => {
    const user = allUsers.find(u => u.uid === uid);
    if (!user) return;
    if (user.isSuperAdmin || user.role === StaffRole.ADMIN) return;

    try {
      user.isActive = !user.isActive;
      user.active = user.isActive;
      await saveUserAccount(user);
    } catch (e) {
      console.error('Toggle status failed:', e);
    }
    await refreshUsers();
  };

  // Delete User Account
  const deleteUser = async (uid: string): Promise<{ success: boolean; message?: string }> => {
    const canDelete = currentUser?.isSuperAdmin || 
      currentUser?.role === StaffRole.ADMIN || 
      (currentUser?.permissions as any)?.['users.delete'] || 
      currentUser?.permissions?.canManageUsers;

    if (!canDelete) {
      return { success: false, message: 'ليس لديك صلاحية لحذف المستخدمين (Permission Denied: users.delete)' };
    }
    if (currentUser?.uid === uid) {
      return { success: false, message: 'لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول منه' };
    }

    const target = allUsers.find(u => u.uid === uid);
    if (!target) return { success: false, message: 'المستخدم غير موجود' };

    // Safety check: Prevent deleting last active admin
    if (target.role === StaffRole.ADMIN || target.isSuperAdmin) {
      const activeAdmins = allUsers.filter(u => (u.role === StaffRole.ADMIN || u.isSuperAdmin) && u.isActive !== false);
      if (activeAdmins.length <= 1) {
        return { success: false, message: 'إجراء أمني حرج: لا يمكن حذف آخر مدير نظام نشط في المنظومة.' };
      }
    }

    try {
      let backendAuthDeleted = false;
      const idToken = await auth.currentUser?.getIdToken(true).catch(() => null);

      if (idToken) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/admin/users/delete`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                targetUid: uid
              })
            }
          );

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            if (data.success) {
              backendAuthDeleted = true;
            }
          } else {
            console.warn(`[deleteUser] Backend returned status ${response.status}. Falling back to Firestore & Dexie deletion.`);
          }
        } catch (apiErr) {
          console.warn('[deleteUser] Backend delete API unreachable, falling back to direct Firestore deletion:', apiErr);
        }
      }

      // Always delete user document from Firestore & Dexie SSOT
      await deleteUserAccount(uid);
      await refreshUsers();

      return {
        success: true,
        message: backendAuthDeleted
          ? 'تم حذف المستخدم نهائيًا من خادم الحسابات وقاعدة البيانات.'
          : 'تم حذف المستخدم وسجلاته من قاعدة بيانات المنظومة بنجاح.'
      };
    } catch (e: any) {
      return { 
        success: false, 
        message: e?.message || 'فشل حذف الحساب.' 
      };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    setCurrentUser(null);
    localStorage.removeItem('soli_icu_active_user');
  };

  // Comprehensive Permission Checking Engine
  const hasPermission = (permission: string | keyof UserPermissions): boolean => {
    if (!currentUser) return false;
    if (currentUser.isSuperAdmin || currentUser.role === StaffRole.ADMIN || (currentUser.role as any) === 'ADMIN') return true;
    
    if (currentUser.permissions && (currentUser.permissions as any)[permission] !== undefined) {
      return !!(currentUser.permissions as any)[permission];
    }

    const legacyMap: Record<string, keyof UserPermissions> = {
      'users.view': 'canManageUsers',
      'users.create': 'canManageUsers',
      'users.update': 'canManageUsers',
      'users.disable': 'canManageUsers',
      'users.delete': 'canManageUsers',
      'patients.view': 'canAdmitPatient',
      'patients.create': 'canAdmitPatient',
      'patients.update': 'canAdmitPatient',
      'clinicalNotes.create': 'canWriteNotes',
      'clinicalNotes.update': 'canWriteNotes',
      'sbar.create': 'canSignSbar',
      'sbar.update': 'canSignSbar',
      'vitals.create': 'canEditVitals',
      'vitals.update': 'canEditVitals',
      'labs.create': 'canManageLabs',
      'labs.update': 'canManageLabs',
      'investigations.create': 'canManageLabs',
      'investigations.update': 'canManageLabs',
      'transfer.create': 'canTransferPatient',
      'bedSwap.create': 'canTransferPatient',
      'discharge.create': 'canDischargePatient',
      'settings.view': 'canConfigureSettings',
      'settings.update': 'canConfigureSettings',
      'sections.create': 'canConfigureSettings',
      'sections.update': 'canConfigureSettings',
      'sections.delete': 'canConfigureSettings',
      'cards.create': 'canConfigureSettings',
      'cards.update': 'canConfigureSettings',
      'cards.delete': 'canConfigureSettings',
      'chat.view': 'canWriteNotes',
      'chat.create': 'canWriteNotes',
    };

    const mappedKey = legacyMap[permission as string];
    if (mappedKey && currentUser.permissions) {
      return !!currentUser.permissions[mappedKey];
    }

    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        isLoading,
        needsInitialAdminSetup,
        allUsers,
        loginWithEmailOrBadge,
        loginWithGoogle,
        quickDemoLogin,
        registerFirstUser,
        logout,
        createUser,
        updateUser,
        changeUserPassword,
        toggleUserStatus,
        deleteUser,
        hasPermission,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
