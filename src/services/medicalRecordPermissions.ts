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
  createdByUid?: string;
  doctorId?: string;
  authorId?: string;
  authorStaffId?: string;
  recordedByStaffId?: string;
  userId?: string;
  transferredBy?: string;
  createdAt?: number | string;
}

/**
 * Validates if a user is authorized to edit a specific medical record.
 * Rules:
 * 1. ADMIN (or Super Admin) can edit ALL records.
 * 2. Doctor / Clinician can edit ONLY records created by themselves (matching UID or staff/badge ID).
 * 3. Ordinary doctors CANNOT edit records created by other doctors.
 * 4. Fails closed if user is null or record has no user context.
 */
export function canEditRecord(
  user: UserContextForPermission | null | undefined,
  record: RecordOwnershipContext | null | undefined
): boolean {
  if (!user || !user.uid) return false;

  // Rule: ADMIN can edit all records
  if (user.role === StaffRole.ADMIN || user.role === 'ADMIN' || user.isSuperAdmin === true) {
    return true;
  }

  if (!record) return false;

  // Collect all potential owner identifiers from the record
  const ownerIds = [
    record.createdByUid,
    record.doctorId,
    record.authorId,
    record.authorStaffId,
    record.recordedByStaffId,
    record.userId,
    record.transferredBy,
  ].filter(Boolean) as string[];

  if (ownerIds.length === 0) {
    // Fail closed if record lacks ownership information
    return false;
  }

  // Check if current user's UID or staff/badge ID matches any owner ID
  const userIdsToCheck = [user.uid, user.badgeId, user.staffId].filter(Boolean) as string[];

  return ownerIds.some((ownerId) =>
    userIdsToCheck.some((userId) => ownerId === userId || ownerId === `staff-${userId}`)
  );
}

/**
 * Validates if a user is authorized to delete a record.
 * Rules:
 * 1. Doctors CANNOT delete records just because they can edit.
 * 2. Only ADMIN can perform deletions according to retention and deletion policy.
 */
export function canDeleteRecord(user: UserContextForPermission | null | undefined): boolean {
  if (!user || !user.uid) return false;
  return (
    user.role === StaffRole.ADMIN ||
    user.role === 'ADMIN' ||
    user.isSuperAdmin === true ||
    user.permissions?.['medicalRecords.delete'] === true
  );
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
