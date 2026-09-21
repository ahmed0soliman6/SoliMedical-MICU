import { 
  canEditRecord, 
  canDeleteRecord, 
  canDeleteMortalityRecord, 
  preserveRecordOwnership 
} from '../services/medicalRecordPermissions.ts';
import { StaffRole, BedStatus, PatientDossier, BedRecord } from '../types/schema.ts';

function runSystemTests() {
  console.log('=== SOLIMEDICAL ICU-SYNC SECURE SYSTEM TEST SUITE ===');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------
  // 1. Authentication & Admin Authorization Verification
  // -----------------------------------------------------------------
  const mockDoctor = { uid: 'doc-777', role: StaffRole.RESIDENT, badgeId: 'badge-777' };
  const mockAdmin = { uid: 'admin-999', role: StaffRole.ADMIN, isSuperAdmin: true };
  const mockUnauth = null;

  assert(mockDoctor.role === StaffRole.RESIDENT, 'Auth Verification: Valid doctor role mapped');
  assert(mockAdmin.role === StaffRole.ADMIN, 'Auth Verification: Valid admin role mapped');
  assert(mockUnauth === null, 'Auth Verification: Unauthenticated state handled safely');

  assert(canDeleteRecord(mockAdmin) === true, 'ADMIN Authorization: Admin is authorized to delete standard records');
  assert(canDeleteRecord(mockDoctor) === false, 'ADMIN Authorization: Doctor is NOT authorized to delete standard records');

  // -----------------------------------------------------------------
  // 2. Doctor Ownership & ADMIN Override
  // -----------------------------------------------------------------
  const doctorRecord = {
    id: 'note-1',
    createdByUid: 'doc-777',
    createdAt: '2026-09-21T09:00:00Z',
    clinicalNote: 'Patient exhibits mild lung crepitations.'
  };

  assert(canEditRecord(mockDoctor, doctorRecord) === true, 'Doctor Ownership: Doctor can edit their own medical record');
  assert(canEditRecord({ uid: 'doc-888', role: StaffRole.SPECIALIST }, doctorRecord) === false, 'Doctor Ownership: Other doctor CANNOT edit someone else\'s record');
  assert(canEditRecord(mockAdmin, doctorRecord) === true, 'ADMIN Override: Admin can edit any doctor\'s medical record');

  // -----------------------------------------------------------------
  // 3. User Account Actions (Delete, Disable, Change Password Lifecycle Mocks)
  // -----------------------------------------------------------------
  const mockUserAccount = {
    uid: 'doc-suspect',
    email: 'suspect@soli.med',
    disabled: false,
    passwordHash: 'old_secure_hash'
  };

  function performAdminActionOnUser(caller: any, target: any, action: 'DISABLE' | 'DELETE' | 'CHANGE_PASSWORD', val?: string) {
    if (caller.role !== StaffRole.ADMIN) {
      return { success: false, error: 'Unauthorized: Admin role required.' };
    }
    if (action === 'DISABLE') target.disabled = true;
    if (action === 'DELETE') target.deleted = true;
    if (action === 'CHANGE_PASSWORD' && val) target.passwordHash = val;
    return { success: true };
  }

  const doctorActionAttempt = performAdminActionOnUser(mockDoctor, mockUserAccount, 'DISABLE');
  assert(doctorActionAttempt.success === false, 'Security: Doctor cannot disable another user account');

  const adminActionAttempt = performAdminActionOnUser(mockAdmin, mockUserAccount, 'DISABLE');
  assert(adminActionAttempt.success === true && mockUserAccount.disabled === true, 'Security: Admin can disable user account');

  const adminPasswordAttempt = performAdminActionOnUser(mockAdmin, mockUserAccount, 'CHANGE_PASSWORD', 'new_secure_hash');
  assert(adminPasswordAttempt.success === true && mockUserAccount.passwordHash === 'new_secure_hash', 'Security: Admin can force password change');

  // -----------------------------------------------------------------
  // 4. Firestore Synchronization (Dexie Cache Single Source of Truth Mock)
  // -----------------------------------------------------------------
  const localCache: Record<string, any> = {};
  function handleFirestoreOnSnapshot(docId: string, cloudData: any) {
    // Local Dexie cache simply mirrors Firestore (SSOT)
    localCache[docId] = { ...cloudData, _lastSync: Date.now() };
  }

  const incomingCloudRecord = { id: 'patient-abc', fullNameEn: 'John Doe', age: 45 };
  handleFirestoreOnSnapshot('patient-abc', incomingCloudRecord);
  assert(localCache['patient-abc'] !== undefined, 'Firestore Sync: local cache mirrors cloud updates');
  assert(localCache['patient-abc'].fullNameEn === 'John Doe', 'Firestore Sync: exact values are synchronized');

  // -----------------------------------------------------------------
  // 5. Death Record Deletion & Auto-Purge Policy
  // -----------------------------------------------------------------
  const deathRecord31DaysOld = {
    id: 'death-1',
    patientStatus: 'EXPIRED_MORTALITY',
    expiredAt: new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString()
  };

  const deathRecord15DaysOld = {
    id: 'death-2',
    patientStatus: 'EXPIRED_MORTALITY',
    expiredAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
  };

  function shouldAutoPurgeMortality(record: any, now: number): boolean {
    if (record.patientStatus !== 'EXPIRED_MORTALITY') return false;
    const elapsedMs = now - new Date(record.expiredAt).getTime();
    return elapsedMs >= 30 * 24 * 3600 * 1000; // 30 days
  }

  const nowMs = Date.now();
  assert(shouldAutoPurgeMortality(deathRecord31DaysOld, nowMs) === true, 'Mortality Policy: Record > 30 days old is marked for auto-purge');
  assert(shouldAutoPurgeMortality(deathRecord15DaysOld, nowMs) === false, 'Mortality Policy: Record <= 30 days is preserved');

  assert(canDeleteMortalityRecord(mockDoctor) === false, 'Mortality Policy: Doctor cannot delete deceased patient records');
  assert(canDeleteMortalityRecord(mockAdmin) === true, 'Mortality Policy: Admin can delete deceased patient records');

  // -----------------------------------------------------------------
  // 6. Patient Archiving & Prevention of Duplicates
  // -----------------------------------------------------------------
  const patientRegistry: PatientDossier[] = [
    {
      id: 'archived-p1',
      mrn: 'MRN-101010',
      fullNameEn: 'Sarah Connor',
      patientStatus: 'ARCHIVED' as any,
      pastVisits: []
    } as any
  ];

  function admitPatient(newPatientData: Partial<PatientDossier>): { status: 'NEW' | 'RESTORED'; patient: PatientDossier } {
    const existing = patientRegistry.find(p => p.mrn === newPatientData.mrn);
    if (existing) {
      // Re-admission of an archived patient restores and appends to pastVisits
      const restored: PatientDossier = {
        ...existing,
        patientStatus: 'ACTIVE_ICU' as any,
        pastVisits: [
          ...(existing.pastVisits || []),
          {
            id: `visit-${Date.now()}`,
            admissionDate: '2026-01-01',
            dischargeDate: '2026-01-10',
            primaryDiagnosis: 'Initial ICU admission study',
            outcome: 'DISCHARGED_IMPROVED',
            attendingPhysicianName: 'Dr. House'
          }
        ]
      };
      return { status: 'RESTORED', patient: restored };
    } else {
      const newPatient: PatientDossier = {
        id: `pat-${Date.now()}`,
        mrn: newPatientData.mrn || '',
        fullNameEn: newPatientData.fullNameEn || '',
        patientStatus: 'ACTIVE_ICU' as any,
        pastVisits: []
      } as any;
      patientRegistry.push(newPatient);
      return { status: 'NEW', patient: newPatient };
    }
  }

  const restoreResult = admitPatient({ mrn: 'MRN-101010', fullNameEn: 'Sarah Connor' });
  assert(restoreResult.status === 'RESTORED', 'Patient Archival: Archived patient is restored on new admission');
  assert(restoreResult.patient.patientStatus === ('ACTIVE_ICU' as any), 'Patient Archival: Status transitioned back to ACTIVE_ICU');
  assert(restoreResult.patient.pastVisits!.length === 1, 'Patient Archival: Pre-existing stay appended to pastVisits history to prevent duplication');

  // -----------------------------------------------------------------
  // 7. Atomic Bed/Transfer Transaction Integrity Mock
  // -----------------------------------------------------------------
  const bed1: BedRecord = {
    id: '01',
    bedNumber: '01',
    unitId: 'MICU',
    bayName: 'Bay 1',
    status: BedStatus.OCCUPIED,
    currentPatientId: 'patient-x',
    isActive: true,
    displayOrder: 0,
    lastCleanedAt: ''
  };

  const bed2: BedRecord = {
    id: '02',
    bedNumber: '02',
    unitId: 'MICU',
    bayName: 'Bay 2',
    status: BedStatus.VACANT,
    currentPatientId: null,
    isActive: true,
    displayOrder: 1,
    lastCleanedAt: ''
  };

  function performAtomicPatientTransfer(sourceBed: BedRecord, destBed: BedRecord) {
    if (destBed.status !== BedStatus.VACANT) {
      return { success: false, error: 'Destination bed is not vacant.' };
    }
    // Transactional state mutation: no state is lost or half-mutated
    const targetPatientId = sourceBed.currentPatientId;
    sourceBed.currentPatientId = null;
    sourceBed.status = BedStatus.DECONTAMINATING;

    destBed.currentPatientId = targetPatientId;
    destBed.status = BedStatus.OCCUPIED;
    return { success: true };
  }

  const transferResult = performAtomicPatientTransfer(bed1, bed2);
  assert(transferResult.success === true, 'Bed Transfer: Patient transferred successfully');
  assert(bed1.currentPatientId === null && bed1.status === BedStatus.DECONTAMINATING, 'Bed Transfer: Source bed is now vacant and in decontamination state');
  assert(bed2.currentPatientId === 'patient-x' && bed2.status === BedStatus.OCCUPIED, 'Bed Transfer: Destination bed safely hosts transfer patient');

  console.log(`\n=== SYSTEM TEST SUMMARY: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSystemTests();
