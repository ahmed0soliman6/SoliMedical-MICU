/**
 * Soli Medical MICU (ICU-Sync) - Complete Domain Model & JSON Schema Definitions
 * 
 * Compliant with:
 * - CBAHI (Saudi Central Board for Accreditation of Healthcare Institutions)
 * - JCI (Joint Commission International) Critical Care Standards
 * - HIPAA Audit & Clinical Note Immutability Protocols (SHA-256 Hash Chained Addendums)
 */

export enum BedNumber {
  BED_01 = '01',
  BED_02 = '02',
  BED_03 = '03',
  BED_04 = '04',
  BED_05 = '05',
  BED_06 = '06',
}

export enum BedStatus {
  OCCUPIED = 'OCCUPIED',
  VACANT = 'VACANT',
  TRANSFER_PENDING = 'TRANSFER_PENDING',
  DECONTAMINATING = 'DECONTAMINATING',
  LOCKED = 'LOCKED',
}

export enum AcuityLevel {
  CRITICAL_STAT = 'CRITICAL_STAT',
  GUARDED_STABLE = 'GUARDED_STABLE',
  STEP_DOWN = 'STEP_DOWN',
  HIGH_VIGILANCE = 'HIGH_VIGILANCE',
  VACANT = 'VACANT',
}

export enum CodeStatus {
  FULL_CODE = 'FULL_CODE',
  DNR = 'DNR',
  DNI_ONLY = 'DNI_ONLY',
  PALLIATIVE_COMFORT = 'PALLIATIVE_COMFORT',
}

export enum IntakePathway {
  STAT_CRITICAL = 'STAT_CRITICAL',
  FLOOR_TRANSFER = 'FLOOR_TRANSFER',
  ELECTIVE_POST_OP = 'ELECTIVE_POST_OP',
  ER_REFERRAL = 'ER_REFERRAL',
}

// Core Base Types
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum StaffRole {
  CONSULTANT = 'CONSULTANT',
  SPECIALIST = 'SPECIALIST',
  RESIDENT = 'RESIDENT',
  BEDSIDE_RN = 'BEDSIDE_RN',
  LEAD_RN = 'LEAD_RN',
  CLINICAL_PHARMACIST = 'CLINICAL_PHARMACIST',
  RESPIRATORY_THERAPIST = 'RESPIRATORY_THERAPIST',
  ADMIN = 'ADMIN',
  AUDITOR = 'AUDITOR',
}

// -------------------------------------------------------------
// Core Clinical Interfaces (Phase 2 - Firestore SSOT)
// -------------------------------------------------------------

export interface PatientRecord {
  id: string; // patientId (ثابت لا يتغير)
  unitId: string;
  mrn: string;
  fullName: string;
  phoneNumber?: string;
  dateOfBirth: string;
  gender: Gender;
  status: 'ACTIVE_ICU' | 'DISCHARGED' | 'EXPIRED';
  createdAt: number; // Server Timestamp
}

export interface BedRecord {
  id: string; // bedId
  unitId: string;
  bedNumber: string; // "Bed 1", "Bed 2"
  isActive: boolean;
  displayOrder: number;
  
  // -- المصدر الوحيد للحقيقة --
  activePatientId: string | null; 
  lastTransferId: string | null; // ضروري جداً لعمل Firestore Rules (getAfter)
}

export interface PatientBedTransfer {
  id: string; // transferId
  unitId: string;
  patientId: string;
  transferType: 'ADMISSION' | 'TRANSFER' | 'BED_SWAP' | 'DISCHARGE';
  operationId?: string; // لربط السجلين معاً في حالة BED_SWAP
  fromBedId: string | null; 
  toBedId: string | null;   
  transferredBy: string; // doctorId
  transferredAt: number; // Server Timestamp
  reason?: string;
}

export interface BaseMedicalRecord {
  id: string;
  unitId: string;
  patientId: string;
  
