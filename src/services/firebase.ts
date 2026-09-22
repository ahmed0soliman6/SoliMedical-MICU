import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection, 
  doc, 
  setDoc as fsetDoc, 
  getDoc,
  getDocs, 
  deleteDoc,
  onSnapshot, 
  query, 
  where,
  orderBy, 
  limit, 
  Unsubscribe,
  getDocFromServer,
  updateDoc as fupdateDoc,
  deleteField
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  User as FirebaseUser
} from 'firebase/auth';
import { firebaseConfig } from './firebase/config.ts';
import { 
  BedRecord, 
  BedNumber,
  BedStatus,
  PatientDossier, 
  TelemetryVitals, 
  VentilatorParameters, 
  InfusionPumpLine, 
  FluidBalance24H, 
  SbarHandoverReport, 
  ClinicalNote,
  IcuUser,
  StaffRole,
  UserPermissions,
  StatLabPanel,
  TransfusionTracker,
  Addendum,
  WardAuditLog,
  LabResultItem,
  InvestigationItem,
  PatientAntibiotic
} from '../types/schema.ts';
import { isAudioGloballyMuted } from './NotificationAudio.ts';
import { db, initializeDatabaseSeed, ensureBedPatientSync } from '../db/icuSyncDb.ts';

// -------------------------------------------------------------
// Firebase Initialization
// -------------------------------------------------------------
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
  });
} catch (e) {
  firestoreInstance = getFirestore(firebaseApp);
}

// Bind directly to default Cloud Firestore database instance
export const firestore = firestoreInstance;

export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

export async function ensureAuthenticated(): Promise<void> {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn('Anonymous sign-in skipped or failed:', e);
    }
  }
}

// Test Connection on boot (with timeout and offline graceful handling)
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const docRef = doc(firestore, 'test', 'connection');
    const docSnap = await Promise.race([
      getDoc(docRef),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 3000))
    ]);
    return docSnap !== null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'test/connection');
    // Expected when running offline or quota exceeded
    return false;
  }
}

