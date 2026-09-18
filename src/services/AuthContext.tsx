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
  registerInitialSuperAdminWithFirebaseAuth,
  saveUserAccount,
  deleteUserAccount,
  fetchAllUsers,
  getDefaultPermissionsForRole,
  testFirestoreConnection,
  syncAdminAccountToFirebaseConsole,
  firestore
} from './firebase.ts';
import { 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  User as FirebaseUser 
} from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db } from '../db/icuSyncDb.ts';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json') || body.trimStart().startsWith('<')) {
    throw new Error(`خادم إدارة Firebase أعاد HTML بدل JSON (HTTP ${response.status}). تحقق من VITE_API_BASE_URL ونشر Cloud Run API.`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`استجابة خادم Firebase غير صالحة (HTTP ${response.status}).`);
  }
}

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
          } else if (fbUser.email) {
            // Fallback lookup by email
            const q = query(collection(firestore, 'users'), where('email', '==', fbUser.email.toLowerCase()));
            const snap = await getDocs(q);
            if (!snap.empty) {
              resolvedUser = snap.docs[0].data() as IcuUser;
              if (resolvedUser) {
                resolvedUser.uid = fbUser.uid;
                await setDoc(doc(firestore, 'users', fbUser.uid), resolvedUser, { merge: true });
              }
            }
          }

          // Fallback 2: Check local Dexie DB
          if (!resolvedUser) {
            try {
              const localUsers = await db.users.toArray();
              const localMatched = localUsers.find(u => 
                (u.email && u.email.toLowerCase() === (fbUser.email || '').toLowerCase()) ||
                (u.uid && u.uid.toLowerCase() === fbUser.uid.toLowerCase())
              );
              if (localMatched) {
                resolvedUser = { ...localMatched, uid: fbUser.uid };
                await setDoc(doc(firestore, 'users', fbUser.uid), resolvedUser, { merge: true });
              }
            } catch (localErr) {
              console.warn('Local users lookup warning:', localErr);
            }
          }

          // Fallback 3: Auto-provision profile if user is authenticated in Firebase Auth
          if (!resolvedUser && fbUser.email) {
            const rawPrefix = fbUser.email.split('@')[0];
            const autoUser: IcuUser = {
              uid: fbUser.uid,
              email: fbUser.email.toLowerCase(),
              nameAr: fbUser.displayName || rawPrefix,
              nameEn: fbUser.displayName || rawPrefix,
              role: StaffRole.BEDSIDE_RN,
              department: 'MICU',
              badgeId: rawPrefix.toUpperCase(),
              licenseNumber: `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
              isActive: true,
              active: true,
              isSuperAdmin: false,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
              permissions: getDefaultPermissionsForRole(StaffRole.BEDSIDE_RN),
            };
            await setDoc(doc(firestore, 'users', fbUser.uid), autoUser, { merge: true });
            await db.users.put(autoUser);
            resolvedUser = autoUser;
          }

          if (resolvedUser && resolvedUser.isActive !== false && resolvedUser.active !== false) {
            resolvedUser.uid = fbUser.uid;
            setCurrentUser(resolvedUser);
            localStorage.setItem('soli_icu_active_user', JSON.stringify(resolvedUser));
          } else {
            // User deleted or disabled in Firestore
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

    // 3. Load user record from Firestore users/{uid}
    let user: IcuUser | null = null;
    try {
      const userDocRef = doc(firestore, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        user = userSnap.data() as IcuUser;
      }
    } catch (e) {
      console.warn('Firestore user fetch error:', e);
    }

    // Fallback 1: search by email in Firestore if doc ID differed
    if (!user && fbUser.email) {
      try {
        const q = query(collection(firestore, 'users'), where('email', '==', fbUser.email.toLowerCase()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          user = snap.docs[0].data() as IcuUser;
          if (user) {
            user.uid = fbUser.uid;
            await setDoc(doc(firestore, 'users', fbUser.uid), user, { merge: true });
          }
        }
      } catch (e) {
        console.warn('Firestore email lookup error:', e);
      }
    }

    // Fallback 2: search local Dexie database
    if (!user) {
      try {
        const localUsers = await db.users.toArray();
        const localMatched = localUsers.find(u => 
          (u.email && u.email.toLowerCase() === (fbUser.email || '').toLowerCase()) ||
          (u.badgeId && u.badgeId.toLowerCase() === rawInput.toLowerCase()) ||
          (u.uid && u.uid.toLowerCase() === fbUser.uid.toLowerCase())
        );
        if (localMatched) {
          user = { ...localMatched, uid: fbUser.uid };
          await setDoc(doc(firestore, 'users', fbUser.uid), user, { merge: true });
        }
      } catch (e) {
        console.warn('Local users fallback lookup error:', e);
      }
    }

    // Fallback 3: Auto-provision Firestore document if user is verified in Firebase Auth
    if (!user) {
      try {
        const rawPrefix = (fbUser.email || rawInput).split('@')[0];
        const defaultRole = StaffRole.BEDSIDE_RN;
        const autoUser: IcuUser = {
          uid: fbUser.uid,
          email: fbUser.email || targetEmail,
          nameAr: fbUser.displayName || rawPrefix,
          nameEn: fbUser.displayName || rawPrefix,
          role: defaultRole,
          department: 'MICU',
          badgeId: rawPrefix.toUpperCase(),
          licenseNumber: `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
          isActive: true,
          active: true,
          isSuperAdmin: false,
          pinCode: rawPass,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          permissions: getDefaultPermissionsForRole(defaultRole),
        };
        await setDoc(doc(firestore, 'users', fbUser.uid), autoUser, { merge: true });
        await db.users.put(autoUser);
        user = autoUser;
      } catch (e) {
        console.warn('Auto provision fallback notice:', e);
      }
    }

    // 4. Reject if user does not exist in Firestore or is disabled
    if (!user) {
      await firebaseSignOut(auth);
      return { 
        success: false, 
        message: 'بيانات المستخدم غير مسجلة في جدول مستخدمي المنظومة (Firestore users).' 
      };
    }

    if (user.isActive === false || user.active === false) {
      await firebaseSignOut(auth);
      return { 
        success: false, 
        message: 'هذا الحساب معطل حالياً من قبل إدارة المستشفى.' 
      };
    }

    // 5. Update last login timestamp and set active user
    user.lastLoginAt = new Date().toISOString();
    user.uid = fbUser.uid;
    
    setDoc(doc(firestore, 'users', fbUser.uid), { lastLoginAt: user.lastLoginAt }, { merge: true }).catch(() => {});
    
    setCurrentUser(user);
    localStorage.setItem('soli_icu_active_user', JSON.stringify(user));
    return { success: true };
  };

  // Login with Google (Firebase Auth)
  const loginWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      
      let matchedUser: IcuUser | null = null;

      // Fetch from Firestore
      try {
        const userDocRef = doc(firestore, 'users', fbUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          matchedUser = userSnap.data() as IcuUser;
        } else if (fbUser.email) {
          const q = query(collection(firestore, 'users'), where('email', '==', fbUser.email.toLowerCase()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            matchedUser = snap.docs[0].data() as IcuUser;
            if (matchedUser) {
              matchedUser.uid = fbUser.uid;
              await setDoc(doc(firestore, 'users', fbUser.uid), matchedUser, { merge: true });
            }
          }
        }
      } catch (e) {
        console.warn('Google login Firestore error:', e);
      }

      if (!matchedUser && fbUser.email) {
        const rawPrefix = fbUser.email.split('@')[0];
        const defaultRole = StaffRole.BEDSIDE_RN;
        const autoUser: IcuUser = {
          uid: fbUser.uid,
          email: fbUser.email.toLowerCase(),
          nameAr: fbUser.displayName || rawPrefix,
          nameEn: fbUser.displayName || rawPrefix,
          role: defaultRole,
          department: 'MICU',
          badgeId: rawPrefix.toUpperCase(),
          licenseNumber: `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
          isActive: true,
          active: true,
          isSuperAdmin: false,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          permissions: getDefaultPermissionsForRole(defaultRole),
        };
        await setDoc(doc(firestore, 'users', fbUser.uid), autoUser, { merge: true });
        await db.users.put(autoUser);
        matchedUser = autoUser;
      }

      if (!matchedUser) {
        await firebaseSignOut(auth);
        return { success: false, message: 'حساب Google هذا غير مسجل في منظومة المستشفى.' };
      }

      if (matchedUser.isActive === false || matchedUser.active === false) {
        await firebaseSignOut(auth);
        return { success: false, message: 'حسابك معطل حالياً من قبل الإدارة.' };
      }

      matchedUser.lastLoginAt = new Date().toISOString();
      matchedUser.uid = fbUser.uid;
      
      setDoc(doc(firestore, 'users', fbUser.uid), { lastLoginAt: matchedUser.lastLoginAt }, { merge: true }).catch(() => {});
      
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
      pinCode: userData.pinCode || '123456',
      createdAt: now,
      lastLoginAt: now,
      permissions: userData.permissions || getDefaultPermissionsForRole(role as StaffRole),
    };

    // User creation is an Admin SDK operation. Never fall back to a client/local-only
    // write: that creates an Auth/Firestore split-brain and then breaks RBAC.
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) return { success: false, message: 'جلسة المدير غير صالحة. يرجى تسجيل الدخول مجدداً.' };
      const resp = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(newUser),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success || !data.data) {
        return { success: false, message: data.message || 'فشل إنشاء الحساب على Firebase. لم يتم حفظ حساب محلي.' };
      }
      await db.users.put(data.data as IcuUser);
      await refreshUsers();
      return { success: true };
    } catch (apiErr: any) {
      console.error('Server admin create user failed:', apiErr);
      return { success: false, message: apiErr?.message || 'تعذر الاتصال بخادم إدارة Firebase.' };
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
          const resp = await fetch(`${API_BASE_URL}/api/admin/users/change-password`, {
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
          const data = await readApiResponse(resp);
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
    return { success: true, message: 'تم تغيير كلمة المرور بنجاح' };
  };

  // Toggle user status (Activate/Deactivate) with server-side token revocation
  const toggleUserStatus = async (uid: string) => {
    const user = allUsers.find(u => u.uid === uid);
    if (!user) return;
    if (user.isSuperAdmin || user.role === StaffRole.ADMIN) return;

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (user.isActive) {
        const resp = await fetch(`${API_BASE_URL}/api/admin/users/disable`, {
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
        const data = await readApiResponse(resp);
        if (!resp.ok || !data.success) {
          throw new Error(data.message || 'فشل تعطيل الحساب على Firebase.');
        }
        if (resp.ok && data.success) {
          user.isActive = false;
          user.active = false;
        }
      } else {
        user.isActive = true;
        user.active = true;
        await saveUserAccount(user);
      }
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

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const resp = await fetch(`${API_BASE_URL}/api/admin/users/delete`, {
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
      const data = await readApiResponse(resp);
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
