import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  Unsubscribe,
  getDocFromServer
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  BedRecord, 
  PatientDossier, 
  TelemetryVitals, 
  VentilatorParameters, 
  InfusionPumpLine, 
  FluidBalance24H, 
  SbarHandoverReport, 
  ClinicalNote,
  IcuUser,
  StaffRole,
  UserPermissions
} from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';

// -------------------------------------------------------------
// Firebase Initialization
// -------------------------------------------------------------
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
// Bind directly to default Cloud Firestore database instance (matching (default) in console)
export const firestore = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

// Test Connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestore, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is running in offline cache mode.');
    }
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
      for (const doc of usersSnap.docs) {
        const u = doc.data() as IcuUser;
        if (u.role === StaffRole.ADMIN || u.isSuperAdmin) {
          return true;
        }
      }
    }

    // 3. Check local Dexie DB
    const localAdmins = await db.users.where('role').equals(StaffRole.ADMIN).toArray();
    if (localAdmins.length > 0) return true;
  } catch (err) {
    // Fallback: check local storage flag
    const setupDone = localStorage.getItem('soli_icu_admin_setup_completed');
    if (setupDone === 'true') return true;
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
  await db.users.delete(uid);
  try {
    await deleteDoc(doc(firestore, 'users', uid));
    await deleteDoc(doc(firestore, 'admins', uid));
  } catch (err) {
    console.warn('Firestore delete user warning:', err);
  }
}

export async function syncUserToFirebaseConsole(user: IcuUser): Promise<void> {
  try {
    const rawEmail = user.email ? user.email.toLowerCase() : `${user.uid}@solimedical-micu.org`;
    const email = rawEmail.includes('@') ? rawEmail : `${rawEmail}@solimedical-micu.org`;
    const rawPin = user.pinCode || '123456';
    const authPassword = rawPin.length >= 6 ? rawPin : rawPin.padEnd(6, '0');

    let finalUid = user.uid;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, authPassword);
      finalUid = cred.user.uid;
      console.log('Successfully created user in Firebase Auth Users list:', email, finalUid);
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        try {
          const signCred = await signInWithEmailAndPassword(auth, email, authPassword);
          finalUid = signCred.user.uid;
          console.log('Successfully signed in existing user in Firebase Auth Users list:', email, finalUid);
        } catch (e) {
          console.warn('Sign-in fallback during sync:', e);
        }
      } else {
        console.warn('Firebase Auth create error during sync:', authErr?.code || authErr);
      }
    }

    if (user.uid && user.uid !== finalUid) {
      deleteUserAccount(user.uid).catch(e => console.warn('Old user cleanup error:', e));
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
    console.log('Successfully synced User to solimedical-micu Firebase Auth & Firestore (default) database.');
  } catch (err) {
    console.warn('Error during syncUserToFirebaseConsole:', err);
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
  // Asynchronous non-blocking Cloud Firestore write
  setDoc(doc(firestore, 'users', user.uid), user, { merge: true }).catch((err) => {
    console.warn('Background Firestore save user warning:', err);
  });
  if (user.role === StaffRole.ADMIN || user.isSuperAdmin) {
    setDoc(doc(firestore, 'admins', user.uid), {
      uid: user.uid,
      email: user.email,
      nameEn: user.nameEn,
      nameAr: user.nameAr,
      createdAt: user.createdAt,
    }, { merge: true }).catch((err) => {
      console.warn('Background Firestore save admin warning:', err);
    });
  }
}

/**
 * Fetch all users from cloud and sync with local DB, automatically purging duplicate records
 */