// -------------------------------------------------------------
// Standardized Firestore Error Handler
// -------------------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code;

  if (
    errCode === 'resource-exhausted' ||
    errMsg.includes('resource-exhausted') ||
    errMsg.includes('Quota exceeded') ||
    errCode === 'unavailable' ||
    errCode === 'permission-denied' ||
    errMsg.includes('offline') ||
    errMsg.includes('unavailable') ||
    errMsg.includes('permission-denied') ||
    errMsg.includes('Permission denied') ||
    errMsg.includes('Could not reach Cloud Firestore')
  ) {
    console.info(`[ICU-Sync Local Persistence] Firestore operating in offline/local-first mode for path: ${path || 'root'} (${errCode || 'local-fallback'})`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notification:', JSON.stringify(errInfo));
}

// -------------------------------------------------------------
// Default Role Permissions Matrix
// -------------------------------------------------------------
export function getDefaultPermissionsForRole(role: StaffRole): UserPermissions {
  switch (role) {
    case StaffRole.ADMIN:
      return {
        'beds.view': true,
        'patients.view': true,
        'patients.create': true,
        'patients.update': true,
        'archive.view': true,
        'vitals.view': true,
        'vitals.create': true,
        'vitals.update': true,
        'labs.view': true,
        'labs.create': true,
        'labs.update': true,
        'investigations.view': true,
        'investigations.create': true,
        'investigations.update': true,
        'clinicalNotes.view': true,
        'clinicalNotes.create': true,
        'clinicalNotes.update': true,
        'sbar.view': true,
        'sbar.create': true,
        'sbar.update': true,
        'transfer.create': true,
        'bedSwap.create': true,
        'discharge.create': true,
        'chat.view': true,
        'chat.create': true,
        'chat.delete': true,
        'settings.view': true,
        'settings.update': true,
        'sections.manage': true,
        'cards.manage': true,
        'users.view': true,
        'users.create': true,
        'users.update': true,
        'users.disable': true,
        'users.delete': true,
        'audit.view': true,
      };
    case StaffRole.CONSULTANT:
    case StaffRole.SPECIALIST:
      return {
        'beds.view': true,
        'patients.view': true,
        'patients.create': true,
        'patients.update': true,
        'archive.view': true,
        'vitals.view': true,
        'vitals.create': true,
        'vitals.update': true,
        'labs.view': true,
        'labs.create': true,
        'labs.update': true,
        'investigations.view': true,
        'investigations.create': true,
        'investigations.update': true,
        'clinicalNotes.view': true,
        'clinicalNotes.create': true,
        'clinicalNotes.update': true,
        'sbar.view': true,
        'sbar.create': true,
        'sbar.update': true,
        'transfer.create': true,
        'bedSwap.create': true,
        'discharge.create': true,
        'chat.view': true,
        'chat.create': true,
        'chat.delete': false,
        'settings.view': true,
        'settings.update': false,
        'sections.manage': false,
        'cards.manage': false,
        'users.view': false,
        'users.create': false,
        'users.update': false,
        'users.disable': false,
        'users.delete': false,
        'audit.view': true,
      };
    case StaffRole.RESIDENT:
      return {
        'beds.view': true,
        'patients.view': true,
        'patients.create': true,
        'patients.update': true,
        'archive.view': true,
        'vitals.view': true,
        'vitals.create': true,
        'vitals.update': true,
        'labs.view': true,
        'labs.create': true,
        'labs.update': true,
        'investigations.view': true,
        'investigations.create': true,
        'investigations.update': true,
        'clinicalNotes.view': true,
        'clinicalNotes.create': true,
        'clinicalNotes.update': true,
        'sbar.view': true,
        'sbar.create': true,
        'sbar.update': true,
        'transfer.create': true,
        'bedSwap.create': true,
        'discharge.create': false,
        'chat.view': true,
        'chat.create': true,
        'chat.delete': false,
        'settings.view': false,
        'settings.update': false,
        'sections.manage': false,
        'cards.manage': false,
        'users.view': false,
        'users.create': false,
        'users.update': false,
        'users.disable': false,
        'users.delete': false,
        'audit.view': false,
      };
    case StaffRole.LEAD_RN:
      return {
        'beds.view': true,
        'patients.view': true,
        'patients.create': true,
        'patients.update': true,
        'archive.view': true,
        'vitals.view': true,
        'vitals.create': true,
        'vitals.update': true,
        'labs.view': true,
        'labs.create': true,
        'labs.update': true,
        'investigations.view': true,
        'investigations.create': true,
        'investigations.update': true,
        'clinicalNotes.view': true,
        'clinicalNotes.create': true,
        'clinicalNotes.update': true,
        'sbar.view': true,
        'sbar.create': true,
        'sbar.update': true,
        'transfer.create': true,
        'bedSwap.create': true,
        'discharge.create': false,
        'chat.view': true,
        'chat.create': true,
        'chat.delete': false,
        'settings.view': false,
        'settings.update': false,
        'sections.manage': false,
        'cards.manage': false,
        'users.view': false,
        'users.create': false,
        'users.update': false,
        'users.disable': false,
        'users.delete': false,
        'audit.view': true,
      };
    case StaffRole.BEDSIDE_RN:
      return {
        'beds.view': true,
        'patients.view': true,
        'patients.create': false,
        'patients.update': true,
        'archive.view': true,
        'vitals.view': true,
        'vitals.create': true,
        'vitals.update': true,
        'labs.view': true,
        'labs.create': true,
        'labs.update': true,
        'investigations.view': true,
        'investigations.create': true,
        'investigations.update': true,
        'clinicalNotes.view': true,
        'clinicalNotes.create': true,
        'clinicalNotes.update': true,
        'sbar.view': true,
        'sbar.create': true,
        'sbar.update': true,
        'transfer.create': false,
        'bedSwap.create': false,
        'discharge.create': false,
        'chat.view': true,
        'chat.create': true,
        'chat.delete': false,
        'settings.view': false,
        'settings.update': false,
        'sections.manage': false,
        'cards.manage': false,
        'users.view': false,
        'users.create': false,
        'users.update': false,
        'users.disable': false,
        'users.delete': false,
        'audit.view': false,
      };
    case StaffRole.CLINICAL_PHARMACIST:
      return {
        'beds.view': true,
        'patients.view': true,
        'patients.create': false,
        'patients.update': false,
        'archive.view': true,
        'vitals.view': true,
        'vitals.create': false,
        'vitals.update': false,
        'labs.view': true,
        'labs.create': true,
        'labs.update': false,
        'investigations.view': true,
        'investigations.create': false,
        'investigations.update': false,
        'clinicalNotes.view': true,
        'clinicalNotes.create': true,
        'clinicalNotes.update': true,
        'sbar.view': true,
        'sbar.create': false,
        'sbar.update': false,
        'transfer.create': false,
        'bedSwap.create': false,
        'discharge.create': false,
        'chat.view': true,
        'chat.create': true,
        'chat.delete': false,
        'settings.view': false,
        'settings.update': false,
        'sections.manage': false,
        'cards.manage': false,
        'users.view': false,
        'users.create': false,
        'users.update': false,
        'users.disable': false,
        'users.delete': false,
        'audit.view': false,
      };
    case StaffRole.RESPIRATORY_THERAPIST:
      return {
        'beds.view': true,
        'patients.view': true,
        'patients.create': false,
        'patients.update': false,
        'archive.view': true,
        'vitals.view': true,
        'vitals.create': true,
        'vitals.update': true,
        'labs.view': true,
        'labs.create': true,
        'labs.update': true,
        'investigations.view': true,
        'investigations.create': false,
        'investigations.update': false,
        'clinicalNotes.view': true,
        'clinicalNotes.create': true,
        'clinicalNotes.update': true,
        'sbar.view': true,
        'sbar.create': true,
        'sbar.update': true,
        'transfer.create': false,
        'bedSwap.create': false,
        'discharge.create': false,
        'chat.view': true,
        'chat.create': true,
        'chat.delete': false,
        'settings.view': false,
        'settings.update': false,
        'sections.manage': false,
        'cards.manage': false,
        'users.view': false,
        'users.create': false,
        'users.update': false,
        'users.disable': false,
        'users.delete': false,
        'audit.view': false,
      };
    case StaffRole.AUDITOR:
      return {
        'beds.view': true,
        'patients.view': true,
        'patients.create': false,
        'patients.update': false,
        'archive.view': true,
        'vitals.view': true,
        'vitals.create': false,
        'vitals.update': false,
        'labs.view': true,
        'labs.create': false,
        'labs.update': false,
        'investigations.view': true,
        'investigations.create': false,
        'investigations.update': false,
        'clinicalNotes.view': true,
        'clinicalNotes.create': false,
        'clinicalNotes.update': false,
        'sbar.view': true,
        'sbar.create': false,
        'sbar.update': false,
        'transfer.create': false,
        'bedSwap.create': false,
        'discharge.create': false,
        'chat.view': true,
        'chat.create': false,
        'chat.delete': false,
        'settings.view': false,
        'settings.update': false,
        'sections.manage': false,
        'cards.manage': false,
        'users.view': false,
        'users.create': false,
        'users.update': false,
        'users.disable': false,
        'users.delete': false,
        'audit.view': true,
      };
    default:
      return {
        'beds.view': true,
        'patients.view': false,
        'patients.create': false,
        'patients.update': false,
        'archive.view': false,
        'vitals.view': false,
        'vitals.create': false,
        'vitals.update': false,
        'labs.view': false,
        'labs.create': false,
        'labs.update': false,
        'investigations.view': false,
        'investigations.create': false,
        'investigations.update': false,
        'clinicalNotes.view': false,
        'clinicalNotes.create': false,
        'clinicalNotes.update': false,
        'sbar.view': false,
        'sbar.create': false,
        'sbar.update': false,
        'transfer.create': false,
        'bedSwap.create': false,
        'discharge.create': false,
        'chat.view': false,
        'chat.create': false,
        'chat.delete': false,
        'settings.view': false,
        'settings.update': false,
        'sections.manage': false,
        'cards.manage': false,
        'users.view': false,
        'users.create': false,
        'users.update': false,
        'users.disable': false,
        'users.delete': false,
        'audit.view': false,
      };
  }
}

// -------------------------------------------------------------
// User Management & Admin Bootstrap Functions
// -------------------------------------------------------------

/**
 * Checks if any super admin or registered user already exists in Firestore or local store
 */
export async function checkIfAnyAdminExists(): Promise<boolean> {
  try {
    // 1. Check Firestore admins collection
    const adminsSnap = await getDocs(collection(firestore, 'admins'));
    if (!adminsSnap.empty) return true;

    // 2. Check Firestore users collection
    const usersSnap = await getDocs(collection(firestore, 'users'));
    if (!usersSnap.empty) {
      for (const d of usersSnap.docs) {
        const u = d.data() as IcuUser;
        if (u.role === StaffRole.ADMIN || u.isSuperAdmin || (u.role as any) === 'ADMIN') {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Check admin in Firestore warning:', err);
  }
  return false;
}

export function getFirebaseAuthErrorMessage(err: any): string {
  const code = err?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل من قبل حساب آخر (auth/email-already-in-use).';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة (auth/invalid-email).';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة جداً، يجب أن تكون 6 أحرف أو أرقام على الأقل (auth/weak-password).';
    case 'auth/network-request-failed':
      return 'فشل الاتصال بالشبكة، تحقق من اتصال الإنترنت (auth/network-request-failed).';
    case 'auth/operation-not-allowed':
      return 'عملية إنشاء الحساب غير مفعلة في إعدادات المصادقة (auth/operation-not-allowed).';
    case 'auth/too-many-requests':
      return 'تم تقديم طلبات كثيرة جداً بشكل متكرر، تم حظر الطلب مؤقتاً (auth/too-many-requests).';
    default:
      return err?.message || `حدث خطأ أثناء المصادقة مع Firebase (${code || 'unknown'})`;
  }
}

/**
 * Creates the First User (Super Admin) in REAL Firebase Authentication and Firestore
 */
export async function registerInitialSuperAdminWithFirebaseAuth(data: {
  username: string;
  password: string;
  fullName: string;
  jobTitle: string;
}): Promise<{ success: boolean; user?: IcuUser; message?: string }> {
  try {
    const rawUsername = data.username.trim();
    const email = rawUsername.includes('@')
      ? rawUsername.toLowerCase()
      : `${rawUsername.toLowerCase().replace(/\s+/g, '')}@solimedical-micu.org`;

    if (!data.password || data.password.length < 6) {
      return {
        success: false,
        message: 'كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام (auth/weak-password).'
      };
    }

    // 1. Create user account in REAL Firebase Authentication (Strictly required, no fake UIDs)
    const userCredential = await createUserWithEmailAndPassword(auth, email, data.password);
    const uid = userCredential.user.uid;

    const now = new Date().toISOString();

    const superAdminUser: IcuUser = {
      uid,
      email,
      nameEn: data.fullName,
      nameAr: data.fullName,
      role: StaffRole.ADMIN,
      licenseNumber: 'EMS-ICU-EGYPT-10042',
      department: data.jobTitle || 'رئيس قسم العناية المركزة الباطنة - مصر',
      badgeId: 'ADM-001',
      isActive: true,
      isSuperAdmin: true,
      createdAt: now,
      lastLoginAt: now,
      permissions: getDefaultPermissionsForRole(StaffRole.ADMIN),
    };

    const userDocToSave = { ...superAdminUser };
    delete (userDocToSave as any).pinCode;
    delete (userDocToSave as any).password;

    // 2. Save to Local Dexie DB
    await db.users.put(userDocToSave);

    // 3. Save to Firestore users & admins collections
    await setDoc(doc(firestore, 'users', uid), userDocToSave, { merge: true });
    await setDoc(doc(firestore, 'admins', uid), {
      uid,
      email,
      nameAr: data.fullName,
      nameEn: data.fullName,
      jobTitle: data.jobTitle,
      createdAt: now,
    }, { merge: true });

    // 4. Mark setup as completed permanently
    localStorage.setItem('soli_icu_admin_setup_completed', 'true');

    // Sign out from Auth session so the user lands on the Login screen cleanly
    await firebaseSignOut(auth);

    return { success: true, user: superAdminUser };
  } catch (err: any) {
    const errorMessage = getFirebaseAuthErrorMessage(err);
    return {
      success: false,
      message: errorMessage
    };
  }
}

/**
 * Forces synchronization of ANY user account directly into Firebase Authentication Users table and Firestore (default) database
 */
export async function syncAdminAccountToFirebaseConsole(user: IcuUser): Promise<void> {
  return syncUserToFirebaseConsole(user);
}

export async function deleteUserAccount(uid: string): Promise<void> {
  await db.users.delete(uid);
  try {
    await deleteDoc(doc(firestore, 'users', uid));
    await deleteDoc(doc(firestore, 'admins', uid)).catch(() => {});
  } catch (err) {
    console.warn('Failed to delete user doc in firestore:', err);
  }
}

export async function syncUserToFirebaseConsole(user: IcuUser): Promise<void> {
  const rawEmail = user.email ? user.email.toLowerCase() : `${user.uid}@solimedical-micu.org`;
  const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@solimedical-micu.org`;
  const rawPin = (user as any).pinCode || '123456';
  if (rawPin.length < 6) {
    throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام (auth/weak-password)');
  }

  let finalUid = user.uid;

  // Only attempt client auth creation if no active user session or if same user
  if (!auth.currentUser || auth.currentUser.uid === user.uid) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, rawPin);
      finalUid = cred.user.uid;
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        // Keep existing uid if already in use
      } else {
        throw authErr;
      }
    }
  }

  if (user.uid && user.uid !== finalUid) {
    deleteUserAccount(user.uid).catch(e => console.warn('Old user cleanup notice:', e));
  }

  const updatedUser = { ...user, uid: finalUid, email };
  delete (updatedUser as any).pinCode;
  delete (updatedUser as any).password;
  
  // Save to Firestore (default) database users collection
  await setDoc(doc(firestore, 'users', finalUid), updatedUser, { merge: true });
  
  if (user.role === StaffRole.ADMIN || user.isSuperAdmin) {
    await setDoc(doc(firestore, 'admins', finalUid), {
      uid: finalUid,
      email,
      nameAr: user.nameAr,
      nameEn: user.nameEn,
      jobTitle: user.department,
      createdAt: user.createdAt || new Date().toISOString(),
    }, { merge: true });
  }

  // Save to local IndexedDB
  await db.users.put(updatedUser);
}

/**
 * Registers the Initial Super Admin (Legacy / Fallback helper)
 */
export async function registerInitialSuperAdmin(adminData: {
  uid?: string;
  email: string;
  nameEn: string;
  nameAr: string;
  licenseNumber: string;
  department: string;
  badgeId: string;
  pinCode?: string;
}): Promise<IcuUser> {
  const uid = adminData.uid || `admin_${Date.now()}`;
  const now = new Date().toISOString();

  const superAdminUser: IcuUser = {
    uid,
    email: adminData.email,
    nameEn: adminData.nameEn,
    nameAr: adminData.nameAr,
    role: StaffRole.ADMIN,
    licenseNumber: adminData.licenseNumber,
    department: adminData.department || 'MICU - Medical Intensive Care',
    badgeId: adminData.badgeId || 'ADM-001',
    isActive: true,
    isSuperAdmin: true,
    createdAt: now,
    lastLoginAt: now,
    permissions: getDefaultPermissionsForRole(StaffRole.ADMIN),
  };

  const userDocToSave = { ...superAdminUser };
  delete (userDocToSave as any).pinCode;
  delete (userDocToSave as any).password;

  await db.users.put(userDocToSave);

  try {
    await setDoc(doc(firestore, 'users', uid), userDocToSave, { merge: true });
    await setDoc(doc(firestore, 'admins', uid), {
      uid,
      email: adminData.email,
      nameEn: adminData.nameEn,
      nameAr: adminData.nameAr,
      createdAt: now,
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }

  localStorage.setItem('soli_icu_admin_setup_completed', 'true');
  localStorage.setItem('soli_icu_active_user', JSON.stringify(superAdminUser));

  return superAdminUser;
}

/**
 * Creates or updates a clinical staff user in Cloud & Local DB
 */
export async function createSecondaryAuthUser(email: string, password: string): Promise<string> {
  const secondaryAppName = `SecondaryAuthApp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;
    await firebaseSignOut(secondaryAuth);
    return uid;
  } finally {
    try {
      const { deleteApp } = await import('firebase/app');
      await deleteApp(secondaryApp);
    } catch {
      // Non-blocking cleanup
    }
  }
}

export async function saveUserAccount(user: IcuUser): Promise<void> {
  const userToSave = { ...user };
  delete (userToSave as any).pinCode;
  delete (userToSave as any).password;
  await db.users.put(userToSave);
  await setDoc(doc(firestore, 'users', user.uid), userToSave, { merge: true });
  if (user.role === StaffRole.ADMIN || user.isSuperAdmin) {
    await setDoc(doc(firestore, 'admins', user.uid), {
      uid: user.uid,
      email: user.email,
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      createdAt: user.createdAt,
    }, { merge: true });
  }
}

export function getInitialStaffUsers(): IcuUser[] {
  // Disabled: No demo or mock staff accounts are seeded
  return [];
}

/**
 * Run a database sanitation to delete any duplicate document IDs
 */
export async function sanitizeFirestoreUsers() {
  try {
    const snap = await getDocs(collection(firestore, 'users'));
    const seenUids = new Map<string, { docId: string; data: IcuUser }>();

    for (const docSnap of snap.docs) {
      const u = docSnap.data() as any;
      const docId = docSnap.id;
      
      if (!u || !u.uid) {
        continue;
      }

      // 1. Clean up legacy fields: password and pinCode
      if ('password' in u || 'pinCode' in u) {
        await fupdateDoc(doc(firestore, 'users', docId), {
          password: deleteField(),
          pinCode: deleteField()
        }).catch(() => {});
      }

      // 2. Identify duplicates
      const uid = u.uid.trim();
      if (!seenUids.has(uid)) {
        seenUids.set(uid, { docId, data: u });
      } else {
        const existing = seenUids.get(uid)!;
        if (docId === uid) {
          await deleteDoc(doc(firestore, 'users', existing.docId)).catch(() => {});
          seenUids.set(uid, { docId, data: u });
        } else {
          await deleteDoc(doc(firestore, 'users', docId)).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('Firestore sanitation failed:', err);
  }
}

/**
 * Fetch all users from cloud and sync with local DB
 */
export async function fetchAllUsers(): Promise<IcuUser[]> {
  let rawList: IcuUser[] = [];
  try {
    const snap = await getDocs(collection(firestore, 'users'));
    snap.forEach((d) => {
      const data = d.data() as IcuUser;
      if (data && data.uid) {
        rawList.push(data);
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }

  // Deduplicate strictly by uid to ensure absolute key uniqueness
  const uniqueUsersMap = new Map<string, IcuUser>();
  for (const user of rawList) {
    if (!user || !user.uid) continue;
    const uid = user.uid.trim();
    if (!uniqueUsersMap.has(uid)) {
      uniqueUsersMap.set(uid, user);
    } else {
      const existing = uniqueUsersMap.get(uid)!;
      const isUserNewer = (user.lastLoginAt || user.createdAt || '') > (existing.lastLoginAt || existing.createdAt || '');
      if (isUserNewer || (user.isSuperAdmin && !existing.isSuperAdmin)) {
        uniqueUsersMap.set(uid, user);
      }
    }
  }

  const finalUsers = Array.from(uniqueUsersMap.values());
  if (finalUsers.length > 0) {
    await db.users.clear();
    await db.users.bulkPut(finalUsers);
  }

  return finalUsers;
}

// -------------------------------------------------------------
// Critical Alarm Notification & Sound Engine (Android & Web)
// -------------------------------------------------------------

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
    }
  }
  return 'default';
}

export function playIcuAlarmAudio(urgency: 'HIGH' | 'MEDIUM' = 'HIGH') {
  if (typeof window === 'undefined') return;
  // Strict mute check: never play ICU alarm audio if muted globally
  if (isAudioGloballyMuted()) {
    return;
  }
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    if (urgency === 'HIGH') {
      // 3-pulse Critical Care Alarm (IEC 60601-1-8 standard simulation)
      [0, 0.15, 0.3].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime + delay); // A5 note
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.1);
      });
    } else {
      // Warning Beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (err) {
    console.warn('Audio play prevented:', err);
  }
}

// -------------------------------------------------------------
// Real-Time Cloud Firestore Sync Subscriptions
// -------------------------------------------------------------

export function subscribeToRealtimeFirestore(
  onDataUpdate: () => void,
  onCriticalAlarm?: (alert: { bedNumber: string; message: string; type: string }) => void
): () => void {
  const unsubscribers: Unsubscribe[] = [];

  const notifyUpdate = () => {
    onDataUpdate();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('icu-data-updated'));
      }
    } catch {}
  };

  try {
    // 1. Subscribe to Beds
    const bedsCol = collection(firestore, 'beds');
    const unsubBeds = onSnapshot(bedsCol, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added' || change.type === 'modified') {
          const remoteBed = change.doc.data() as BedRecord;
          const bedId = remoteBed.id || change.doc.id;
          if (bedId) {
            const localBed = await db.beds.get(bedId);
            const assignedPatId = remoteBed.currentPatientId !== undefined 
              ? remoteBed.currentPatientId 
              : ((remoteBed as any).activePatientId !== undefined ? (remoteBed as any).activePatientId : null);

            const isVacantBed = !assignedPatId;
            const mergedBed: BedRecord = {
              ...localBed,
              ...remoteBed,
              id: bedId,
              bedNumber: remoteBed.bedNumber || bedId,
              currentPatientId: assignedPatId || null,
              activePatientId: assignedPatId || null,
              isolation: isVacantBed ? { isIsolated: false, precautions: [] } : (remoteBed.isolation || { isIsolated: false, precautions: [] }),
              status: isVacantBed && remoteBed.status !== BedStatus.UNAVAILABLE && remoteBed.status !== BedStatus.DECONTAMINATING
                ? BedStatus.VACANT
                : (remoteBed.status || (assignedPatId ? BedStatus.OCCUPIED : BedStatus.VACANT)),
            };
            await db.beds.put(mergedBed);
          }
        } else if (change.type === 'removed') {
          await db.beds.delete(change.doc.id);
        }
      }
      await ensureBedPatientSync();
      notifyUpdate();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'beds'));
    unsubscribers.push(unsubBeds);

    // 2. Subscribe to Active Patients Query (scoped to active ICU status)
    const activePatientsQuery = query(
      collection(firestore, 'patients'),
      where('patientStatus', '==', 'ACTIVE_ICU')
    );
    const unsubPatients = onSnapshot(activePatientsQuery, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type === 'added' || change.type === 'modified') {
          const remotePatient = change.doc.data() as PatientDossier;
          const patientId = remotePatient.id || (remotePatient as any).patientId || change.doc.id;
          if (patientId) {
            const localPatient = await db.patients.get(patientId);
            if (!localPatient || !localPatient.updatedAt || !remotePatient.updatedAt ||
                new Date(remotePatient.updatedAt).getTime() >= new Date(localPatient.updatedAt).getTime()) {
              await db.patients.put({
                ...remotePatient,
                id: patientId,
                patientStatus: remotePatient.patientStatus || (remotePatient as any).status || 'ACTIVE_ICU'
              });
            }
          }
        } else if (change.type === 'removed') {
          await db.patients.delete(change.doc.id);
        }
      }
      notifyUpdate();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'patients'));
    unsubscribers.push(unsubPatients);

    // 3. Subscribe to Real-Time Vitals with Alarm Checks (Ordered by newest timestamp)
    const vitalsCol = collection(firestore, 'vitals');
    const vitalsQuery = query(vitalsCol, orderBy('timestamp', 'desc'), limit(50));
    let isInitialVitalsSnapshot = true;
    const unsubVitals = onSnapshot(vitalsQuery, async (snapshot) => {
      const remoteVitals: TelemetryVitals[] = [];

      // On initial snapshot connection, sync existing records silently without firing alarms on reload!
      if (isInitialVitalsSnapshot) {
        isInitialVitalsSnapshot = false;
        snapshot.forEach((doc) => {
          remoteVitals.push(doc.data() as TelemetryVitals);
        });
        if (remoteVitals.length > 0) {
          await db.vitals.bulkPut(remoteVitals);
          notifyUpdate();
        }
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const v = change.doc.data() as TelemetryVitals;
          remoteVitals.push(v);
        }
      });

      if (remoteVitals.length > 0) {
        await db.vitals.bulkPut(remoteVitals);
        notifyUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vitals'));
    unsubscribers.push(unsubVitals);

    // 4. Subscribe to Operational SBAR Handovers (Ordered by newest createdAt)
    const sbarCol = collection(firestore, 'sbarHandovers');
    const sbarQuery = query(sbarCol, orderBy('createdAt', 'desc'), limit(30));
    const unsubSbar = onSnapshot(sbarQuery, async (snapshot) => {
      const remoteSbars: SbarHandoverReport[] = [];
      snapshot.forEach((docSnap) => {
        remoteSbars.push(docSnap.data() as SbarHandoverReport);
      });
      if (remoteSbars.length > 0) {
        await db.sbarHandovers.bulkPut(remoteSbars);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'sbarHandovers'));
    unsubscribers.push(unsubSbar);

  } catch (e) {
    console.warn('Could not establish Firestore real-time listener:', e);
  }

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

// -------------------------------------------------------------
// On-Demand Fetch for Patient Historical Records
// -------------------------------------------------------------
export async function fetchPatientHistoricalDataFromCloud(patientId: string): Promise<void> {
  if (!patientId) return;
  try {
    const [
      notesSnap,
      sbarsSnap,
      ventsSnap,
      pumpsSnap,
      fluidsSnap,
      statLabsSnap,
      abxSnap,
      medRecordsSnap,
      directLabsSnap,
      directInvsSnap,
      transfusionsSnap,
      addendumsSnap
    ] = await Promise.all([
      getDocs(query(collection(firestore, 'clinicalNotes'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'sbarHandovers'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'ventilators'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'infusionPumps'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'fluidBalances'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'statLabs'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'patientAntibiotics'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'medical_records'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'labResults'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'investigations'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'transfusions'), where('patientId', '==', patientId))).catch(() => null),
      getDocs(query(collection(firestore, 'addendums'), where('patientId', '==', patientId))).catch(() => null),
    ]);

    if (notesSnap && !notesSnap.empty) {
      const list: ClinicalNote[] = [];
      notesSnap.forEach(d => list.push(d.data() as ClinicalNote));
      await db.clinicalNotes.bulkPut(list);
    }
    if (sbarsSnap && !sbarsSnap.empty) {
      const list: SbarHandoverReport[] = [];
      sbarsSnap.forEach(d => list.push(d.data() as SbarHandoverReport));
      await db.sbarHandovers.bulkPut(list);
    }
    if (ventsSnap && !ventsSnap.empty) {
      const list: VentilatorParameters[] = [];
      ventsSnap.forEach(d => list.push(d.data() as VentilatorParameters));
      await db.ventilators.bulkPut(list);
    }
    if (pumpsSnap && !pumpsSnap.empty) {
      const list: InfusionPumpLine[] = [];
      pumpsSnap.forEach(d => list.push(d.data() as InfusionPumpLine));
      await db.infusionPumps.bulkPut(list);
    }
    if (fluidsSnap && !fluidsSnap.empty) {
      const list: FluidBalance24H[] = [];
      fluidsSnap.forEach(d => list.push(d.data() as FluidBalance24H));
      await db.fluidBalances.bulkPut(list);
    }
    if (statLabsSnap && !statLabsSnap.empty) {
      const list: StatLabPanel[] = [];
      statLabsSnap.forEach(d => list.push(d.data() as StatLabPanel));
      await db.statLabs.bulkPut(list);
    }
    if (abxSnap && !abxSnap.empty) {
      const list: PatientAntibiotic[] = [];
      abxSnap.forEach(d => list.push(d.data() as PatientAntibiotic));
      await db.patientAntibiotics.bulkPut(list);
    }
    if (directLabsSnap && !directLabsSnap.empty) {
      const list: LabResultItem[] = [];
      directLabsSnap.forEach(d => list.push(d.data() as LabResultItem));
      await db.labResults.bulkPut(list);
    }
    if (directInvsSnap && !directInvsSnap.empty) {
      const list: InvestigationItem[] = [];
      directInvsSnap.forEach(d => list.push(d.data() as InvestigationItem));
      await db.investigations.bulkPut(list);
    }
    if (transfusionsSnap && !transfusionsSnap.empty) {
      const list: TransfusionTracker[] = [];
      transfusionsSnap.forEach(d => list.push(d.data() as TransfusionTracker));
      await db.transfusions.bulkPut(list);
    }
    if (addendumsSnap && !addendumsSnap.empty) {
      const list: Addendum[] = [];
      addendumsSnap.forEach(d => list.push(d.data() as Addendum));
      await db.addendums.bulkPut(list);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `patient/${patientId}`);
  }
}

// -------------------------------------------------------------
// Cloud Data Pull on Initial Boot (Operational Beds & Patients)
// -------------------------------------------------------------

export async function pullCloudDataToLocalDb(): Promise<boolean> {
  try {
    const bedsSnap = await getDocs(collection(firestore, 'beds'));
    if (bedsSnap.empty) {
      let totalBedsCount = 6;
      try {
        const settingsDoc = await getDocs(collection(firestore, 'system_settings'));
        if (!settingsDoc.empty) {
          const data = settingsDoc.docs[0].data();
          if (data?.unit?.totalBedsCount) {
            totalBedsCount = data.unit.totalBedsCount;
          }
        } else {
          const saved = localStorage.getItem('soli_medical_icu_settings_v1');
          if (saved) {
            const data = JSON.parse(saved);
            if (data?.unit?.totalBedsCount) {
              totalBedsCount = data.unit.totalBedsCount;
            }
          }
        }
      } catch (e) {
        console.warn('Error fetching system settings bed count for cloud pull:', e);
      }

      const bedIds = Array.from({ length: totalBedsCount }, (_, i) => String(i + 1).padStart(2, '0'));
      const cleanBeds: BedRecord[] = bedIds.map((num, idx) => ({
        id: num,
        unitId: 'MICU-MAIN',
        bedNumber: num as BedNumber,
        bayName: `Critical Care Bay ${num}`,
        isActive: true,
        displayOrder: idx,
        status: idx === (totalBedsCount - 1) ? BedStatus.UNAVAILABLE : BedStatus.VACANT,
        currentPatientId: null,
        activePatientId: null,
        lastCleanedAt: new Date().toISOString()
      }));
      await db.beds.clear();
      await db.beds.bulkPut(cleanBeds);
      for (const b of cleanBeds) await syncBedToCloud(b);
      return true;
    }

    const remoteBeds: BedRecord[] = [];
    bedsSnap.forEach((d) => {
      const data = d.data() as BedRecord;
      if (data && (data.bedNumber || (data as any).id)) {
        remoteBeds.push({
          ...data,
          bedNumber: data.bedNumber || (data as any).id,
          currentPatientId: data.currentPatientId || (data as any).activePatientId || undefined,
          activePatientId: (data as any).activePatientId || data.currentPatientId || undefined,
        });
      }
    });
    if (remoteBeds.length > 0) {
      await db.beds.bulkPut(remoteBeds);
    }

    const activePatientsQuery = query(
      collection(firestore, 'patients'),
      where('patientStatus', '==', 'ACTIVE_ICU')
    );
    const patientsSnap = await getDocs(activePatientsQuery);
    const remotePatients: PatientDossier[] = [];
    patientsSnap.forEach((d) => {
      const data = d.data() as PatientDossier;
      if (data && (data.id || (data as any).patientId)) {
        remotePatients.push({
          ...data,
          id: data.id || (data as any).patientId,
          patientStatus: data.patientStatus || (data as any).status || 'ACTIVE_ICU',
        });
      }
    });
    if (!patientsSnap.empty) {
      await db.patients.bulkPut(remotePatients);
    }

    await ensureBedPatientSync();

    return true;
  } catch (err) {
    console.warn('Pull cloud data failed or offline:', err);
    return false;
  }
}

// -------------------------------------------------------------
// Cloud Push Operations (Firestore Broadcast)
// -------------------------------------------------------------

export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }
  if (typeof obj === 'object') {
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  }
  return obj;
}