  // -- حقول الحماية والتتبع --
  doctorId: string;
  doctorName: string;
  createdAt: number; // Server Timestamp
  shift: 'DAY' | 'NIGHT';
  recordType: string;
  
  // التصحيح
  originalRecordId?: string;
}

export interface HandoverRecord {
  id: string;
  unitId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  createdAt: number;
  shift: 'DAY' | 'NIGHT';
  originalRecordId?: string;
  
  snapshot: Array<{
    sectionName: string;
    groups: Array<{
      groupName: string;
      fields: Array<{ label: string, value: any }>;
    }>;
  }>;
}

export enum NoteType {
  ADMISSION_NOTE = 'ADMISSION_NOTE',
  PROGRESS_NOTE = 'PROGRESS_NOTE',
  SBAR_HANDOVER = 'SBAR_HANDOVER',
  CONSULTATION_NOTE = 'CONSULTATION_NOTE',
  PROCEDURAL_NOTE = 'PROCEDURAL_NOTE',
  DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY',
  DEATH_SUMMARY = 'DEATH_SUMMARY',
}

export enum VentilatorMode {
  PRVC_AC = 'PRVC/AC',
  SIMV_PC = 'SIMV-PC',
  SIMV_VC = 'SIMV-VC',
  NIV_PSV = 'NIV PSV',
  CPAP_PS = 'CPAP/PS',
  T_PIECE = 'T-Piece Trial',
  HIGH_FLOW_NASAL = 'HFNC',
  ROOM_AIR = 'Room Air',
}

export enum AllergySeverity {
  FATAL_ANAPHYLAXIS = 'FATAL_ANAPHYLAXIS',
  SEVERE = 'SEVERE',
  MODERATE = 'MODERATE',
  MILD = 'MILD',
}

export enum DispositionType {
  DISCHARGE_HOME = 'DISCHARGE_HOME',
  TRANSFER_GENERAL_WARD = 'TRANSFER_GENERAL_WARD',
  TRANSFER_SURGERY = 'TRANSFER_SURGERY',
  TRANSFER_CARDIOLOGY = 'TRANSFER_CARDIOLOGY',
  TRANSFER_EXTERNAL_HOSPITAL = 'TRANSFER_EXTERNAL_HOSPITAL',
  CLINICAL_MORTALITY = 'CLINICAL_MORTALITY',
}

export enum PumpStatus {
  RUNNING = 'RUNNING',
  TITRATING = 'TITRATING',
  STANDBY = 'STANDBY',
  STOPPED = 'STOPPED',
}

export enum TransfusionProduct {
  PRBC = 'PRBC',
  FFP = 'FFP',
  PLATELETS = 'PLATELETS',
  CRYOPRECIPITATE = 'CRYOPRECIPITATE',
  WHOLE_BLOOD = 'WHOLE_BLOOD',
}

// -------------------------------------------------------------
// Core Clinical Interfaces
// -------------------------------------------------------------

export interface AllergyRecord {
  id: string;
  allergen: string;
  reaction: string;
  severity: AllergySeverity;
  confirmedYear?: number;
  isLocked: boolean; // Cannot be removed without consultant approval
  verifiedBy: string;
  clinicalNote?: string;
}

export interface MicrobiologyRecord {
  id: string;
  specimenSource: string; // e.g. Sputum Culture, Blood, Urine, Wound
  isolatedOrganism: string; // e.g. MRSA, Pseudomonas aeruginosa, Klebsiella pneumoniae (ESBL)
  cultureDate: string;
  isResistant: boolean;
  resistantTo: string[];
  sensitiveTo: string[];
  recommendedIsolation: string; // e.g. Contact Isolation, Airborne N95
}

export interface PastICUVisit {
  id: string;
  admissionDate: string;
  dischargeDate: string;
  primaryDiagnosis: string;
  outcome: 'DISCHARGED_IMPROVED' | 'TRANSFERRED_WARD' | 'EXPIRED' | 'AGAINST_MEDICAL_ADVICE';
  dischargeSummaryNoteId?: string;
  attendingPhysicianName: string;
  notes?: string;
}

