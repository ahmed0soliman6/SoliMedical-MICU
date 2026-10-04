import { StaffRole } from '../types/schema.ts';

export interface UserContextForPermission {
  uid: string;
  badgeId?: string;
  staffId?: string;
  role?: StaffRole | string;
  isSuperAdmin?: boolean;
  permissions?: any;
}

export interface RecordOwnershipContext {
  id?: string;
  createdBy?: string;
  createdByUid?: string;
  doctorId?: string;
  authorId?: string;
  authorUid?: string;
  authorStaffId?: string;
  recordedByStaffId?: string;
  userId?: string;
  transferredBy?: string;
  createdAt?: number | string;
  recordedBy?: {
    staffId?: string;
    name?: string;
  };
  authorName?: string;
}

export type CategoryPermissionKey = 'vitals' | 'labs' | 'investigations' | 'clinicalNotes' | 'handovers' | 'sbar';

/**
 * Validates if a user is authorized to edit/update a specific medical record.
 */
export function canEditRecord(
  user: UserContextForPermission | any | null | undefined,
  record?: RecordOwnershipContext | any | null | undefined,
  categoryKey: CategoryPermissionKey = 'vitals'
): boolean {
  if (!user || !user.uid) return false;

  if (
    user.role === StaffRole.ADMIN ||
    user.role === 'ADMIN' ||
    user.role === 'admin' ||
    user.role === 'SUPER_ADMIN' ||
    user.isSuperAdmin === true ||
    user.permissions?.['admin'] === true
  ) {
    return true;
  }

  const updateKey = categoryKey === 'sbar' ? 'sbar.update' : `${categoryKey}.update`;
  const altKey = categoryKey === 'handovers' ? 'sbar.update' : (categoryKey === 'sbar' ? 'handovers.update' : undefined);

  return Boolean(
    user.permissions?.[updateKey] === true ||
    (altKey && user.permissions?.[altKey] === true) ||
    user.permissions?.[`${categoryKey}.create`] === true
  );
}

/**
 * Validates if a user is authorized to delete a specific medical record.
 * Supports two tiers of deletion authority:
 * 1. Level 2 (Universal Delete Any): Admin / Super Admin OR medicalRecords.delete / medicalRecords.deleteAny
 * 2. Level 1 (Delete Own Records): <categoryKey>.deleteOwn AND record creator matches current user
 */
export const canDeleteMedicalRecord = (
  user: UserContextForPermission | any | null | undefined,
  record?: RecordOwnershipContext | any | null | undefined,
  categoryKey: CategoryPermissionKey = 'vitals'
): boolean => {
  if (!user || !user.uid) return false;

  // 1. Level 2 (Delete Any) or Admin Tier
  if (
    user.role === StaffRole.ADMIN ||
    user.role === 'ADMIN' ||
    user.role === 'admin' ||
    user.role === 'SUPER_ADMIN' ||
    user.isSuperAdmin === true ||
    user.permissions?.['admin'] === true ||
    user.permissions?.['medicalRecords.delete'] === true ||
    user.permissions?.['medicalRecords.deleteAny'] === true
  ) {
    return true;
  }

  if (!record) return false;

  // 2. Level 1 (Delete Own Records)
  const permKey = categoryKey === 'sbar' ? 'sbar.deleteOwn' : `${categoryKey}.deleteOwn`;
  const altKey = categoryKey === 'handovers' ? 'sbar.deleteOwn' : (categoryKey === 'sbar' ? 'handovers.deleteOwn' : undefined);

  const hasOwnDeletePermission = Boolean(
    user.permissions?.[permKey] === true ||
    (altKey && user.permissions?.[altKey] === true) ||
    user.permissions?.[`${categoryKey}.delete`] === true
  );

  if (!hasOwnDeletePermission) return false;

  const recordCreator =
    record.createdBy ||
    record.createdByUid ||
    record.authorId ||
    record.authorUid ||
    record.userId ||
    record.doctorId ||
    record.authorStaffId ||
    record.recordedByStaffId ||
    record.recordedBy?.staffId;

  const isCreator = Boolean(
    (recordCreator && (recordCreator === user.uid || recordCreator === `staff-${user.uid}`)) ||
    (user.badgeId && recordCreator && (recordCreator === user.badgeId || recordCreator === `staff-${user.badgeId}`)) ||
    (user.nameAr && record.authorName && record.authorName === user.nameAr) ||
    (user.nameEn && record.authorName && record.authorName === user.nameEn) ||
    (user.displayName && record.authorName && record.authorName === user.displayName)
  );

  return isCreator;
};

/**
 * Validates if a user is authorized to delete a record.
 */
export function canDeleteRecord(
  user: UserContextForPermission | any | null | undefined,
  record?: RecordOwnershipContext | RecordOwnershipContext[] | any | null | undefined,
  categoryKey: CategoryPermissionKey = 'vitals'
): boolean {
  if (Array.isArray(record)) {
    return record.every(r => canDeleteMedicalRecord(user, r, categoryKey));
  }
  return canDeleteMedicalRecord(user, record, categoryKey);
}

/**
 * Validates if a user is authorized to delete a clinical progress note or consultation note.
 */
export function canDeleteClinicalNote(
  user: UserContextForPermission | any | null | undefined,
  note?: RecordOwnershipContext | any | null | undefined
): boolean {
  return canDeleteMedicalRecord(user, note, 'clinicalNotes');
}

/**
 * Validates if a user is authorized to manually delete a deceased/mortality record.
 * Rules:
 * 1. Deletion from mortality section is available ONLY to ADMIN.
 */
export function canDeleteMortalityRecord(user: UserContextForPermission | null | undefined): boolean {
  if (!user || !user.uid) return false;
  return user.role === StaffRole.ADMIN || user.role === 'ADMIN' || user.isSuperAdmin === true;
}

/**
 * Preserves original ownership and creation timestamp when updating a record.
 * Ensures createdAt, createdByUid, doctorId, authorId, recordedByStaffId cannot be changed during update.
 */
export function preserveRecordOwnership<T extends RecordOwnershipContext>(
  existingRecord: T,
  updatePayload: Partial<T>
): Partial<T> {
  const result = { ...updatePayload };

  if (existingRecord.createdAt !== undefined) {
    result.createdAt = existingRecord.createdAt;
  }
  if (existingRecord.createdByUid !== undefined) {
    result.createdByUid = existingRecord.createdByUid;
  }
  if (existingRecord.doctorId !== undefined) {
    result.doctorId = existingRecord.doctorId;
  }
  if (existingRecord.authorId !== undefined) {
    result.authorId = existingRecord.authorId;
  }
  if (existingRecord.authorStaffId !== undefined) {
    result.authorStaffId = existingRecord.authorStaffId;
  }
  if (existingRecord.recordedByStaffId !== undefined) {
    result.recordedByStaffId = existingRecord.recordedByStaffId;
  }
  if (existingRecord.userId !== undefined) {
    result.userId = existingRecord.userId;
  }

  return result;
}

/**
 * Validates if a user is authorized to append an addendum / reply to a clinical note.
 * In ICU, any authenticated clinician can append an immutable addendum/reply.
 */
export function canAppendAddendum(user: UserContextForPermission | null | undefined): boolean {
  return !!(user && user.uid);
}