export async function setDoc(ref: any, data: any, options?: any) {
  if (options) {
    return fsetDoc(ref, sanitizeForFirestore(data), options);
  }
  return fsetDoc(ref, sanitizeForFirestore(data));
}

export async function updateDoc(ref: any, data: any) {
  return fupdateDoc(ref, sanitizeForFirestore(data));
}

export async function syncBedToCloud(bed: BedRecord): Promise<void> {
  try {
    const bedRef = doc(firestore, 'beds', bed.bedNumber);
    const cleanBed = {
      ...bed,
      currentPatientId: bed.currentPatientId || null,
      activePatientId: bed.activePatientId || bed.currentPatientId || null,
    };
    await setDoc(bedRef, sanitizeForFirestore(cleanBed));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `beds/${bed.bedNumber}`);
    throw err;
  }
}

export async function syncPatientToCloud(patient: PatientDossier): Promise<void> {
  try {
    const patRef = doc(firestore, 'patients', patient.id);
    const payload = {
      ...patient,
      unitId: patient.unitId || 'MICU-MAIN',
      patientStatus: patient.patientStatus || (patient as any).status || (patient as any).currentStatus || 'ACTIVE_ICU',
      status: patient.patientStatus || (patient as any).status || 'ACTIVE_ICU',
      currentStatus: patient.patientStatus || (patient as any).currentStatus || 'ACTIVE_ICU',
    };
    await setDoc(patRef, sanitizeForFirestore(payload), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patient.id}`);
    throw err;
  }
}

export async function syncVitalsToCloud(vitals: TelemetryVitals): Promise<void> {
  try {
    const vitRef = doc(firestore, 'vitals', vitals.id);
    await setDoc(vitRef, sanitizeForFirestore(vitals));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `vitals/${vitals.id}`);
  }
}

export async function syncSbarToCloud(sbar: SbarHandoverReport): Promise<void> {
  try {
    const sbarRef = doc(firestore, 'sbarHandovers', sbar.id);
    const payload = {
      ...sbar,
      createdAt: sbar.createdAt || sbar.outgoingDoctor?.signedAt || sbar.shiftDate || new Date().toISOString(),
      timestamp: sbar.timestamp || sbar.outgoingDoctor?.signedAt || sbar.shiftDate || new Date().toISOString(),
    };
    await setDoc(sbarRef, sanitizeForFirestore(payload), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sbarHandovers/${sbar.id}`);
  }
}