export async function fetchAllUsers(): Promise<IcuUser[]> {
  let rawList: IcuUser[] = [];
  try {
    const snap = await getDocs(collection(firestore, 'users'));
    snap.forEach((d) => {
      rawList.push(d.data() as IcuUser);
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }

  const localList = await db.users.toArray();
  for (const u of localList) {
    if (!rawList.some(r => r.uid === u.uid)) {
      rawList.push(u);
    }
  }

  // Deduplicate by email / badgeId
  const uniqueUsersMap = new Map<string, IcuUser>();
  const duplicatesToDelete: string[] = [];

  for (const user of rawList) {
    const key = (user.email || user.badgeId || user.uid).toLowerCase().trim();
    if (!uniqueUsersMap.has(key)) {
      uniqueUsersMap.set(key, user);
    } else {
      const existing = uniqueUsersMap.get(key)!;
      // Keep the one with newer lastLoginAt or name updated or superAdmin flag
      const isUserNewer = (user.lastLoginAt || user.createdAt || '') > (existing.lastLoginAt || existing.createdAt || '');
      if (isUserNewer || (user.isSuperAdmin && !existing.isSuperAdmin)) {
        duplicatesToDelete.push(existing.uid);
        uniqueUsersMap.set(key, user);
      } else {
        duplicatesToDelete.push(user.uid);
      }
    }
  }

  // Purge duplicate records from local DB and Firestore
  for (const dupUid of duplicatesToDelete) {
    deleteUserAccount(dupUid).catch(err => console.warn('Purge duplicate user warning:', err));
  }

  const finalUsers = Array.from(uniqueUsersMap.values());
  await db.users.clear();
  await db.users.bulkPut(finalUsers);

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

  try {
    // 1. Subscribe to Beds
    const bedsCol = collection(firestore, 'beds');
    const unsubBeds = onSnapshot(bedsCol, async (snapshot) => {
      const remoteBeds: BedRecord[] = [];
      snapshot.forEach((docSnap) => {
        remoteBeds.push(docSnap.data() as BedRecord);
      });
      if (remoteBeds.length > 0) {
        await db.beds.bulkPut(remoteBeds);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'beds'));
    unsubscribers.push(unsubBeds);

    // 2. Subscribe to Patients
    const patientsCol = collection(firestore, 'patients');
    const unsubPatients = onSnapshot(patientsCol, async (snapshot) => {
      const remotePatients: PatientDossier[] = [];
      snapshot.forEach((docSnap) => {
        remotePatients.push(docSnap.data() as PatientDossier);
      });
      if (remotePatients.length > 0) {
        await db.patients.bulkPut(remotePatients);
        onDataUpdate();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'patients'));
    unsubscribers.push(unsubPatients);

    // 3. Subscribe to Real-Time Vitals with Alarm Checks
    const vitalsCol = collection(firestore, 'vitals');
    const vitalsQuery = query(vitalsCol, orderBy('timestamp', 'desc'), limit(30));
    const unsubVitals = onSnapshot(vitalsQuery, async (snapshot) => {
      const remoteVitals: TelemetryVitals[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
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
        onDataUpdate();
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

  } catch (e) {
    console.warn('Could not establish Firestore real-time listener:', e);
  }

  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

// -------------------------------------------------------------
// Cloud Push Operations (Firestore Broadcast)
// -------------------------------------------------------------

export async function syncBedToCloud(bed: BedRecord): Promise<void> {
  try {
    const bedRef = doc(firestore, 'beds', bed.bedNumber);
    await setDoc(bedRef, bed, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `beds/${bed.bedNumber}`);
  }
}

export async function syncPatientToCloud(patient: PatientDossier): Promise<void> {
  try {
    const patRef = doc(firestore, 'patients', patient.id);
    await setDoc(patRef, patient, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `patients/${patient.id}`);
  }
}

export async function syncVitalsToCloud(vitals: TelemetryVitals): Promise<void> {
  try {
    const vitRef = doc(firestore, 'vitals', vitals.id);
    await setDoc(vitRef, vitals);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `vitals/${vitals.id}`);
  }
}

export async function syncSbarToCloud(sbar: SbarHandoverReport): Promise<void> {
  try {
    const sbarRef = doc(firestore, 'sbarHandovers', sbar.id);
    await setDoc(sbarRef, sbar, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sbarHandovers/${sbar.id}`);
  }
}

export async function syncClinicalNoteToCloud(note: ClinicalNote): Promise<void> {
  try {
    const noteRef = doc(firestore, 'clinicalNotes', note.id);
    await setDoc(noteRef, note, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clinicalNotes/${note.id}`);
  }
}

export async function syncVentilatorToCloud(vent: VentilatorParameters): Promise<void> {
  try {
    const ventRef = doc(firestore, 'ventilators', vent.id);
    await setDoc(ventRef, vent, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `ventilators/${vent.id}`);
  }
}

export async function syncPumpToCloud(pump: InfusionPumpLine): Promise<void> {
  try {
    const pumpRef = doc(firestore, 'infusionPumps', pump.id);
    await setDoc(pumpRef, pump, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `infusionPumps/${pump.id}`);
  }
}

export async function syncFluidBalanceToCloud(fluid: FluidBalance24H): Promise<void> {
  try {
    const fluidRef = doc(firestore, 'fluidBalances', fluid.id);
    await setDoc(fluidRef, fluid, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `fluidBalances/${fluid.id}`);
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
      console.log('Firebase Cloud Data Seeded successfully!');
    }
  } catch (e) {
    console.warn('Could not complete initial Firestore cloud seed:', e);
  }
}