export interface GCSBreakdown {
  eyeOpening: number; // 1-4
  verbalResponse: number; // 1-5 (or 1T for intubated)
  motorResponse: number; // 1-6
  isExtubatedOrTrach?: boolean;
}

export interface TelemetryVitals {
  id: string;
  bedId: BedNumber;
  patientId: string;
  timestamp: string; // ISO 8601 UTC
  heartRateBpm: number;
  heartRhythm: string; // Sinus Tachycardia, NSR, Atrial Fibrillation, etc.
  systolicBpMmHg: number;
  diastolicBpMmHg: number;
  meanArterialPressureMmHg: number; // MAP (Calculated or direct Art-Line)
  isArterialLine: boolean;
  spo2Percent: number;
  fio2SuppliedPercent: number;
  respiratoryRateCpm: number;
  coreTemperatureCelsius: number;
  temperatureSite: 'FOLEY_CORE' | 'AXILLARY' | 'TYMPANIC' | 'RECTAL';
  gcsTotalScore: number;
  gcsBreakdown: GCSBreakdown;
  sedationRassScore?: number; // Richmond Agitation-Sedation Scale (-5 to +4)
  lactateMmolPerL?: number;
  lactateClearancePercent?: number;
  bloodGlucoseMgDl?: number;
  recordedBy: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  clinicalNotes?: string;
}

export interface VentilatorParameters {
  id: string;
  bedId: BedNumber;
  patientId: string;
  timestamp: string;
  deviceModel: string; // e.g. Draeger Evita V800
  mode: VentilatorMode;
  fio2Percent: number;
  peepCmH2O: number;
  tidalVolumeMl: number;
  peakInspiratoryPressureCmH2O: number; // Ppeak
  plateauPressureCmH2O: number; // Pplat
  drivingPressureCmH2O: number; // Driving Pressure = Pplat - PEEP
  setRespiratoryRateCpm: number;
  actualRespiratoryRateCpm: number;
  inspiratoryFlowRateLpm?: number;
  ieRatio?: string; // e.g. 1:2
  isWeaningTrialActive?: boolean;
  weaningTrialType?: 'SBT_30MIN' | 'CPAP_PS_TRIAL' | 'T_PIECE';
  circuitLeakPercent: number;
  recordedByStaffName: string;
}

export interface InfusionPumpLine {
  id: string;
  bedId: BedNumber;
  patientId: string;
  pumpChannel: 'PUMP_A' | 'PUMP_B' | 'PUMP_C' | 'PUMP_D';
  lineAccessType: 'CVC_LINE_1' | 'CVC_LINE_2' | 'CVC_LINE_3' | 'PERIPHERAL' | 'ARTERIAL';
  drugNameEn: string;
  drugNameAr?: string;
  solutionCarrier: string; // e.g. 500 mcg in 50 mL NS, 4 mg in 50 mL D5W
  currentRate: number;
  rateUnit: 'mcg/kg/min' | 'mcg/h' | 'mg/h' | 'Units/hr' | 'ml/h';
  flowRateMlPerHour: number;
  status: PumpStatus;
  clinicalTargetDescription: string; // e.g. "Target MAP > 65 mmHg", "Target Blood Glucose 140-180"
  remainingVolumeMl: number;
  totalVolumeMl: number;
  titrationHistory?: {
    timestamp: string;
    newRate: number;
    adjustedBy: string;
    reason: string;
  }[];
}

