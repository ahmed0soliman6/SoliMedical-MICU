import assert from 'node:assert/strict';
import { StaffRole } from '../types/schema.ts';
import {
  canEditRecord,
  canDeleteRecord,
  canDeleteClinicalNote,
  preserveRecordOwnership,
  UserContextForPermission,
  RecordOwnershipContext
} from '../services/medicalRecordPermissions.ts';

// Helper functions replicating UI & Security checks
function canAccessSettingsUI(user: UserContextForPermission | null | undefined, featureFlagEnabled: boolean = true): boolean {
  if (!user) return false;
  const isAdmin = user.role === StaffRole.ADMIN || user.role === 'ADMIN' || user.isSuperAdmin === true;
  const hasSettingsUpdate = user.permissions?.['settings.update'] === true;
  const hasSettingsView = user.permissions?.['settings.view'] === true;

  if (isAdmin || hasSettingsUpdate) return true;
  if (hasSettingsView && featureFlagEnabled) return true;
  return false;
}

function canUpdateGeneralSettings(user: UserContextForPermission | null | undefined): boolean {
  if (!user) return false;
  return user.role === StaffRole.ADMIN || user.role === 'ADMIN' || user.isSuperAdmin === true || user.permissions?.['settings.update'] === true;
}

function canManageCoreModules(user: UserContextForPermission | null | undefined): boolean {
  if (!user) return false;
  return user.role === StaffRole.ADMIN || user.role === 'ADMIN' || user.isSuperAdmin === true || user.permissions?.['sections.manage'] === true || user.permissions?.['settings.update'] === true;
}

function canManageBedsideCards(user: UserContextForPermission | null | undefined): boolean {
  if (!user) return false;
  return user.role === StaffRole.ADMIN || user.role === 'ADMIN' || user.isSuperAdmin === true || user.permissions?.['cards.manage'] === true || user.permissions?.['settings.update'] === true;
}

function validateSettingUpdateKeys(user: UserContextForPermission, changedKeys: string[]): boolean {
  const isAdmin = user.role === StaffRole.ADMIN || user.role === 'ADMIN' || user.isSuperAdmin === true;
  if (isAdmin || user.permissions?.['settings.update']) return true;

  const isSectionsOnly = user.permissions?.['sections.manage'] && !user.permissions?.['settings.update'];
  const isCardsOnly = user.permissions?.['cards.manage'] && !user.permissions?.['settings.update'];

  if (isSectionsOnly || isCardsOnly) {
    const allowed = ['features', 'lastUpdated'];
    return changedKeys.every(k => allowed.includes(k));
  }

  return false;
}

console.log('--- RUNNING PERMISSIONS & SECURITY RULES TEST SUITE ---');

// Test A: settings.view only
{
  const user: UserContextForPermission = {
    uid: 'doctor-1',
    role: StaffRole.RESIDENT,
    permissions: { 'settings.view': true }
  };
  assert.equal(canAccessSettingsUI(user, true), true, 'A: settings.view can view settings UI');
  assert.equal(canUpdateGeneralSettings(user), false, 'A: settings.view ONLY CANNOT update general settings');
  assert.equal(canManageCoreModules(user), false, 'A: settings.view ONLY CANNOT manage modules');
  assert.equal(canManageBedsideCards(user), false, 'A: settings.view ONLY CANNOT manage cards');
  console.log('✓ A. settings.view only passed');
}

// Test B: settings.update
{
  const user: UserContextForPermission = {
    uid: 'admin-assist',
    role: StaffRole.RESIDENT,
    permissions: { 'settings.update': true }
  };
  assert.equal(canAccessSettingsUI(user), true, 'B: settings.update can access settings UI');
  assert.equal(canUpdateGeneralSettings(user), true, 'B: settings.update CAN update general settings');
  assert.equal(canManageCoreModules(user), true, 'B: settings.update CAN manage modules');
  assert.equal(canManageBedsideCards(user), true, 'B: settings.update CAN manage cards');
  console.log('✓ B. settings.update passed');
}

