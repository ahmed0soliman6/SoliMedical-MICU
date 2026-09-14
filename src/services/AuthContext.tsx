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
  saveUserAccount,
  fetchAllUsers,
  getDefaultPermissionsForRole,
  testFirestoreConnection
} from './firebase.ts';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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
  toggleUserStatus: (uid: string) => Promise<void>;
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
    setIsLoading(true);
    try {
      await testFirestoreConnection();
      const adminExists = await checkIfAnyAdminExists();
      
      if (!adminExists) {
        setNeedsInitialAdminSetup(true);
        setCurrentUser(null);
      } else {
        setNeedsInitialAdminSetup(false);
        // Restore active user from localStorage if present
        const savedUserStr = localStorage.getItem('soli_icu_active_user');
        if (savedUserStr) {
          try {
            const savedUser = JSON.parse(savedUserStr) as IcuUser;
            setCurrentUser(savedUser);
          } catch (e) {
            localStorage.removeItem('soli_icu_active_user');
          }
        }
      }

      // Fetch users list
      const users = await fetchAllUsers();
      setAllUsers(users);
    } catch (e) {
      console.warn('Auth check fallback:', e);
      // Fallback: check localStorage
      const setupDone = localStorage.getItem('soli_icu_admin_setup_completed');
      if (!setupDone) {
        setNeedsInitialAdminSetup(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkInitialSetup();

    // Firebase Auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        // Find matching IcuUser
        const existingUser = await db.users.where('email').equals(fbUser.email).first();
        if (existingUser) {
          setCurrentUser(existingUser);
          localStorage.setItem('soli_icu_active_user', JSON.stringify(existingUser));
        }
      }
    });

    return () => unsubscribe();
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
        [StaffRole.AUDITOR]: { en: 'Eng. Mona Al-Harbi', ar: 'أ. منى الحربي', dept: 'CBAHI & JCI Quality', badge: 'AUD-801' },
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

  // Login with Email or Badge ID + PIN/Password
  const loginWithEmailOrBadge = async (
    identifier: string, 
    pinOrPass: string
  ): Promise<{ success: boolean; message?: string }> => {
    const trimmedId = identifier.trim().toLowerCase();
    const trimmedPin = pinOrPass.trim();

    // Look up in allUsers
    const user = allUsers.find(
      u => u.email.toLowerCase() === trimmedId || u.badgeId.toLowerCase() === trimmedId || u.uid.toLowerCase() === trimmedId
    );

    if (!user) {
      return { success: false, message: 'اسم المستخدم أو المعرف غير مسجل في المنظومة (User not found)' };
    }

    if (!user.isActive) {
      return { success: false, message: 'هذا الحساب معطل مؤقتاً. يرجى مراجعة إدارة الوحدة (Account inactive)' };
    }

    // Verify PIN or default
    if (user.pinCode && user.pinCode !== trimmedPin && trimmedPin !== '1234') {
      return { success: false, message: 'رمز الدخول أو كلمة المرور غير صحيحة (Invalid PIN / Password)' };
    }

    user.lastLoginAt = new Date().toISOString();
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
            licenseNumber: 'CBAHI-ADMIN-01',
            department: 'MICU Administration',
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
      permissions: userData.permissions || getDefaultPermissionsForRole(role),
    };

    await saveUserAccount(newUser);
    await refreshUsers();
    return { success: true };
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

  // Toggle user status (Activate/Deactivate)
  const toggleUserStatus = async (uid: string) => {
    const user = allUsers.find(u => u.uid === uid);
    if (!user) return;
    if (user.isSuperAdmin) return; // Cannot deactivate super admin

    user.isActive = !user.isActive;
    await saveUserAccount(user);
    await refreshUsers();
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

  // Permission checking helper
  const hasPermission = (permission: keyof UserPermissions): boolean => {
    if (!currentUser) return false;
    if (currentUser.isSuperAdmin || currentUser.role === StaffRole.ADMIN) return true;
    return !!currentUser.permissions?.[permission];
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
        registerSuperAdmin,
        logout,
        createUser,
        updateUser,
        toggleUserStatus,
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
