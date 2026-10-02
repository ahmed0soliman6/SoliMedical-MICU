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
 * 1. ADMIN (or Super Admin) can delete ALL records.
 * 2. User with explicit 'medicalRecords.delete' permission can delete ALL records.
 * 3. Doctors / Clinicians can delete records created by themselves (matching UID or staff/badge ID).
 */
export function canDeleteRecord(
  user: UserContextForPermission | null | undefined,
  record?: RecordOwnershipContext | RecordOwnershipContext[] | null | undefined
): boolean {
  if (!user || !user.uid) return false;

  // 1. ADMIN / Super Admin can delete all records
  if (user.role === StaffRole.ADMIN || user.role === 'ADMIN' || user.isSuperAdmin === true) {
    return true;
  }

  // 2. User has explicit permission to delete medical records
  if (user.permissions?.['medicalRecords.delete'] === true) {
    return true;
  }

  // 3. User is the creator/owner of the record
  if (record) {
    const recordsToCheck = Array.isArray(record) ? record : [record];
    const userIdsToCheck = [user.uid, user.badgeId, user.staffId].filter(Boolean) as string[];

    return recordsToCheck.every((rec) => {
      if (!rec) return false;

      const ownerIds = [
        rec.createdByUid,
        rec.doctorId,
        rec.authorId,
        rec.authorStaffId,
        rec.recordedByStaffId,
        rec.userId,
        rec.transferredBy,
      ].filter(Boolean) as string[];

      if (ownerIds.length === 0) return false;

      return ownerIds.some((ownerId) =>
        userIdsToCheck.some((userId) => ownerId === userId || ownerId === `staff-${userId}`)
      );
    });
  }

  return false;
}

/**
 * Validates if a user is authorized to delete a clinical progress note or consultation note.
 * Rules requested by user:
 * 1. ADMIN (or Super Admin) can delete any clinical note.
 * 2. User granted deletion permission by Admin ('medicalRecords.delete' or 'clinicalNotes.delete').
 * 3. The original author / owner of the clinical note only.
 * 4. Fails closed if unauthorized.
 */
export function canDeleteClinicalNote(
  user: UserContextForPermission | any | null | undefined,
  note: {
    authorId?: string;
    authorStaffId?: string;
    authorName?: string;
    createdByUid?: string;
    authorRole?: string;
  } | null | undefined
): boolean {
  if (!user || !user.uid) return false;

  // 1. Admin / Super Admin has universal delete authority
  if (
    user.role === StaffRole.ADMIN ||
    user.role === 'ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.isSuperAdmin === true
  ) {
    return true;
  }

  // 2. User with explicit delete permission granted by Admin
  if (
    user.permissions?.['medicalRecords.delete'] === true
  ) {
    return true;
  }

  if (!note) return false;

  // 3. Author / Creator of the note - Strictly matching UID / staffId / badgeId (NO name-based matching)
  const userUids = [user.uid, user.badgeId, user.staffId].filter(Boolean) as string[];
  const noteAuthorIds = [
    note.authorId,
    note.authorStaffId,
    note.createdByUid,
  ].filter(Boolean) as string[];

  // Match UIDs / IDs strictly (including staff- prefixes)
  const idMatches = userUids.some(uId => 
    noteAuthorIds.some(nId => 
      nId === uId || 
      nId === `staff-${uId}` || 
      `staff-${nId}` === uId
    )
  );

  return idMatches;
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
