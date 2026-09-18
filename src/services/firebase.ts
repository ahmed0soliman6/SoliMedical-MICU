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
  updateDoc as fupdateDoc
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
import firebaseConfig from '../../firebase-applet-config.json';
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
import { db, initializeDatabaseSeed } from '../db/icuSyncDb.ts';

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
    // Expected when running offline
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

  // Gracefully handle offline / unavailable state without raising loud console errors
  if (
    errCode === 'unavailable' ||
    errMsg.includes('offline') ||
    errMsg.includes('unavailable') ||
    errMsg.includes('Could not reach Cloud Firestore')
  ) {
    console.info(`[ICU-Sync Offline Cache] Firestore operates in local-first offline mode for path: ${path || 'root'}`);
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
        canAdmitPatient: true,
        canDischargePatient: true,
        canSignNotes: true,
        canAddAddendum: true,
        canSignSbar: true,
        canTitrateMedications: true,
        canManageUsers: true,
        canManageSettings: true,
        canViewAuditLogs: true,
        canEditVitals: true,
      };
    case StaffRole.CONSULTANT:
    case StaffRole.SPECIALIST:
      return {
        canAdmitPatient: true,
        canDischargePatient: true,
        canSignNotes: true,
        canAddAddendum: true,
        canSignSbar: true,
        canTitrateMedications: true,
        canManageUsers: false,
        canManageSettings: true,
        canViewAuditLogs: true,
        canEditVitals: true,
      };
    case StaffRole.RESIDENT:
      return {
        canAdmitPatient: true,
        canDischargePatient: false,
        canSignNotes: true,
        canAddAddendum: true,
        canSignSbar: true,
        canTitrateMedications: true,
        canManageUsers: false,
        canManageSettings: false,
        canViewAuditLogs: true,
        canEditVitals: true,
      };
    case StaffRole.LEAD_RN:
      return {
        canAdmitPatient: true,
        canDischargePatient: false,
        canSignNotes: true,
        canAddAddendum: true,
        canSignSbar: true,
        canTitrateMedications: true,
        canManageUsers: false,
        canManageSettings: false,
        canViewAuditLogs: true,
        canEditVitals: true,
      };
    case StaffRole.BEDSIDE_RN:
      return {
        canAdmitPatient: false,
        canDischargePatient: false,
        canSignNotes: true,
        canAddAddendum: true,
        canSignSbar: true,
        canTitrateMedications: true,
        canManageUsers: false,
        canManageSettings: false,
        canViewAuditLogs: false,
        canEditVitals: true,
      };
    case StaffRole.CLINICAL_PHARMACIST:
      return {
        canAdmitPatient: false,
        canDischargePatient: false,
        canSignNotes: true,
        canAddAddendum: true,
        canSignSbar: false,
        canTitrateMedications: true,
        canManageUsers: false,
        canManageSettings: false,
        canViewAuditLogs: true,
        canEditVitals: false,
      };
    case StaffRole.RESPIRATORY_THERAPIST:
      return {
        canAdmitPatient: false,
        canDischargePatient: false,
        canSignNotes: true,
        canAddAddendum: true,
        canSignSbar: true,
        canTitrateMedications: false,
        canManageUsers: false,
        canManageSettings: false,
        canViewAuditLogs: false,
        canEditVitals: true,
      };
    case StaffRole.AUDITOR:
      return {
        canAdmitPatient: false,
        canDischargePatient: false,
        canSignNotes: false,
        canAddAddendum: false,
        canSignSbar: false,
        canTitrateMedications: false,
        canManageUsers: false,
        canManageSettings: false,
        canViewAuditLogs: true,
        canEditVitals: false,
      };
    default:
      return {
        canAdmitPatient: false,
        canDischargePatient: false,
        canSignNotes: false,
        canAddAddendum: false,
        canSignSbar: false,
        canTitrateMedications: false,
        canManageUsers: false,
        canManageSettings: false,
        canViewAuditLogs: false,
        canEditVitals: false,
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

    // Firebase Auth requires passwords >= 6 characters. Format/pad if shorter:
    const authPassword = data.password.length >= 6 
      ? data.password 
      : data.password.padEnd(6, '0');

    let uid: string;

    // 1. Create user account in REAL Firebase Authentication
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, authPassword);
      uid = userCredential.user.uid;
    } catch (authErr: any) {
      console.warn('Firebase Auth notice:', authErr?.code || authErr);
      if (authErr.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(auth, email, authPassword);
          uid = signInCred.user.uid;
        } catch (signInErr: any) {
          uid = `admin_usr_${Date.now()}`;
        }
      } else {
        uid = `admin_usr_${Date.now()}`;
      }
    }

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
      pinCode: data.password,
      createdAt: now,
      lastLoginAt: now,
      permissions: getDefaultPermissionsForRole(StaffRole.ADMIN),
    };

    // 2. Save to Local Dexie DB
    await db.users.put(superAdminUser);

    // 3. Save to Firestore users & admins collections
    try {
      await setDoc(doc(firestore, 'users', uid), superAdminUser, { merge: true });
      await setDoc(doc(firestore, 'admins', uid), {
        uid,
        email,
        nameAr: data.fullName,
        nameEn: data.fullName,
        jobTitle: data.jobTitle,
        createdAt: now,
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore write warning:', err);
    }

    // 4. Mark setup as completed permanently
    localStorage.setItem('soli_icu_admin_setup_completed', 'true');

    // Sign out from Auth session so the user lands on the Login screen cleanly
    await firebaseSignOut(auth);

    return { success: true, user: superAdminUser };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'حدث خطأ أثناء إنشاء أول مستخدم في Firebase'
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
  // Delete cloud profile first; only remove the local cache after confirmation.
  await deleteDoc(doc(firestore, 'users', uid));
  await deleteDoc(doc(firestore, 'admins', uid));
  await db.users.delete(uid);
}

export async function syncUserToFirebaseConsole(user: IcuUser): Promise<void> {
  try {
    const rawEmail = user.email ? user.email.toLowerCase() : `${user.uid}@solimedical-micu.org`;
    const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@solimedical-micu.org`;
    const rawPin = user.pinCode || '123456';
    const authPassword = rawPin.length >= 6 ? rawPin : rawPin.padEnd(6, '0');

    let finalUid = user.uid;

    // Only attempt client auth creation if no active user session or if same user
    if (!auth.currentUser || auth.currentUser.uid === user.uid) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, authPassword);
        finalUid = cred.user.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            if (!auth.currentUser) {
              const signCred = await signInWithEmailAndPassword(auth, email, authPassword);
              finalUid = signCred.user.uid;
            }
          } catch (e) {
            console.warn('Sign-in fallback during sync:', e);
          }
        } else {
          console.warn('Firebase Auth create notice during sync:', authErr?.code || authErr);
        }
      }
    }

    if (user.uid && user.uid !== finalUid) {
      deleteUserAccount(user.uid).catch(e => console.warn('Old user cleanup notice:', e));
    }

    const updatedUser = { ...user, uid: finalUid, email };
    
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
  } catch (err) {
    console.warn('Notice during syncUserToFirebaseConsole:', err);
  }
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
    pinCode: adminData.pinCode || '1234',
    createdAt: now,
    lastLoginAt: now,
    permissions: getDefaultPermissionsForRole(StaffRole.ADMIN),
  };

  await db.users.put(superAdminUser);

  try {
    await setDoc(doc(firestore, 'users', uid), superAdminUser, { merge: true });
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
export async function saveUserAccount(user: IcuUser): Promise<void> {
  await db.users.put(user);
  await setDoc(doc(firestore, 'users', user.uid), user, { merge: true });
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
      const u = docSnap.data() as IcuUser;
      const docId = docSnap.id;
      
      if (!u || !u.uid) {
        continue;
      }

      // Identify duplicates
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

export function triggerExternalCriticalNotification(title: string, body: string, bedNumber: string) {
  playIcuAlarmAudio('HIGH');

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`🚨 ICU STAT Alert [سرير ${bedNumber}]: ${title}`, {
        body,
        icon: '/icon-192.png',
        tag: `icu-alert-${bedNumber}-${Date.now()}`,
        requireInteraction: true,
      });
    } catch (e) {
      console.warn('Could not launch system notification:', e);
    }
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
            const mergedBed: BedRecord = {
              ...localBed,
              ...remoteBed,
              id: bedId,
              bedNumber: remoteBed.bedNumber || bedId,
              currentPatientId: remoteBed.currentPatientId || (remoteBed as any).activePatientId || undefined,
              activePatientId: (remoteBed as any).activePatientId || remoteBed.currentPatientId || undefined,
            };
            await db.beds.put(mergedBed);
          }
        } else if (change.type === 'removed') {
          await db.beds.delete(change.doc.id);
        }
      }
      notifyUpdate();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'beds'));
    unsubscribers.push(unsubBeds);

    // 2. Subscribe to Patients
    const patientsCol = collection(firestore, 'patients');
    const unsubPatients = onSnapshot(patientsCol, async (snapshot) => {
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

    // 3. Subscribe to Real-Time Vitals with Alarm Checks
    const vitalsCol = collection(firestore, 'vitals');
    const vitalsQuery = query(vitalsCol, limit(100));
    const unsubVitals = onSnapshot(vitalsQuery, async (snapshot) => {
      const remoteVitals: TelemetryVitals[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const v = change.doc.data() as TelemetryVitals;
          remoteVitals.push(v);
          
          if (v.meanArterialPressureMmHg < 65) {
            triggerExternalCriticalNotification(
              'Severe Hypotension (MAP < 65 mmHg)',
              `مريض السرير ${v.bedId}: الضغط الشرياني انخفض إلى ${v.meanArterialPressureMmHg} mmHg (${v.systolicBpMmHg}/${v.diastolicBpMmHg})`,
              v.bedId
            );
            if (onCriticalAlarm) {
              onCriticalAlarm({
                bedNumber: v.bedId,
                message: `انخفاض حرج في MAP (${v.meanArterialPressureMmHg} mmHg)`,
                type: 'HEMODYNAMIC_STAT'
              });
            }
          }
          if (v.spo2Percent < 88) {
            triggerExternalCriticalNotification(
              'Hypoxemia Desaturation (SpO₂ < 88%)',
              `مريض السرير ${v.bedId}: تشبع الأكسجين انخفض إلى ${v.spo2Percent}%`,
              v.bedId
            );
          }
        }
      });

      if (remoteVitals.length > 0) {
        await db.vitals.bulkPut(remoteVitals);
        notifyUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'vitals'));
    unsubscribers.push(unsubVitals);

    // 4. Subscribe to SBAR Handovers
    const sbarCol = collection(firestore, 'sbarHandovers');
    const unsubSbar = onSnapshot(sbarCol, async (snapshot) => {
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

    // 5. Subscribe to Clinical Notes
    const notesCol = collection(firestore, 'clinicalNotes');
    const unsubNotes = onSnapshot(notesCol, async (snapshot) => {
      const remoteNotes: ClinicalNote[] = [];
      snapshot.forEach((docSnap) => {
        remoteNotes.push(docSnap.data() as ClinicalNote);
      });
      if (remoteNotes.length > 0) {
        await db.clinicalNotes.bulkPut(remoteNotes);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'clinicalNotes'));
    unsubscribers.push(unsubNotes);

    // 6. Subscribe to Users
    const usersCol = collection(firestore, 'users');
    const unsubUsers = onSnapshot(usersCol, async (snapshot) => {
      const remoteUsers: IcuUser[] = [];
      snapshot.forEach((docSnap) => {
        remoteUsers.push(docSnap.data() as IcuUser);
      });
      if (remoteUsers.length > 0) {
        await db.users.bulkPut(remoteUsers);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'users'));
    unsubscribers.push(unsubUsers);

    // 7. Subscribe to Ventilators
    const ventilatorsCol = collection(firestore, 'ventilators');
    const unsubVentilators = onSnapshot(ventilatorsCol, async (snapshot) => {
      const remoteVents: VentilatorParameters[] = [];
      snapshot.forEach((docSnap) => {
        remoteVents.push(docSnap.data() as VentilatorParameters);
      });
      if (remoteVents.length > 0) {
        await db.ventilators.bulkPut(remoteVents);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'ventilators'));
    unsubscribers.push(unsubVentilators);

    // 8. Subscribe to Infusion Pumps (both infusionPumps and infusion_pumps)
    const infusionPumpsCol = collection(firestore, 'infusionPumps');
    const unsubInfusionPumps = onSnapshot(infusionPumpsCol, async (snapshot) => {
      const remotePumps: InfusionPumpLine[] = [];
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          await db.infusionPumps.delete(change.doc.id);
        } else {
          remotePumps.push(change.doc.data() as InfusionPumpLine);
        }
      }
      if (remotePumps.length > 0) {
        await db.infusionPumps.bulkPut(remotePumps);
      }
      onDataUpdate();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'infusionPumps'));
    unsubscribers.push(unsubInfusionPumps);

    const infusionPumpsAltCol = collection(firestore, 'infusion_pumps');
    const unsubInfusionPumpsAlt = onSnapshot(infusionPumpsAltCol, async (snapshot) => {
      const remotePumps: InfusionPumpLine[] = [];
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          await db.infusionPumps.delete(change.doc.id);
        } else {
          remotePumps.push(change.doc.data() as InfusionPumpLine);
        }
      }
      if (remotePumps.length > 0) {
        await db.infusionPumps.bulkPut(remotePumps);
      }
      onDataUpdate();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'infusion_pumps'));
    unsubscribers.push(unsubInfusionPumpsAlt);

    // 9. Subscribe to Fluid Balances
    const fluidBalancesCol = collection(firestore, 'fluidBalances');
    const unsubFluidBalances = onSnapshot(fluidBalancesCol, async (snapshot) => {
      const remoteFluids: FluidBalance24H[] = [];
      snapshot.forEach((docSnap) => {
        remoteFluids.push(docSnap.data() as FluidBalance24H);
      });
      if (remoteFluids.length > 0) {
        await db.fluidBalances.bulkPut(remoteFluids);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'fluidBalances'));
    unsubscribers.push(unsubFluidBalances);

    // 10. Subscribe to Stat Labs
    const statLabsCol = collection(firestore, 'statLabs');
    const unsubStatLabs = onSnapshot(statLabsCol, async (snapshot) => {
      const remoteLabs: StatLabPanel[] = [];
      snapshot.forEach((docSnap) => {
        remoteLabs.push(docSnap.data() as StatLabPanel);
      });
      if (remoteLabs.length > 0) {
        await db.statLabs.bulkPut(remoteLabs);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'statLabs'));
    unsubscribers.push(unsubStatLabs);

    // 11. Subscribe to Patient Antibiotics
    const antibioticsCol = collection(firestore, 'patientAntibiotics');
    const unsubAntibiotics = onSnapshot(antibioticsCol, async (snapshot) => {
      const remoteAbx: PatientAntibiotic[] = [];
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          await db.patientAntibiotics.delete(change.doc.id);
        } else {
          remoteAbx.push(change.doc.data() as PatientAntibiotic);
        }
      }
      if (remoteAbx.length > 0) {
        await db.patientAntibiotics.bulkPut(remoteAbx);
      }
      onDataUpdate();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'patientAntibiotics'));
    unsubscribers.push(unsubAntibiotics);

    // 12. Subscribe to Medical Records (Unified Lab Results & Investigations)
    const medRecordsCol = collection(firestore, 'medical_records');
    const unsubMedRecords = onSnapshot(medRecordsCol, async (snapshot) => {
      const labsToPut: LabResultItem[] = [];
      const invsToPut: InvestigationItem[] = [];

      for (const change of snapshot.docChanges()) {
        const data = change.doc.data();
        if (change.type === 'removed') {
          await db.labResults.delete(change.doc.id);
          await db.investigations.delete(change.doc.id);
        } else {
          if (data.recordType === 'LAB' || data.category || data.unit) {
            labsToPut.push(data as LabResultItem);
          } else if (data.recordType === 'INVESTIGATION' || data.modality) {
            invsToPut.push(data as InvestigationItem);
          }
        }
      }

      if (labsToPut.length > 0) {
        await db.labResults.bulkPut(labsToPut);
      }
      if (invsToPut.length > 0) {
        await db.investigations.bulkPut(invsToPut);
      }
      onDataUpdate();
    }, (err) => handleFirestoreError(err, OperationType.GET, 'medical_records'));
    unsubscribers.push(unsubMedRecords);

    // 13. Subscribe to Direct Investigations collection
    const directInvsCol = collection(firestore, 'investigations');
    const unsubDirectInvs = onSnapshot(directInvsCol, async (snapshot) => {
      const invs: InvestigationItem[] = [];
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          await db.investigations.delete(change.doc.id);
        } else {
          invs.push(change.doc.data() as InvestigationItem);
        }
      }
      if (invs.length > 0) {
        await db.investigations.bulkPut(invs);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'investigations'));
    unsubscribers.push(unsubDirectInvs);

    // 14. Subscribe to Direct Lab Results collection
    const directLabsCol = collection(firestore, 'labResults');
    const unsubDirectLabs = onSnapshot(directLabsCol, async (snapshot) => {
      const labs: LabResultItem[] = [];
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') {
          await db.labResults.delete(change.doc.id);
        } else {
          labs.push(change.doc.data() as LabResultItem);
        }
      }
      if (labs.length > 0) {
        await db.labResults.bulkPut(labs);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'labResults'));
    unsubscribers.push(unsubDirectLabs);

    // 15. Subscribe to Transfusions
    const transfusionsCol = collection(firestore, 'transfusions');
    const unsubTransfusions = onSnapshot(transfusionsCol, async (snapshot) => {
      const remoteTransfusions: TransfusionTracker[] = [];
      snapshot.forEach((docSnap) => {
        remoteTransfusions.push(docSnap.data() as TransfusionTracker);
      });
      if (remoteTransfusions.length > 0) {
        await db.transfusions.bulkPut(remoteTransfusions);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'transfusions'));
    unsubscribers.push(unsubTransfusions);

    // 16. Subscribe to Addendums
    const addendumsCol = collection(firestore, 'addendums');
    const unsubAddendums = onSnapshot(addendumsCol, async (snapshot) => {
      const remoteAddendums: Addendum[] = [];
      snapshot.forEach((docSnap) => {
        remoteAddendums.push(docSnap.data() as Addendum);
      });
      if (remoteAddendums.length > 0) {
        await db.addendums.bulkPut(remoteAddendums);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'addendums'));
    unsubscribers.push(unsubAddendums);

    // 17. Subscribe to Audit Logs
    const auditLogsCol = collection(firestore, 'auditLogs');
    const unsubAuditLogs = onSnapshot(auditLogsCol, async (snapshot) => {
      const remoteLogs: WardAuditLog[] = [];
      snapshot.forEach((docSnap) => {
        remoteLogs.push(docSnap.data() as WardAuditLog);
      });
      if (remoteLogs.length > 0) {
        await db.auditLogs.bulkPut(remoteLogs);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'auditLogs'));
    unsubscribers.push(unsubAuditLogs);

  } catch (e) {
    console.warn('Could not establish Firestore real-time listener:', e);
  }

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

// -------------------------------------------------------------
// Cloud Data Pull on Initial Boot
// -------------------------------------------------------------

export async function pullCloudDataToLocalDb(): Promise<boolean> {
  try {
    const bedsSnap = await getDocs(collection(firestore, 'beds'));
    if (bedsSnap.empty) {
      // Initialize 6 vacant beds if empty on cloud
      const cleanBeds: BedRecord[] = ['01', '02', '03', '04', '05', '06'].map((num, idx) => ({
        id: num,
        unitId: 'MICU-MAIN',
        bedNumber: num as BedNumber,
        bayName: `Critical Care Bay ${num}`,
        isActive: true,
        displayOrder: idx,
        status: idx === 5 ? BedStatus.UNAVAILABLE : BedStatus.VACANT,
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

    const patientsSnap = await getDocs(collection(firestore, 'patients'));
    const remotePatients: PatientDossier[] = [];
    patientsSnap.forEach((d) => {
      const data = d.data() as PatientDossier;
      if (data && (data.id || (data as any).patientId)) {
        remotePatients.push({
          ...data,
          id: data.id || (data as any).patientId,
        });
      }
    });
    // An empty cloud result is not evidence that a non-empty local database
    // should be erased. Keep local records unless a verified remote snapshot
    // contains records.
    if (!patientsSnap.empty) {
      await db.patients.bulkPut(remotePatients);
    }

    const [
      vitalsSnap, 
      sbarsSnap, 
      notesSnap, 
      ventsSnap, 
      pumpsSnap, 
      pumpsLegacySnap,
      fluidsSnap, 
      fluidsLegacySnap,
      statLabsSnap, 
      abxSnap, 
      medRecordsSnap,
      directLabsSnap,
      directInvsSnap
    ] = await Promise.all([
      getDocs(collection(firestore, 'vitals')).catch(() => null),
      getDocs(collection(firestore, 'sbarHandovers')).catch(() => null),
      getDocs(collection(firestore, 'clinicalNotes')).catch(() => null),
      getDocs(collection(firestore, 'ventilators')).catch(() => null),
      getDocs(collection(firestore, 'infusionPumps')).catch(() => null),
      getDocs(collection(firestore, 'infusion_pumps')).catch(() => null),
      getDocs(collection(firestore, 'fluidBalances')).catch(() => null),
      getDocs(collection(firestore, 'fluid_balances')).catch(() => null),
      getDocs(collection(firestore, 'statLabs')).catch(() => null),
      getDocs(collection(firestore, 'patientAntibiotics')).catch(() => null),
      getDocs(collection(firestore, 'medical_records')).catch(() => null),
      getDocs(collection(firestore, 'labResults')).catch(() => null),
      getDocs(collection(firestore, 'investigations')).catch(() => null),
    ]);

    if (vitalsSnap && !vitalsSnap.empty) {
      const list: TelemetryVitals[] = [];
      vitalsSnap.forEach(d => list.push(d.data() as TelemetryVitals));
      await db.vitals.bulkPut(list);
    }
    if (sbarsSnap && !sbarsSnap.empty) {
      const list: SbarHandoverReport[] = [];
      sbarsSnap.forEach(d => list.push(d.data() as SbarHandoverReport));
      await db.sbarHandovers.bulkPut(list);
    }
    if (notesSnap && !notesSnap.empty) {
      const list: ClinicalNote[] = [];
      notesSnap.forEach(d => list.push(d.data() as ClinicalNote));
      await db.clinicalNotes.bulkPut(list);
    }
    if (ventsSnap && !ventsSnap.empty) {
      const list: VentilatorParameters[] = [];
      ventsSnap.forEach(d => list.push(d.data() as VentilatorParameters));
      await db.ventilators.bulkPut(list);
    }

    const pumpList: InfusionPumpLine[] = [];
    if (pumpsSnap && !pumpsSnap.empty) {
      pumpsSnap.forEach(d => pumpList.push(d.data() as InfusionPumpLine));
    }
    if (pumpsLegacySnap && !pumpsLegacySnap.empty) {
      pumpsLegacySnap.forEach(d => {
        const item = d.data() as InfusionPumpLine;
        if (!pumpList.some(p => p.id === item.id)) {
          pumpList.push(item);
        }
      });
    }
    if (pumpList.length > 0) {
      await db.infusionPumps.bulkPut(pumpList);
    }

    const fluidList: FluidBalance24H[] = [];
    if (fluidsSnap && !fluidsSnap.empty) {
      fluidsSnap.forEach(d => fluidList.push(d.data() as FluidBalance24H));
    }
    if (fluidsLegacySnap && !fluidsLegacySnap.empty) {
      fluidsLegacySnap.forEach(d => {
        const item = d.data() as FluidBalance24H;
        if (!fluidList.some(f => f.id === item.id)) {
          fluidList.push(item);
        }
      });
    }
    if (fluidList.length > 0) {
      await db.fluidBalances.bulkPut(fluidList);
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

    const labs: LabResultItem[] = [];
    const invs: InvestigationItem[] = [];

    if (medRecordsSnap && !medRecordsSnap.empty) {
      medRecordsSnap.forEach(d => {
        const data = d.data();
        if (data.recordType === 'LAB' || data.category || data.unit) {
          labs.push(data as LabResultItem);
        } else if (data.recordType === 'INVESTIGATION' || data.modality) {
          invs.push(data as InvestigationItem);
        }
      });
    }
    if (directLabsSnap && !directLabsSnap.empty) {
      directLabsSnap.forEach(d => {
        const item = d.data() as LabResultItem;
        if (!labs.some(l => l.id === item.id)) {
          labs.push(item);
        }
      });
    }
    if (directInvsSnap && !directInvsSnap.empty) {
      directInvsSnap.forEach(d => {
        const item = d.data() as InvestigationItem;
        if (!invs.some(i => i.id === item.id)) {
          invs.push(item);
        }
      });
    }

    if (labs.length > 0) await db.labResults.bulkPut(labs);
    if (invs.length > 0) await db.investigations.bulkPut(invs);

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
    await setDoc(patRef, sanitizeForFirestore(patient), { merge: true });
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
    await setDoc(sbarRef, sanitizeForFirestore(sbar), { merge: true });
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

    // 3. Reset 6 clean, vacant beds into local IndexedDB & Firestore
    const cleanBeds: BedRecord[] = ['01', '02', '03', '04', '05', '06'].map((num, idx) => ({
      id: num,
      unitId: 'MICU-MAIN',
      bedNumber: num as BedNumber,
      bayName: `Critical Care Bay ${num}`,
      isActive: true,
      displayOrder: idx,
      status: idx === 5 ? BedStatus.UNAVAILABLE : BedStatus.VACANT,
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