export async function syncClinicalNoteToCloud(note: ClinicalNote): Promise<void> {
  try {
    const noteRef = doc(firestore, 'clinicalNotes', note.id);
    await setDoc(noteRef, sanitizeForFirestore(note), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clinicalNotes/${note.id}`);
  }
}

export async function syncVentilatorToCloud(vent: VentilatorParameters): Promise<void> {
  try {
    const ventRef = doc(firestore, 'ventilators', vent.id);
    await setDoc(ventRef, sanitizeForFirestore(vent), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `ventilators/${vent.id}`);
  }
}

export async function syncPumpToCloud(pump: InfusionPumpLine): Promise<void> {
  try {
    const pumpRef = doc(firestore, 'infusionPumps', pump.id);
    await setDoc(pumpRef, sanitizeForFirestore(pump), { merge: true });
    // Mirror to legacy collection name for cross-version compatibility
    const pumpRefLegacy = doc(firestore, 'infusion_pumps', pump.id);
    await setDoc(pumpRefLegacy, sanitizeForFirestore(pump), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `infusionPumps/${pump.id}`);
  }
}

export async function deletePumpFromCloud(pumpId: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, 'infusionPumps', pumpId));
    await deleteDoc(doc(firestore, 'infusion_pumps', pumpId)).catch(() => {});
  } catch (err) {
    console.warn('Delete pump from cloud notice:', err);
  }
}

export async function deleteVentilatorFromCloud(ventId: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, 'ventilators', ventId));
  } catch (err) {
    console.warn('Delete ventilator from cloud notice:', err);
  }
}

export async function syncFluidBalanceToCloud(fluid: FluidBalance24H): Promise<void> {
  try {
    const fluidRef = doc(firestore, 'fluidBalances', fluid.id);
    await setDoc(fluidRef, fluid, { merge: true });
    const fluidRefLegacy = doc(firestore, 'fluid_balances', fluid.id);
    await setDoc(fluidRefLegacy, fluid, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `fluidBalances/${fluid.id}`);
  }
}

export async function deleteFluidBalanceFromCloud(fluidId: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, 'fluidBalances', fluidId));
    await deleteDoc(doc(firestore, 'fluid_balances', fluidId)).catch(() => {});
  } catch (err) {
    console.warn('Delete fluid balance from cloud notice:', err);
  }
}

export async function syncStatLabsToCloud(labs: StatLabPanel): Promise<void> {
  try {
    const labsRef = doc(firestore, 'statLabs', labs.id);
    await setDoc(labsRef, labs, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `statLabs/${labs.id}`);
  }
}

export async function deleteStatLabFromCloud(labId: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, 'statLabs', labId));
  } catch (err) {
    console.warn('Delete stat lab from cloud notice:', err);
  }
}

export async function syncPatientAntibioticToCloud(abx: PatientAntibiotic): Promise<void> {
  try {
    const abxRef = doc(firestore, 'patientAntibiotics', abx.id);
    await setDoc(abxRef, abx, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patientAntibiotics/${abx.id}`);
  }
}