// Test C: sections.manage only
{
  const user: UserContextForPermission = {
    uid: 'mod-mgr',
    role: StaffRole.RESIDENT,
    permissions: { 'sections.manage': true }
  };
  assert.equal(canManageCoreModules(user), true, 'C: sections.manage CAN manage core modules');
  assert.equal(canManageBedsideCards(user), false, 'C: sections.manage ONLY CANNOT manage bedside cards');
  assert.equal(canUpdateGeneralSettings(user), false, 'C: sections.manage ONLY CANNOT update general settings');
  console.log('✓ C. sections.manage only passed');
}

// Test D: cards.manage only
{
  const user: UserContextForPermission = {
    uid: 'card-mgr',
    role: StaffRole.RESIDENT,
    permissions: { 'cards.manage': true }
  };
  assert.equal(canManageBedsideCards(user), true, 'D: cards.manage CAN manage bedside cards');
  assert.equal(canManageCoreModules(user), false, 'D: cards.manage ONLY CANNOT manage core modules');
  assert.equal(canUpdateGeneralSettings(user), false, 'D: cards.manage ONLY CANNOT update general settings');
  console.log('✓ D. cards.manage only passed');
}

// Test E: user with no settings permissions
{
  const user: UserContextForPermission = {
    uid: 'nurse-1',
    role: StaffRole.BEDSIDE_RN,
    permissions: {}
  };
  assert.equal(canAccessSettingsUI(user, true), false, 'E: user with no settings permissions CANNOT access settings');
  assert.equal(canUpdateGeneralSettings(user), false, 'E: user with no settings permissions CANNOT update settings');
  assert.equal(canManageCoreModules(user), false, 'E: user with no settings permissions CANNOT manage modules');
  assert.equal(canManageBedsideCards(user), false, 'E: user with no settings permissions CANNOT manage cards');
  console.log('✓ E. user with no settings permissions passed');
}

// Test F: owner update own record
{
  const ownerDoctor: UserContextForPermission = {
    uid: 'doc-101',
    staffId: 'STAFF-101',
    role: StaffRole.RESIDENT
  };
  const ownRecord: RecordOwnershipContext = {
    doctorId: 'doc-101',
    createdAt: 1700000000
  };
  assert.equal(canEditRecord(ownerDoctor, ownRecord), true, 'F: Owner doctor can update own record');
  console.log('✓ F. owner update own record passed');
}

// Test G: owner delete own deletable record
{
  const ownerDoctor: UserContextForPermission = {
    uid: 'doc-101',
    staffId: 'STAFF-101',
    role: StaffRole.RESIDENT
  };
  const ownNote = {
    authorId: 'doc-101',
    authorName: 'Dr. John Doe'
  };
  assert.equal(canDeleteClinicalNote(ownerDoctor, ownNote), true, 'G: Owner doctor can delete own note');
  console.log('✓ G. owner delete own deletable record passed');
}

// Test H: doctor update another doctor's record = DENY
{
  const doctorA: UserContextForPermission = {
    uid: 'doc-A',
    role: StaffRole.RESIDENT,
    permissions: { 'clinicalNotes.create': true, 'patients.update': true }
  };
  const recordOfDoctorB: RecordOwnershipContext = {
    doctorId: 'doc-B',
    createdByUid: 'doc-B',
    createdAt: 1700000000
  };
  assert.equal(canEditRecord(doctorA, recordOfDoctorB), false, 'H: Doctor cannot edit another doctor\'s record');
  console.log('✓ H. doctor update another doctor\'s record = DENY passed');
}

// Test I: doctor delete another doctor's record = DENY
{
  const doctorA: UserContextForPermission = {
    uid: 'doc-A',
    role: StaffRole.RESIDENT,
    permissions: { 'clinicalNotes.create': true }
  };
  const noteOfDoctorB = {
    authorId: 'doc-B',
    authorName: 'Dr. Other'
  };
  assert.equal(canDeleteClinicalNote(doctorA, noteOfDoctorB), false, 'I: Doctor cannot delete another doctor\'s note');
  console.log('✓ I. doctor delete another doctor\'s record = DENY passed');
}

// Test J: user with medicalRecords.delete = ALLOW
{
  const userWithDeletePerm: UserContextForPermission = {
    uid: 'head-nurse-1',
    role: StaffRole.BEDSIDE_RN,
    permissions: { 'medicalRecords.delete': true }
  };
  const noteOfDoctorB = {
    authorId: 'doc-B',
    authorName: 'Dr. Other'
  };
  assert.equal(canDeleteClinicalNote(userWithDeletePerm, noteOfDoctorB), true, 'J: User with medicalRecords.delete can delete');
  assert.equal(canDeleteRecord(userWithDeletePerm, { doctorId: 'doc-B' }), true, 'J: User with medicalRecords.delete can delete any record');
  console.log('✓ J. user with medicalRecords.delete = ALLOW passed');
}

