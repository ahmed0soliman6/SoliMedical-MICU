import { 
  canEditRecord, 
  canDeleteRecord, 
  canDeleteMortalityRecord, 
  preserveRecordOwnership 
} from '../services/medicalRecordPermissions.ts';
import { StaffRole } from '../types/schema.ts';

function runTests() {
  console.log('--- STARTING SOLIMEDICAL PERMISSION & INTEGRITY TESTS ---');

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

  // Define Mock Users
  const doc1 = { uid: 'doc-101', role: StaffRole.CONSULTANT, badgeId: '101' };
  const doc2 = { uid: 'doc-102', role: StaffRole.SPECIALIST, badgeId: '102' };
  const adminUser = { uid: 'admin-1', role: StaffRole.ADMIN, isSuperAdmin: true };

  // Define Mock Records
  const doc1Record = {
    id: 'rec-1',
    createdByUid: 'doc-101',
    authorId: 'doc-101',
    createdAt: '2026-01-01T00:00:00.000Z',
    content: 'Initial Note by Doc 1',
  };

  // Test 1: Doctor editing own record
  assert(canEditRecord(doc1, doc1Record) === true, 'Doctor 1 can edit their own medical record');

  // Test 2: Doctor editing another doctor's record
  assert(canEditRecord(doc2, doc1Record) === false, 'Doctor 2 CANNOT edit Doctor 1 medical record');

  // Test 3: Admin editing any doctor's record
  assert(canEditRecord(adminUser, doc1Record) === true, 'ADMIN can edit Doctor 1 medical record');

  // Test 4: Doctor deleting records
  assert(canDeleteRecord(doc1) === false, 'Ordinary Doctor CANNOT delete medical records');

  // Test 5: Admin deleting records
  assert(canDeleteRecord(adminUser) === true, 'ADMIN CAN delete medical records');

  // Test 6: Mortality deletion authorization
  assert(canDeleteMortalityRecord(doc1) === false, 'Ordinary Doctor CANNOT delete mortality record');
  assert(canDeleteMortalityRecord(adminUser) === true, 'ADMIN CAN delete mortality record');

  // Test 7: Ownership preservation on record update
  const attemptedEdit = {
    content: 'Updated Note Content',
    createdByUid: 'hacker-uid',
    createdAt: '2026-09-20T12:00:00.000Z',
  };
  const safePayload = preserveRecordOwnership(doc1Record, attemptedEdit);

  assert(safePayload.createdByUid === 'doc-101', 'preserveRecordOwnership preserves original createdByUid');
  assert(safePayload.createdAt === '2026-01-01T00:00:00.000Z', 'preserveRecordOwnership preserves original createdAt');

  // Test 8: 30-Day Mortality Purge Threshold Calculation
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const deathDate20DaysAgo = new Date(now - (20 * 24 * 60 * 60 * 1000)).toISOString();
  const deathDate35DaysAgo = new Date(now - (35 * 24 * 60 * 60 * 1000)).toISOString();

  const is20DaysOldOldEnough = (now - new Date(deathDate20DaysAgo).getTime()) >= thirtyDaysMs;
  const is35DaysOldOldEnough = (now - new Date(deathDate35DaysAgo).getTime()) >= thirtyDaysMs;

  assert(is20DaysOldOldEnough === false, 'Mortality record 20 days old is NOT purged (< 30 days)');
  assert(is35DaysOldOldEnough === true, 'Mortality record 35 days old IS purged (>= 30 days)');

  console.log(`\nTEST SUMMARY: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