export async function deletePatientAntibioticFromCloud(abxId: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, 'patientAntibiotics', abxId));
  } catch (err) {
    console.warn('Delete antibiotic from cloud notice:', err);
  }
}

export async function syncLabResultToCloud(labItem: LabResultItem): Promise<void> {
  try {
    const docRef = doc(firestore, 'medical_records', labItem.id);
    await setDoc(docRef, {
      ...labItem,
      recordType: 'LAB',
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `medical_records/${labItem.id}`);
  }
}

export async function deleteLabResultFromCloud(labId: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, 'medical_records', labId));
  } catch (err) {
    console.warn('Delete lab result from cloud notice:', err);
  }
}

export async function syncInvestigationToCloud(invItem: InvestigationItem): Promise<void> {
  try {
    const docRef = doc(firestore, 'medical_records', invItem.id);
    await setDoc(docRef, {
      ...invItem,
      recordType: 'INVESTIGATION',
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `medical_records/${invItem.id}`);
  }
}

export async function deleteInvestigationFromCloud(invId: string): Promise<void> {
  try {
    await deleteDoc(doc(firestore, 'medical_records', invId));
  } catch (err) {
    console.warn('Delete investigation from cloud notice:', err);
  }
}

/**
 * Seed initial local state to Firestore if remote is blank
 */
export async function seedInitialDataToFirestore(): Promise<void> {
  try {
    const existingBedsSnap = await getDocs(collection(firestore, 'beds'));
    if (existingBedsSnap.empty) {
      const localBeds = await db.beds.toArray();
      for (const b of localBeds) {
        await syncBedToCloud(b);
      }
      const localPatients = await db.patients.toArray();
      for (const p of localPatients) {
        await syncPatientToCloud(p);
      }
      const localVitals = await db.vitals.toArray();
      for (const v of localVitals) {
        await syncVitalsToCloud(v);
      }
      const localSbars = await db.sbarHandovers.toArray();
      for (const s of localSbars) {
        await syncSbarToCloud(s);
      }
      const localNotes = await db.clinicalNotes.toArray();
      for (const n of localNotes) {
        await syncClinicalNoteToCloud(n);
      }
      const localVents = await db.ventilators.toArray();
      for (const vt of localVents) {
        await syncVentilatorToCloud(vt);
      }
      const localPumps = await db.infusionPumps.toArray();
      for (const pu of localPumps) {
        await syncPumpToCloud(pu);
      }
      const localFluids = await db.fluidBalances.toArray();
      for (const fl of localFluids) {
        await syncFluidBalanceToCloud(fl);
      }
      const localStatLabs = await db.statLabs.toArray();
      for (const sl of localStatLabs) {
        await syncStatLabsToCloud(sl);
      }
      const localAbx = await db.patientAntibiotics.toArray();
      for (const ab of localAbx) {
        await syncPatientAntibioticToCloud(ab);
      }
      const localLabs = await db.labResults.toArray();
      for (const lb of localLabs) {
        await syncLabResultToCloud(lb);
      }
      const localInvs = await db.investigations.toArray();
      for (const iv of localInvs) {
        await syncInvestigationToCloud(iv);
      }
      console.log('Firebase Cloud Data Seeded successfully!');
    }
  } catch (e) {
    console.warn('Could not complete initial Firestore cloud seed:', e);
  }
}

// -------------------------------------------------------------
// Database Governance & Reset Operations
// -------------------------------------------------------------

/**
 * 1. Clear Local Browser Data (IndexedDB) & Re-sync active state from Firebase Cloud
 */
export async function clearLocalBrowserDataAndSyncFromCloud(): Promise<{ success: boolean; message: string }> {
  try {
    // Clear IndexedDB Dexie tables
    await Promise.all([
      db.beds.clear(),
      db.patients.clear(),
      db.vitals.clear(),
      db.ventilators.clear(),
      db.infusionPumps.clear(),
      db.fluidBalances.clear(),
      db.statLabs.clear(),
      db.transfusions.clear(),
      db.sbarHandovers.clear(),
      db.clinicalNotes.clear(),
      db.addendums.clear(),
      db.auditLogs.clear(),
      db.labResults.clear(),
      db.investigations.clear(),
      db.patientAntibiotics.clear(),
    ]);

    // Re-pull active single source of truth from Cloud
    const pulled = await pullCloudDataToLocalDb();
    if (!pulled) {
      await initializeDatabaseSeed();
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('icu-data-updated'));
      }
    } catch {}

    return {
      success: true,
      message: 'تم مسح بيانات المتصفح بنجاح واستعادتها من السحابة'
    };
  } catch (err: any) {
    console.error('Error clearing local browser data:', err);
    return {
      success: false,
      message: err.message || 'حدث خطأ أثناء مسح بيانات المتصفح'
    };
  }
}