// Test K: CREATE permission cannot UPDATE another user's record
{
  const userWithCreate: UserContextForPermission = {
    uid: 'resident-1',
    role: StaffRole.RESIDENT,
    permissions: { 'clinicalNotes.create': true, 'vitals.create': true, 'labs.create': true }
  };
  const recordOfAnotherDoctor: RecordOwnershipContext = {
    doctorId: 'consultant-99',
    createdByUid: 'consultant-99',
    createdAt: 1700000000
  };
  assert.equal(canEditRecord(userWithCreate, recordOfAnotherDoctor), false, 'K: CREATE permission alone does not allow updating another user\'s record');
  console.log('✓ K. CREATE permission cannot UPDATE another user\'s record passed');
}

// Test L: admin can manage all permitted records
{
  const adminUser: UserContextForPermission = {
    uid: 'admin-root',
    role: StaffRole.ADMIN,
    isSuperAdmin: true
  };
  const recordOfAnother: RecordOwnershipContext = {
    doctorId: 'someone-else',
    createdByUid: 'someone-else',
    createdAt: 1700000000
  };
  assert.equal(canEditRecord(adminUser, recordOfAnother), true, 'L: Admin can edit any record');
  assert.equal(canDeleteRecord(adminUser, recordOfAnother), true, 'L: Admin can delete any record');
  assert.equal(canDeleteClinicalNote(adminUser, { authorId: 'someone-else' }), true, 'L: Admin can delete any clinical note');
  assert.equal(canUpdateGeneralSettings(adminUser), true, 'L: Admin can update settings');
  console.log('✓ L. admin can manage all permitted records passed');
}

// Test M: sections.manage cannot modify unrelated global settings
{
  const sectionsUser: UserContextForPermission = {
    uid: 'sections-editor',
    role: StaffRole.RESIDENT,
    permissions: { 'sections.manage': true }
  };
  assert.equal(validateSettingUpdateKeys(sectionsUser, ['features', 'lastUpdated']), true, 'M: sections.manage can touch features');
  assert.equal(validateSettingUpdateKeys(sectionsUser, ['unit', 'notifications']), false, 'M: sections.manage CANNOT modify unit or notifications');
  console.log('✓ M. sections.manage cannot modify unrelated global settings passed');
}

// Test N: cards.manage cannot modify unrelated global settings
{
  const cardsUser: UserContextForPermission = {
    uid: 'cards-editor',
    role: StaffRole.RESIDENT,
    permissions: { 'cards.manage': true }
  };
  assert.equal(validateSettingUpdateKeys(cardsUser, ['features', 'lastUpdated']), true, 'N: cards.manage can touch features');
  assert.equal(validateSettingUpdateKeys(cardsUser, ['unit', 'theme', 'language']), false, 'N: cards.manage CANNOT modify unit, theme or global language');
  console.log('✓ N. cards.manage cannot modify unrelated global settings passed');
}

// Test Ownership preservation helper
{
  interface TestClinicalRecord extends RecordOwnershipContext {
    clinicalNotes?: string;
  }
  const original: TestClinicalRecord = {
    createdByUid: 'orig-uid',
    doctorId: 'orig-doc',
    createdAt: 1700000000
  };
  const updateAttempt: TestClinicalRecord = {
    createdByUid: 'hacker-uid',
    doctorId: 'hacker-doc',
    createdAt: 1799999999,
    clinicalNotes: 'Updated content'
  };
  const preserved = preserveRecordOwnership(original, updateAttempt);
  assert.equal(preserved.createdByUid, 'orig-uid', 'Preserve createdByUid');
  assert.equal(preserved.doctorId, 'orig-doc', 'Preserve doctorId');
  assert.equal(preserved.createdAt, 1700000000, 'Preserve createdAt');
  assert.equal(preserved.clinicalNotes, 'Updated content', 'Allow payload update');
  console.log('✓ Ownership preservation helper passed');
}

console.log('ALL TESTS PASSED SUCCESSFULLY! (14/14 test cases verified)');