export interface FluidBalance24H {
  id: string;
  bedId: BedNumber;
  patientId: string;
  periodStartTimestamp: string;
  periodEndTimestamp: string;
  intakeBreakdown: {
    ivMaintenanceFluidMl: number;
    ivMedicationInfusionsMl: number;
    enteralFeedingMl: number;
    bloodProductsMl: number;
    oralFluidsMl: number;
    totalIntakeMl: number;
  };
  outputBreakdown: {
    urineOutputMl: number;
    hourlyUrineAverageMlPerHour: number;
    nasogastricDrainageMl: number; // Ryle Tube
    chestTubeDrainageMl: number;
    surgicalDrainageMl: number;
    insensibleLossMl?: number;
    totalOutputMl: number;
  };
  netCumulativeBalanceMl: number; // Intake - Output (+ve / -ve)
  recordedByStaffName: string;
}

export interface BloodTransfusionUnit {
  unitId: string;
  productType: TransfusionProduct;
  volumeMl: number;
  status: 'PENDING_CROSSMATCH' | 'READY_IN_BLOOD_BANK' | 'INFUSING' | 'COMPLETED' | 'CANCELLED';
  startedAt?: string;
  completedAt?: string;
  administeredByRN?: string;
  verifiedBySecondRN?: string;
}

export interface TransfusionTracker {
  id: string;
  bedId: BedNumber;
  patientId: string;
  bloodGroup: string; // e.g. O+, A+, B-, AB+
  rhFactor: 'POSITIVE' | 'NEGATIVE';
  crossmatchStatus: 'ACTIVE' | 'PENDING' | 'COMPLETED';
  activeProtocol: 'MASSIVE_TRANSFUSION_PROTOCOL' | 'RESTRICTIVE_TRANSFUSION' | 'STANDARD';
  units: BloodTransfusionUnit[];
  prbcUnitsInfusedCount: number;
  prbcUnitsTotalOrdered: number;
  ffpUnitsInfusedCount: number;
  ffpUnitsTotalOrdered: number;
  plateletsUnitsInfusedCount: number;
  plateletsUnitsTotalOrdered: number;
  latestHemoglobinGPerDl: number;
  hemoglobinTrend12H: {
    timestamp: string;
    valueGPerDl: number;
    label: string;
  }[];
}

export interface StatLabPanel {
  id: string;
  bedId: BedNumber;
  patientId: string;
  timestamp: string;
  abg: {
    ph: number;
    pco2MmHg: number;
    po2MmHg: number;
    hco3MmolPerL: number;
    baseExcessMmolPerL: number;
    lactateMmolPerL: number;
    pao2Fio2Ratio: number;
  };
  cbc: {
    wbcCountKPerUl: number;
    hemoglobinGPerDl: number;
    hematocritPercent: number;
    plateletCountKPerUl: number;
    differential?: string;
    typeAnemia?: string;
  };
  coagulation: {
    inr: number;
    ptSeconds: number;
    pttSeconds: number;
    fibrinogenMgPerDl?: number;
  };
  biochemistry: {
    potassiumMeqPerL: number;
    sodiumMeqPerL: number;
    creatinineMgPerDl: number;
    bunMgPerDl?: number;
    totalBilirubinMgPerDl: number;
    albuminGPerDl: number;
    procalcitoninNgPerMl?: number;
    crpMgPerL?: number;
    calciumMeqPerL?: number;
    phosphorusMeqPerL?: number;
    magnesiumMeqPerL?: number;
    altUPerL?: number;
    astUPerL?: number;
    alpUPerL?: number;
    ggtUPerL?: number;
    amylaseUPerL?: number;
    lipaseUPerL?: number;
    troponinNgPerMl?: number;
    ckUPerL?: number;
    ckMbUPerL?: number;
    esrMmHr?: number;
    ureaMgPerDl?: number;
    uricAcidMgPerDl?: number;
  };
  isCriticalAlert: boolean;
  reviewedByDoctorName?: string;
}

// -------------------------------------------------------------
// SBAR Shift Handover & Digital Signature Types
// -------------------------------------------------------------