/**
 * 2. Clear ALL Patient Data from Cloud and Local Browser & Start Fresh
 */
export async function clearAllCloudAndLocalDataAndReset(): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Clear local IndexedDB tables
    await Promise.all([
      db.beds.clear(),
      db.patients.clear(),
      db.vitals.clear(),
      db.ventilators.clear(),
      db.infusionPumps.clear(),
      db.fluidBalances.clear(),
      db.statLabs.clear(),
      db.transfusions.clear(),
      db.sbarHandovers.clear(),
      db.clinicalNotes.clear(),
      db.addendums.clear(),
      db.auditLogs.clear(),
      db.labResults.clear(),
      db.investigations.clear(),
      db.patientAntibiotics.clear(),
    ]);

    // 2. Clear Firestore Cloud Collections completely
    const collectionsToClear = [
      'beds',
      'patients',
      'vitals',
      'sbarHandovers',
      'handovers',
      'clinicalNotes',
      'ventilators',
      'infusionPumps',
      'infusion_pumps',
      'fluidBalances',
      'fluid_balances',
      'statLabs',
      'patientAntibiotics',
      'medical_records',
      'investigations',
      'labResults',
      'transfusions',
      'addendums',
      'auditLogs',
      'transfers',
      'operations'
    ];

    for (const colName of collectionsToClear) {
      try {
        const snap = await getDocs(collection(firestore, colName));
        const deleteOps = snap.docs.map(docSnap => deleteDoc(doc(firestore, colName, docSnap.id)));
        await Promise.all(deleteOps);
      } catch (colErr) {
        console.warn(`Collection clear failed for ${colName}:`, colErr);
      }
    }

    // 3. Reset clean, vacant beds into local IndexedDB & Firestore dynamically based on settings
    let totalBedsCount = 6;
    try {
      const settingsDoc = await getDocs(collection(firestore, 'system_settings'));
      if (!settingsDoc.empty) {
        const data = settingsDoc.docs[0].data();
        if (data?.unit?.totalBedsCount) {
          totalBedsCount = data.unit.totalBedsCount;
        }
      } else {
        const saved = localStorage.getItem('soli_medical_icu_settings_v1');
        if (saved) {
          const data = JSON.parse(saved);
          if (data?.unit?.totalBedsCount) {
            totalBedsCount = data.unit.totalBedsCount;
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching system settings bed count for purge reset:', e);
    }

    const bedIds = Array.from({ length: totalBedsCount }, (_, i) => String(i + 1).padStart(2, '0'));
    const cleanBeds: BedRecord[] = bedIds.map((num, idx) => ({
      id: num,
      unitId: 'MICU-MAIN',
      bedNumber: num as BedNumber,
      bayName: `Critical Care Bay ${num}`,
      isActive: true,
      displayOrder: idx,
      status: idx === (totalBedsCount - 1) ? BedStatus.UNAVAILABLE : BedStatus.VACANT,
      currentPatientId: null,
      activePatientId: null,
      lastCleanedAt: new Date().toISOString()
    }));

    await db.beds.bulkPut(cleanBeds);
    for (const b of cleanBeds) {
      await syncBedToCloud(b);
    }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('icu-data-updated'));
      }
    } catch {}

    return {
      success: true,
      message: 'تم تصفير جميع بيانات المرضى والسجلات من السحابة والمتصفح بنجاح وتجهيز الأسرة الشاغرة'
    };
  } catch (err: any) {
    console.error('Error resetting cloud and local database:', err);
    return {
      success: false,
      message: err.message || 'حدث خطأ أثناء حذف البيانات السحابية والمحلية'
    };
  }
}
