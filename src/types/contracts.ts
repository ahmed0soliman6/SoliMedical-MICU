/**
 * Soli Medical MICU (ICU-Sync)
 * UNIFIED DATA CONTRACT (SSOT)
 *
 * This file contains the definitive definitions for all system entities.
 * It strictly dictates the structure for TypeScript, Firestore, and Security Rules.
 */

// ----------------------------------------------------------------------------
// 1. Collections & Naming Convention
// ----------------------------------------------------------------------------
export const COLLECTIONS = {
  UNITS: 'units',
  USERS: 'users',
  PATIENTS: 'patients',
  BEDS: 'beds',
  TRANSFERS: 'transfers',
  MEDICAL_RECORDS: 'medical_records',
  CLINICAL_NOTES: 'clinicalNotes',
  SBAR_HANDOVERS: 'sbarHandovers',
  HANDOVERS: 'handovers',
  OPERATIONS: 'operations',
  SECTIONS: 'sections',
  CARDS: 'cards',
  CHATS: 'chats',
  CHAT_MESSAGES: 'chatMessages',
  AUDIT_LOGS: 'auditLogs',
  SETTINGS: 'system_settings',
} as const;

// ----------------------------------------------------------------------------
// 2. Base ID & Timestamp Policies
// ----------------------------------------------------------------------------
// ID Policy: UUID v4 is used for all records (patientId, bedId, etc.) except
// Auth which uses Firebase Auth UID for users.
//
// Timestamp Policy: All temporal fields MUST use milliseconds since epoch (number).
// In Firestore transactions, use serverTimestamp().

// ----------------------------------------------------------------------------
// 3. System Enums (Strict Union Types)
// ----------------------------------------------------------------------------
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type PatientStatus = 'ACTIVE_ICU' | 'DISCHARGED' | 'EXPIRED';
export type Shift = 'DAY' | 'NIGHT';
export type TransferType = 'ADMISSION' | 'TRANSFER' | 'BED_SWAP' | 'DISCHARGE';
export type OperationType = 'ADMISSION' | 'TRANSFER' | 'DISCHARGE' | 'BED_SWAP';
export type StaffRole = 
  | 'CONSULTANT' 
  | 'SPECIALIST' 
  | 'RESIDENT' 
  | 'BEDSIDE_RN' 
  | 'LEAD_RN' 
  | 'CLINICAL_PHARMACIST' 
  | 'RESPIRATORY_THERAPIST' 
  | 'ADMIN' 
  | 'AUDITOR';

export type RecordType = 
  | 'VITALS'
  | 'VENTILATOR'
  | 'INFUSION'
  | 'LAB'
  | 'CLINICAL_NOTE';

// ----------------------------------------------------------------------------
// 4. Core Entities
// ----------------------------------------------------------------------------

export interface UserContract {
  uid: string;
  name: string;
  role: StaffRole;
  unitId: string;
  isActive: boolean;
}

export interface UnitContract {
  unitId: string;
  name: string;
  isActive: boolean;
  createdAt: number;
}

export interface PatientContract {
  patientId: string;
  unitId: string;
  mrn: string;
  fullName: string;
  phoneNumber?: string;
  dateOfBirth: string; // ISO Date String (YYYY-MM-DD)
  gender: Gender;
  status: PatientStatus;
  createdAt: number;
  createdBy: string; // doctorId
}

export interface BedContract {
  bedId: string;
  unitId: string;
  bedNumber: string; // e.g., "01", "02"
  isActive: boolean;
  displayOrder: number;
  activePatientId: string | null;
  lastTransferId: string | null;
}

// ----------------------------------------------------------------------------
// 5. Operations & Events
// ----------------------------------------------------------------------------

export interface OperationContract {
  operationId: string;
  operationType: OperationType;
  initiatedBy: string; // doctorId
  initiatedAt: number; // Server Timestamp
}

export interface TransferContract {
  transferId: string;
  unitId: string;
  patientId: string;
  transferType: TransferType;
  operationId?: string; // Required for BED_SWAP and linked operations
  fromBedId: string | null;
  toBedId: string | null;
  transferredBy: string; // doctorId
  transferredAt: number; // Server Timestamp
  reason?: string;
}

// ----------------------------------------------------------------------------
// 6. Medical Records (Base & Extended)
// ----------------------------------------------------------------------------

export interface BaseMedicalRecordContract {
  id: string; // Generic ID for medical records to allow diverse sub-collections if needed, or single collection
  unitId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  createdAt: number; // Server Timestamp
  shift: Shift;
  recordType: RecordType;
  originalRecordId?: string; // Used when this record is correcting an older one
  isCorrection?: boolean;
}

// Example of extending the base contract (Medical Fields strictly typed)
export interface VitalsRecordContract extends BaseMedicalRecordContract {
  recordType: 'VITALS';
  map: number;
  heartRate: number;
  spO2: number;
  temperature: number;
  // ... other original medical fields from schema.ts
}

// ----------------------------------------------------------------------------
// 7. Dynamic Handover Contracts (Type-Safe)
// ----------------------------------------------------------------------------

export type HandoverFieldValue = string | number | boolean | null;
export type HandoverFieldType = 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'DATE' | 'TIME';

export interface HandoverFieldContract {
  label: string;
  type: HandoverFieldType;
  value: HandoverFieldValue;
}

export interface HandoverGroupContract {
  groupName: string;
  fields: HandoverFieldContract[];
}

export interface HandoverSectionContract {
  sectionName: string;
  groups: HandoverGroupContract[];
}

export interface HandoverContract {
  id: string; // handoverId
  unitId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  createdAt: number; // Server Timestamp
  shift: Shift;
  snapshot: HandoverSectionContract[];
}