export interface SbarHandoverReport {
  id: string;
  bedId: BedNumber;
  patientId: string;
  shiftType: 'NIGHT' | 'DAY';
  shiftDate: string; // e.g. 2026-09-14
  shiftStartTime: string;
  shiftEndTime: string;
  outgoingDoctor: {
    staffId: string;
    name: string;
    role: StaffRole;
    signedAt: string;
    digitalSignatureToken: string;
  };
  incomingDoctor?: {
    staffId: string;
    name: string;
    role: StaffRole;
    signedAt?: string;
    digitalSignatureToken?: string;
  };
  situation: string; // S: Current clinical situation & reason for admission
  background: string; // B: Past medical history, allergies, hospital course
  assessment: {
    hemodynamics: string;
    pulmonaryAndAirway: string;
    metabolicAndRenal: string;
    neurologyAndSedation: string;
    infectiousDiseaseAndAntibiotics: string;
  };
  recommendationAndOrders: string[]; // R: Action items for upcoming shift
  isLocked: boolean; // Once signed, immutable
  cryptographicHash: string;
}

// -------------------------------------------------------------
// Doctor-to-Doctor Immutability Protocol & Addendums
// -------------------------------------------------------------

export interface Addendum {
  id: string;
  noteId: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorRole: StaffRole;
  authorStaffId: string;
  timestamp: string; // ISO 8601 UTC
  content: string; // The appended commentary or clarification
  reasonForAddendum: 'CLINICAL_UPDATE' | 'CORRECTION' | 'LAB_CORRELATION' | 'CONSULTANT_COUNTERSIGN' | 'HANDOVER_NOTE';
  previousHash: string; // Chained cryptographic hash of the previous state
  cryptographicSignature: string; // SHA-256 stamp verifying author and timestamp
  isImmutable: boolean; // Always true
}

export interface ClinicalNote {
  id: string;
  bedId?: BedNumber;
  patientId: string;
  noteType: NoteType;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: StaffRole;
  authorStaffId: string;
  timestamp: string;
  isImmutable: boolean; // Under Rule 2.6: Doctor-to-Doctor Overwrite Protection prevents alteration
  cryptographicHash: string; // SHA-256 hash of original content + author + timestamp
  digitalSignatureToken: string;
  addendums: Addendum[]; // Append-only chained array
}

// -------------------------------------------------------------
// Patient Dossier & Bed Matrix
// -------------------------------------------------------------

export interface MortalityAuditRecord {
  patientId: string;
  dateOfDeath: string;
  timeOfDeath: string;
  primaryCauseOfDeath: string;
  secondaryCauses: string[];
  supervisingConsultant: string;
  deathSummaryNoteId: string;
  burialReportGenerated: boolean;
  autoPurgeScheduledAt: string; // 10-day retention countdown timestamp
  isArchived: boolean;
  isPurged: boolean;
}

