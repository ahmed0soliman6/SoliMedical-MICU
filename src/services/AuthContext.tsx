import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  IcuUser, 
  StaffRole, 
  UserPermissions 
} from '../types/schema.ts';
import { 
  auth, 
  googleProvider, 
  checkIfAnyAdminExists, 
  registerInitialSuperAdmin, 
  registerInitialSuperAdminWithFirebaseAuth,
  saveUserAccount,
  deleteUserAccount,
  fetchAllUsers,
  getDefaultPermissionsForRole,
  testFirestoreConnection,
  syncAdminAccountToFirebaseConsole,
  syncUserToFirebaseConsole,
  firestore
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
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
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
  registerSuperAdmin: (data: {
    email: string;
    nameEn: string;
    nameAr: string;
    licenseNumber: string;
    department: string;
    badgeId: string;
    pinCode: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  createUser: (user: Partial<IcuUser>) => Promise<{ success: boolean; message?: string }>;
  updateUser: (user: IcuUser) => Promise<{ success: boolean; message?: string }>;
  changeUserPassword: (uid: string, newPassword: string) => Promise<{ success: boolean; message?: string }>;
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
      // 1. Instant local restore from localStorage & Dexie IndexedDB (< 10ms)
      const savedUserStr = localStorage.getItem('soli_icu_active_user');
      if (savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr) as IcuUser;
          setCurrentUser(savedUser);
        } catch (e) {
          localStorage.removeItem('soli_icu_active_user');
        }
      }

      const localUsers = await db.users.toArray();
      if (localUsers.length > 0) {
        // Strict deduplication by uid
        const uniqueLocal: IcuUser[] = [];
        const seenLocal = new Set<string>();
        for (const u of localUsers) {
          if (u && u.uid && !seenLocal.has(u.uid)) {
            seenLocal.add(u.uid);
            uniqueLocal.push(u);
          }
        }
        setAllUsers(uniqueLocal);
      }
      
      setNeedsInitialAdminSetup(false);
    } catch (e) {
      console.warn('Local auth restore:', e);
    } finally {
      setIsLoading(false);
    }

    // 2. Asynchronous background Cloud Firestore sync (non-blocking)
    Promise.all([
      testFirestoreConnection().catch(() => false),
      fetchAllUsers().catch(() => [])
    ]).then(([_, remoteUsers]) => {
      if (remoteUsers && remoteUsers.length > 0) {
        // Strict deduplication by uid
        const uniqueRemote: IcuUser[] = [];
        const seenRemote = new Set<string>();
        for (const u of remoteUsers) {
          if (u && u.uid && !seenRemote.has(u.uid)) {
            seenRemote.add(u.uid);
            uniqueRemote.push(u);
          }
        }
        setAllUsers(uniqueRemote);
        const adminUser = uniqueRemote.find(u => u.role === StaffRole.ADMIN || u.isSuperAdmin);
        if (adminUser) {
          syncAdminAccountToFirebaseConsole(adminUser).catch(() => {});
        }
        setNeedsInitialAdminSetup(false);
      } else {
        // If there are absolutely no users, trigger initial admin setup
        setNeedsInitialAdminSetup(true);
      }
    }).catch(err => {
      console.warn('Background auth sync notice:', err);
    });
  }, []);

  useEffect(() => {
    checkInitialSetup();

    // Firebase Auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        const existingUser = await db.users.where('email').equals(fbUser.email).first();
        if (existingUser) {
          setCurrentUser(existingUser);
          localStorage.setItem('soli_icu_active_user', JSON.stringify(existingUser));
        }
      }
    });

    // Real-Time Cloud Firestore user subscription (Absolute Source of Truth)
    const usersCol = collection(firestore, 'users');
    const unsubscribeUsers = onSnapshot(usersCol, async (snapshot) => {
      const remoteUsers: IcuUser[] = [];
      snapshot.forEach((docSnap) => {
        remoteUsers.push(docSnap.data() as IcuUser);
      });
      
      // Strict deduplication by uid to guarantee key uniqueness
      const uniqueUsers: IcuUser[] = [];
      const seen = new Set<string>();
      for (const u of remoteUsers) {
        if (u && u.uid && !seen.has(u.uid)) {
          seen.add(u.uid);
          uniqueUsers.push(u);
        }
      }

      if (uniqueUsers.length > 0) {
        setAllUsers(uniqueUsers);
        await db.users.clear();
        await db.users.bulkPut(uniqueUsers);

        // Also check if current logged in user's permissions or active status has changed in Firestore!
        const savedUserStr = localStorage.getItem('soli_icu_active_user');
        if (savedUserStr) {
          try {
            const activeUser = JSON.parse(savedUserStr) as IcuUser;
            const updatedActive = uniqueUsers.find(u => u.uid === activeUser.uid);
            if (updatedActive) {
              setCurrentUser(updatedActive);
              localStorage.setItem('soli_icu_active_user', JSON.stringify(updatedActive));
            }
          } catch (e) {
            console.warn('Error syncing active user with firestore snapshot:', e);
          }
        }
      } else {
        setAllUsers([]);
        await db.users.clear();
      }
    }, (err) => {
      console.warn('Real-time users subscription warning:', err);
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, [checkInitialSetup]);

  const refreshUsers = useCallback(async () => {
    const users = await fetchAllUsers();
    setAllUsers(users);
  }, []);

  // Quick Demo Login for instant testing across clinical roles
  const quickDemoLogin = async (role: StaffRole) => {
    let target = allUsers.find(u => u.role === role && u.isActive);
    if (!target) {
      // Create on the fly
      const nameMapping: Record<StaffRole, { en: string; ar: string; dept: string; badge: string }> = {
        [StaffRole.ADMIN]: { en: 'Dr. Ahmed Soliman', ar: 'د. أحمد سليمان', dept: 'MICU Administration', badge: 'ADM-001' },
        [StaffRole.CONSULTANT]: { en: 'Dr. Tariq Al-Mansoor', ar: 'د. طارق المنصور', dept: 'Critical Care Medicine', badge: 'CON-101' },
        [StaffRole.SPECIALIST]: { en: 'Dr. Layla Al-Ghamdi', ar: 'د. ليلى الغامدي', dept: 'Pulmonary & Critical Care', badge: 'SPC-204' },
        [StaffRole.RESIDENT]: { en: 'Dr. Omar Khaled', ar: 'د. عمر خالد', dept: 'Internal Medicine / ICU', badge: 'RES-305' },
        [StaffRole.LEAD_RN]: { en: 'RN Sarah Jenkins', ar: 'م. سارة جنكينز', dept: 'MICU Nursing Charge', badge: 'RN-401' },
        [StaffRole.BEDSIDE_RN]: { en: 'RN Fatima Al-Zahrani', ar: 'م. فاطمة الزهراني', dept: 'Bedside Critical Care', badge: 'RN-502' },
        [StaffRole.CLINICAL_PHARMACIST]: { en: 'Pharm. Zaid Al-Otaibi', ar: 'ص. زيد العتيبي', dept: 'Clinical Pharmacy', badge: 'PHM-601' },
        [StaffRole.RESPIRATORY_THERAPIST]: { en: 'RT Hisham Mahmoud', ar: 'أ. هشام محمود', dept: 'Respiratory Therapy', badge: 'RT-701' },
        [StaffRole.AUDITOR]: { en: 'Eng. Mona Mahmoud', ar: 'أ. منى محمود', dept: 'GAHAR & MoHP Egyptian Quality', badge: 'AUD-801' },
      };

      const meta = nameMapping[role] || { en: 'Clinical Staff', ar: 'كادر سريري', dept: 'MICU', badge: 'STAFF-01' };
      target = {
        uid: `demo_${role.toLowerCase()}`,
        email: `${role.toLowerCase()}@solimedical-micu.org`,
        nameEn: meta.en,
        nameAr: meta.ar,
        role: role,
        department: meta.dept,
        badgeId: meta.badge,
        licenseNumber: `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
        isActive: true,
        isSuperAdmin: role === StaffRole.ADMIN,
        pinCode: '1234',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        permissions: getDefaultPermissionsForRole(role),
      };

      await saveUserAccount(target);
      await refreshUsers();
    }

    target.lastLoginAt = new Date().toISOString();
    setCurrentUser(target);
    localStorage.setItem('soli_icu_active_user', JSON.stringify(target));
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

  // Login with Username / Email / Badge ID + Password / PIN (Firebase Auth SSOT)
  const loginWithEmailOrBadge = async (
    identifier: string, 
    pinOrPass: string
  ): Promise<{ success: boolean; message?: string }> => {
    const rawInput = identifier.trim();
    const trimmedId = rawInput.toLowerCase();
    const trimmedPin = pinOrPass.trim();

    if (!rawInput || !trimmedPin) {
      return { success: false, message: 'يرجى إدخال اسم المستخدم وكلمة المرور' };
    }

    // Automatically convert username into Firebase email format if not already an email
    const convertedFirebaseEmail = trimmedId.includes('@') 
      ? trimmedId 
      : `${trimmedId.replace(/\s+/g, '')}@solimedical-micu.org`;

    // 1. Authenticate via Firebase Authentication (SOLE Source of Truth)
    let fbUser: FirebaseUser | null = null;
    try {
      const authResult = await signInWithEmailAndPassword(auth, convertedFirebaseEmail, trimmedPin);
      fbUser = authResult.user;
    } catch (fbAuthErr: any) {
      const errCode = fbAuthErr?.code || '';
      if (errCode === 'auth/user-disabled' || errCode === 'auth/user-not-found') {
        return { success: false, message: 'هذا الحساب معطل مؤقتاً أو تم حذفه من المنظومة.' };
      }
      if (errCode === 'auth/wrong-password' || errCode === 'auth/invalid-credential') {
        return { success: false, message: 'كلمة المرور غير صحيحة. يرجى التأكد والمحاولة مرة أخرى.' };
      }
      return { success: false, message: fbAuthErr?.message || 'فشل تسجيل الدخول عبر Firebase Authentication.' };
    }

    if (!fbUser) {
      return { success: false, message: 'فشل التحقق من هوية المستخدم في Firebase Auth.' };
    }

    // 2. Load user document from Firestore / system directory
    let user = allUsers.find(
      u => u.uid === fbUser!.uid || 
           (u?.email || '').toLowerCase() === convertedFirebaseEmail || 
           (u?.email || '').toLowerCase() === trimmedId
    );

    if (!user) {
      try {
        const userDocRef = doc(firestore, 'users', fbUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          user = userSnap.data() as IcuUser;
        }
      } catch (e) {
        console.warn('Firestore user fetch error:', e);
      }
    }

    // 3. Reject if user does not exist or is disabled
    if (!user || user.isActive === false || user.active === false) {
      await firebaseSignOut(auth);
      return { 
        success: false, 
        message: 'هذا الحساب معطل مؤقتاً أو غير مسجل في جدول مستخدمي المنظومة.' 
      };
    }

    // 4. Update last login timestamp and set active user
    user.lastLoginAt = new Date().toISOString();
    user.uid = fbUser.uid;
    
    await saveUserAccount(user);
    setCurrentUser(user);
    localStorage.setItem('soli_icu_active_user', JSON.stringify(user));
    return { success: true };
  };

  // Login with Google (Firebase Auth)
  const loginWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      
      let matchedUser = allUsers.find(u => u.email.toLowerCase() === fbUser.email?.toLowerCase());

      if (!matchedUser) {
        // Check if this is the first admin setup
        if (needsInitialAdminSetup || allUsers.length === 0) {
          matchedUser = await registerInitialSuperAdmin({
            uid: fbUser.uid,
            email: fbUser.email || 'admin@solimedical-micu.org',
            nameEn: fbUser.displayName || 'Super Administrator',
            nameAr: 'المشرف العام للمنظومة',
            licenseNumber: 'EMS-ICU-EGYPT-10042',
            department: 'العناية المركزة الباطنة - مصر',
            badgeId: 'ADM-001',
            pinCode: '1234'
          });
          setNeedsInitialAdminSetup(false);
        } else {
          // Default role for new google user
          matchedUser = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            nameEn: fbUser.displayName || 'Clinical Physician',
            nameAr: 'طبيب سريري',
            role: StaffRole.SPECIALIST,
            department: 'Medical Intensive Care Unit',
            badgeId: `STF-${Math.floor(100 + Math.random() * 900)}`,
            licenseNumber: `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
            isActive: true,
            isSuperAdmin: false,
            pinCode: '1234',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            permissions: getDefaultPermissionsForRole(StaffRole.SPECIALIST),
          };
          await saveUserAccount(matchedUser);
        }
      }

      if (!matchedUser.isActive) {
        return { success: false, message: 'حسابك معطل حالياً (Account deactivated)' };
      }

      matchedUser.lastLoginAt = new Date().toISOString();
      await saveUserAccount(matchedUser);
      setCurrentUser(matchedUser);
      localStorage.setItem('soli_icu_active_user', JSON.stringify(matchedUser));
      await refreshUsers();
      return { success: true };
    } catch (err: any) {
      console.warn('Google Sign-in error:', err);
      return { success: false, message: err?.message || 'فشل تسجيل الدخول عبر Google' };
    }
  };

  // One-time Initial Super Admin Setup Registration
  const registerSuperAdmin = async (data: {
    email: string;
    nameEn: string;
    nameAr: string;
    licenseNumber: string;
    department: string;
    badgeId: string;
    pinCode: string;
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const superAdmin = await registerInitialSuperAdmin(data);
      setCurrentUser(superAdmin);
      setNeedsInitialAdminSetup(false);
      await refreshUsers();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'حدث خطأ أثناء تسجيل المشرف العام' };
    }
  };

  // Create User
  const createUser = async (userData: Partial<IcuUser>): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser?.permissions.canManageUsers && !currentUser?.isSuperAdmin) {
      return { success: false, message: 'ليس لديك صلاحية لإضافة مستخدمين جدد (Permission Denied)' };
    }

    const role = userData.role || StaffRole.BEDSIDE_RN;
    const now = new Date().toISOString();
    const newUser: IcuUser = {
      uid: userData.uid || `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      email: userData.email || `staff_${Date.now()}@solimedical-micu.org`,
      nameEn: userData.nameEn || 'Clinical Staff',
      nameAr: userData.nameAr || 'كادر سريري',
      role: role,
      department: userData.department || 'MICU',
      badgeId: userData.badgeId || `ID-${Math.floor(100 + Math.random() * 900)}`,
      licenseNumber: userData.licenseNumber || `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
      isActive: userData.isActive ?? true,
      isSuperAdmin: role === StaffRole.ADMIN,
      pinCode: userData.pinCode || '1234',
      createdAt: now,
      lastLoginAt: now,
      permissions: userData.permissions || getDefaultPermissionsForRole(role as StaffRole),
    };

    await saveUserAccount(newUser);
    syncUserToFirebaseConsole(newUser).catch(err => console.warn('Background sync user error:', err));
    await refreshUsers();
    return { success: true };
  };

  // Update User
  const updateUser = async (user: IcuUser): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser?.permissions.canManageUsers && !currentUser?.isSuperAdmin && currentUser?.uid !== user.uid) {
      return { success: false, message: 'ليس لديك صلاحية لتعديل بيانات هذا المستخدم (Permission Denied)' };
    }

    await saveUserAccount(user);
    syncUserToFirebaseConsole(user).catch(err => console.warn('Background sync user error:', err));
    if (currentUser?.uid === user.uid) {
      setCurrentUser(user);
      localStorage.setItem('soli_icu_active_user', JSON.stringify(user));
    }
    await refreshUsers();
    return { success: true };
  };

  // Change password for any user account directly in Firestore & Firebase Auth
  const changeUserPassword = async (uid: string, newPassword: string, oldPasswordForSelf?: string): Promise<{ success: boolean; message?: string }> => {
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, message: 'كلمة المرور يجب أن تتكون من 6 أحرف/أرقام على الأقل' };
    }

    const cleanPass = newPassword.trim();

    // 1. If self change, attempt Firebase Auth updatePassword
    if (auth.currentUser && auth.currentUser.uid === uid) {
      try {
        if (oldPasswordForSelf && auth.currentUser.email) {
          const cred = EmailAuthProvider.credential(auth.currentUser.email, oldPasswordForSelf);
          await reauthenticateWithCredential(auth.currentUser, cred);
        }
        await updatePassword(auth.currentUser, cleanPass);
      } catch (authErr: any) {
        console.warn('Self password update warning:', authErr);
      }
    }

    // 2. If Admin changing another user, call Admin Server API with Bearer Token
    if ((currentUser?.isSuperAdmin || currentUser?.role === StaffRole.ADMIN) && uid !== currentUser?.uid) {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          const resp = await fetch('/api/admin/users/change-password', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              targetUid: uid,
              newPassword: cleanPass
            })
          });
          const data = await resp.json();
          if (!resp.ok || !data.success) {
            return { success: false, message: data.message || 'فشل تحديث كلمة المرور عبر الخادم' };
          }
        }
      } catch (err: any) {
        console.warn('Admin change password API warning:', err);
      }
    }

    // 3. Update Firestore User document
    const targetUser = allUsers.find(u => u.uid === uid);
    if (targetUser) {
      targetUser.pinCode = cleanPass;
      await saveUserAccount(targetUser);
      if (currentUser?.uid === uid) {
        const updatedCurrent = { ...currentUser, pinCode: cleanPass };
        setCurrentUser(updatedCurrent);
        localStorage.setItem('soli_icu_active_user', JSON.stringify(updatedCurrent));
      }
    }

    await refreshUsers();
    return { success: true, message: 'تم تغيير كلمة المرور بنجاح وترحيلها إلى Firebase Auth' };
  };

  // Toggle user status (Activate/Deactivate) with server-side token revocation
  const toggleUserStatus = async (uid: string) => {
    const user = allUsers.find(u => u.uid === uid);
    if (!user) return;
    if (user.isSuperAdmin || user.role === StaffRole.ADMIN) return; // Cannot deactivate admin

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (user.isActive) {
        const resp = await fetch('/api/admin/users/disable', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            targetUid: uid,
            reason: 'Administrative deactivation'
          })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
          user.isActive = false;
          user.active = false;
          await saveUserAccount(user);
        }
      } else {
        user.isActive = true;
        user.active = true;
        await saveUserAccount(user);
      }
    } catch (e) {
      console.warn('Toggle status warning:', e);
    }
    await refreshUsers();
  };

  // Delete User Account (Callable / Server HTTPS SSOT)
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

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const resp = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          targetUid: uid,
          reason: 'Permanent administrative deletion'
        })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        return { success: false, message: data.message || 'فشل حذف المستخدم' };
      }
      await refreshUsers();
      return { 
        success: true, 
        message: data.message || 'تم حذف الحساب بنجاح. تظل جميع السجلات الطبية والملاحظات التاريخية محفوظة بالكامل.' 
      };
    } catch (e: any) {
      return { 
        success: false, 
        message: e?.message || 'فشل الاتصال بالخادم لحذف الحساب.' 
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

  // Comprehensive Permission Checking Engine (Dot notation + Legacy backward compatibility)
  const hasPermission = (permission: string | keyof UserPermissions): boolean => {
    if (!currentUser) return false;
    if (currentUser.isSuperAdmin || currentUser.role === StaffRole.ADMIN || (currentUser.role as any) === 'ADMIN') return true;
    
    // Direct dot-notation or object property check
    if (currentUser.permissions && (currentUser.permissions as any)[permission] !== undefined) {
      return !!(currentUser.permissions as any)[permission];
    }

    // Legacy fallback mapping
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
        registerSuperAdmin,
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