export interface PatientDossier {
  id: string;
  mrn: string; // Medical Record Number e.g. #99281, ICU-992-814
  nationalId?: string;
  fullNameEn: string;
  fullNameAr: string;
  age: number;
  gender: Gender;
  weightKg: number;
  heightCm: number;
  idealBodyWeightKg: number;
  codeStatus: CodeStatus;
  primaryDiagnosisEn: string;
  primaryDiagnosisAr?: string;
  intakePathway: IntakePathway;
  admissionDate: string;
  currentBedId?: BedNumber;
  acuityLevel: AcuityLevel;
  patientStatus: 'ACTIVE_ICU' | 'DISCHARGED_STEPDOWN' | 'DISCHARGED_HOME' | 'TRANSFERRED_EXTERNAL' | 'EXPIRED_MORTALITY';
  allergies: AllergyRecord[];
  microbiologyHistory: MicrobiologyRecord[];
  pastVisits: PastICUVisit[];
  attendingPhysician: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  primaryNurse: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  isolationPrecautions?: string[];
  isFrequentFlyer?: boolean;
  fluidRestrictionDailyMl?: number;
  highAlertWarnings?: string[];
  mortalityRecord?: MortalityAuditRecord;
  history?: string;
  presentingComplaint?: string;
  chronicDiseases?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPermissions {
  canAdmitPatient: boolean;
  canDischargePatient: boolean;
  canSignNotes: boolean;
  canAddAddendum: boolean;
  canSignSbar: boolean;
  canTitrateMedications: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canViewAuditLogs: boolean;
  canEditVitals: boolean;
}

export interface IcuUser {
  uid: string;
  email: string;
  nameEn: string;
  nameAr: string;
  role: StaffRole;
  department: string;
  badgeId: string;
  licenseNumber: string;
  isActive: boolean;
  isSuperAdmin?: boolean;
  pinCode?: string;
  createdAt: string;
  lastLoginAt?: string;
  permissions: UserPermissions;
}

export interface StaffMember {
  id: string;
  staffId: string;
  nameEn: string;
  nameAr: string;
  role: StaffRole;
  specialization: string;
  activeShift: 'NIGHT' | 'DAY' | 'OFF';
  assignedBeds: BedNumber[];
  avatarUrl?: string;
  licenseNumber: string;
  isConsultantLead?: boolean;
}

export interface WardAuditLog {
  id: string;
  timestamp: string;
  eventType: 'PATIENT_ADMITTED' | 'PATIENT_DISCHARGED' | 'PATIENT_TRANSFERRED' | 'VITALS_RECORDED' | 'NOTE_CREATED' | 'ADDENDUM_APPENDED' | 'SBAR_SIGNED' | 'PUMP_TITRATED' | 'MORTALITY_LOGGED' | 'AUTO_PURGE_EXECUTED';
  performedBy: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  targetBedId?: BedNumber;
  targetPatientMrn?: string;
  description: string;
  immutableHash: string;
}

// -------------------------------------------------------------
// JSON Schema Specification (Formal Validator Schema)
// -------------------------------------------------------------

export const ClinicalNoteJSONSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'ClinicalNote',
  type: 'object',
  required: ['id', 'patientId', 'noteType', 'title', 'content', 'authorId', 'authorName', 'authorRole', 'timestamp', 'isImmutable', 'cryptographicHash'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    bedId: { type: 'string', enum: ['01', '02', '03', '04', '05', '06'] },
    patientId: { type: 'string' },
    noteType: { 
      type: 'string', 
      enum: ['ADMISSION_NOTE', 'PROGRESS_NOTE', 'SBAR_HANDOVER', 'CONSULTATION_NOTE', 'PROCEDURAL_NOTE', 'DISCHARGE_SUMMARY', 'DEATH_SUMMARY'] 
    },
    title: { type: 'string', minLength: 3, maxLength: 250 },
    content: { type: 'string', minLength: 1 },
    authorId: { type: 'string' },
    authorName: { type: 'string' },
    authorRole: { 
      type: 'string', 
      enum: ['CONSULTANT', 'SPECIALIST', 'RESIDENT', 'BEDSIDE_RN', 'LEAD_RN', 'CLINICAL_PHARMACIST', 'RESPIRATORY_THERAPIST', 'ADMIN'] 
    },
    authorStaffId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    isImmutable: { type: 'boolean', const: true },
    cryptographicHash: { type: 'string', minLength: 64, maxLength: 64 },
    digitalSignatureToken: { type: 'string' },
    addendums: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'noteId', 'patientId', 'authorId', 'authorName', 'authorRole', 'timestamp', 'content', 'previousHash', 'cryptographicSignature', 'isImmutable'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          noteId: { type: 'string', format: 'uuid' },
          patientId: { type: 'string' },
          authorId: { type: 'string' },
          authorName: { type: 'string' },
          authorRole: { type: 'string' },
          authorStaffId: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          content: { type: 'string', minLength: 1 },
          reasonForAddendum: { type: 'string' },
          previousHash: { type: 'string' },
          cryptographicSignature: { type: 'string' },
          isImmutable: { type: 'boolean', const: true },
        },
      },
    },
  },
} as const;
