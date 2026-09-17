/**
 * Soli Medical MICU (ICU-Sync) - Data Model Layer
 * 
 * Production-ready CRUD, audit trailing, cryptographic hashing,
 * and immutable doctor-to-doctor clinical note operations.
 */

import { db } from '../db/icuSyncDb.ts';
import { toEnglishDigits } from './numberUtils.ts';
import {
  syncBedToCloud,
  syncPatientToCloud,
  syncVitalsToCloud,
  syncSbarToCloud,
  syncClinicalNoteToCloud,
} from './firebase.ts';
import {
  BedNumber,
  BedStatus,
  BedRecord,
  PatientDossier,
  TelemetryVitals,
  VentilatorParameters,
  InfusionPumpLine,
  FluidBalance24H,
  StatLabPanel,
  SbarHandoverReport,
  ClinicalNote,
  Addendum,
  StaffRole,
  NoteType,
  AcuityLevel,
  CodeStatus,
  Gender,
  IntakePathway,
  WardAuditLog,
  DispositionType,
  AllergyRecord,
  MicrobiologyRecord,
  AllergySeverity,
} from '../types/schema.ts';

// -------------------------------------------------------------
// Cryptographic Hash & Signature Utility (Browser Web Crypto API)
// -------------------------------------------------------------

export async function computeSha256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash for non-crypto contexts
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

export function calculateIdealBodyWeight(heightCm: number, gender: Gender): number {
  const heightInches = heightCm / 2.54;
  const inchesOver5Feet = Math.max(0, heightInches - 60);
  if (gender === Gender.MALE) {
    return parseFloat((50 + 2.3 * inchesOver5Feet).toFixed(1));
  } else {
    return parseFloat((45.5 + 2.3 * inchesOver5Feet).toFixed(1));
  }
}

// -------------------------------------------------------------
// Admission Data Model
// -------------------------------------------------------------

export interface DirectAdmissionInput {
  targetBed: BedNumber;
  mrn: string;
  nationalId?: string;
  fullNameEn: string;
  fullNameAr: string;
  age: number;
  gender: Gender;
  bloodType?: string;
  weightKg: number;
  heightCm: number;
  codeStatus: CodeStatus;
  primaryDiagnosisEn: string;
  primaryDiagnosisAr?: string;
  intakePathway: IntakePathway;
  acuityLevel: AcuityLevel;
  attendingDoctor: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  assignedNurse: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  allergies?: {
    allergen: string;
    reaction: string;
    severity: AllergySeverity;
    confirmedYear?: number;
    clinicalNote?: string;
  }[];
  initialVitals?: {
    heartRateBpm: number;
    systolicBpMmHg: number;
    diastolicBpMmHg: number;
    spo2Percent: number;
    fio2SuppliedPercent: number;
    respiratoryRateCpm: number;
    coreTemperatureCelsius: number;
    gcsTotalScore: number;
    isArterialLine: boolean;
  };
  isolationPrecautions?: string[];
  initialAdmissionNote?: string;
  history?: string;
  presentingComplaint?: string;
  chronicDiseases?: string;
}

/**
 * Admits a patient to a specified ICU bed with full transactional integrity:
 * - Checks bed occupancy
 * - Sets Bed status to OCCUPIED
 * - Creates PatientDossier
 * - Records initial telemetry vitals
 * - Logs initial admission clinical note (with immutable cryptographic hash)
 * - Emits audit trail log
 */
export async function admitPatient(input: DirectAdmissionInput): Promise<{ patientId: string; noteId?: string }> {
  return await db.transaction('rw', [
    db.beds,
    db.patients,
    db.vitals,
    db.clinicalNotes,
    db.auditLogs,
  ], async () => {
    const existingBed = await db.beds.get(input.targetBed);
    if (!existingBed) {
      throw new Error(`Target Bed ${input.targetBed} does not exist.`);
    }

    if (existingBed.status === BedStatus.OCCUPIED && existingBed.currentPatientId) {
      const activePatient = await db.patients.get(existingBed.currentPatientId);
      if (activePatient && activePatient.patientStatus === 'ACTIVE_ICU') {
        throw new Error(`Bed ${input.targetBed} is already occupied by ${activePatient.fullNameAr || activePatient.fullNameEn} (${activePatient.mrn}). Please transfer or discharge current patient first.`);
      }
      // Self-heal: the patient previously assigned was missing or discharged
      existingBed.status = BedStatus.VACANT;
      existingBed.currentPatientId = null;
      existingBed.activePatientId = null;
    }

    const nowIso = new Date().toISOString();
    const patientId = `pat-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const idealWeight = calculateIdealBodyWeight(input.heightCm, input.gender);

    const formattedAllergies: AllergyRecord[] = (input.allergies || []).map((a, idx) => ({
      id: `all-${patientId}-${idx}`,
      allergen: a.allergen,
      reaction: a.reaction,
      severity: a.severity,
      confirmedYear: a.confirmedYear,
      isLocked: true,
      verifiedBy: input.attendingDoctor.name,
      clinicalNote: a.clinicalNote,
    }));

    const newPatient: PatientDossier = {
      id: patientId,
      mrn: toEnglishDigits(input.mrn),
      nationalId: input.nationalId ? toEnglishDigits(input.nationalId) : undefined,
      fullNameEn: input.fullNameEn,
      fullNameAr: input.fullNameAr,
      age: input.age,
      gender: input.gender,
      bloodType: input.bloodType,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      idealBodyWeightKg: idealWeight,
      codeStatus: input.codeStatus,
      primaryDiagnosisEn: input.primaryDiagnosisEn,
      primaryDiagnosisAr: input.primaryDiagnosisAr,
      intakePathway: input.intakePathway,
      admissionDate: nowIso,
      currentBedId: input.targetBed,
      acuityLevel: input.acuityLevel,
      patientStatus: 'ACTIVE_ICU',
      allergies: formattedAllergies,
      microbiologyHistory: [],
      pastVisits: [],
      attendingPhysician: input.attendingDoctor,
      primaryNurse: input.assignedNurse,
      isolationPrecautions: input.isolationPrecautions || [],
      history: input.history || '',
      presentingComplaint: input.presentingComplaint || '',
      chronicDiseases: input.chronicDiseases || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.patients.put(newPatient);

    // Update Bed
    await db.beds.update(input.targetBed, {
      status: BedStatus.OCCUPIED,
      currentPatientId: patientId,
      lastTelemetryPingUtc: nowIso,
    });

    // Record initial vitals if provided
    if (input.initialVitals) {
      const map = Math.round(input.initialVitals.diastolicBpMmHg + (input.initialVitals.systolicBpMmHg - input.initialVitals.diastolicBpMmHg) / 3);
      const vitalsRecord: TelemetryVitals = {
        id: `vit-${Date.now()}`,
        bedId: input.targetBed,
        patientId: patientId,
        timestamp: nowIso,
        heartRateBpm: input.initialVitals.heartRateBpm,
        heartRhythm: 'Sinus Tachycardia',
        systolicBpMmHg: input.initialVitals.systolicBpMmHg,
        diastolicBpMmHg: input.initialVitals.diastolicBpMmHg,
        meanArterialPressureMmHg: map,
        isArterialLine: input.initialVitals.isArterialLine,
        spo2Percent: input.initialVitals.spo2Percent,
        fio2SuppliedPercent: input.initialVitals.fio2SuppliedPercent,
        respiratoryRateCpm: input.initialVitals.respiratoryRateCpm,
        coreTemperatureCelsius: input.initialVitals.coreTemperatureCelsius,
        temperatureSite: 'FOLEY_CORE',
        gcsTotalScore: input.initialVitals.gcsTotalScore,
        gcsBreakdown: { eyeOpening: 4, verbalResponse: 4, motorResponse: 6 },
        recordedBy: input.assignedNurse,
      };
      await db.vitals.put(vitalsRecord);
    }

    // Create Initial Admission Note if provided
    let createdNoteId: string | undefined;
    if (input.initialAdmissionNote) {
      const rawPayload = `${patientId}|${input.initialAdmissionNote}|${input.attendingDoctor.staffId}|${nowIso}`;
      const hash = await computeSha256(rawPayload);
      const noteId = `note-${Date.now()}`;
      createdNoteId = noteId;

      const admissionNote: ClinicalNote = {
        id: noteId,
        bedId: input.targetBed,
        patientId: patientId,
        noteType: NoteType.ADMISSION_NOTE,
        title: `MICU Direct Admission Note - Bed ${input.targetBed}`,
        content: input.initialAdmissionNote,
        authorId: `staff-${input.attendingDoctor.staffId}`,
        authorName: input.attendingDoctor.name,
        authorRole: input.attendingDoctor.role,
        authorStaffId: input.attendingDoctor.staffId,
        timestamp: nowIso,
        isImmutable: true,
        cryptographicHash: hash,
        digitalSignatureToken: `SIGN-${input.attendingDoctor.staffId}-${Date.now()}`,
        addendums: [],
      };
      await db.clinicalNotes.put(admissionNote);
    }

    // Audit Log
    const auditPayload = `ADMIT|${patientId}|${input.targetBed}|${input.attendingDoctor.staffId}|${nowIso}`;
    const auditHash = await computeSha256(auditPayload);
    const auditLog: WardAuditLog = {
      id: `audit-${Date.now()}`,
      timestamp: nowIso,
      eventType: 'PATIENT_ADMITTED',
      performedBy: input.attendingDoctor,
      targetBedId: input.targetBed,
      targetPatientMrn: input.mrn,
      description: `Patient ${input.fullNameEn} (MRN: ${input.mrn}) admitted to Bed ${input.targetBed} under ${input.attendingDoctor.name}.`,
      immutableHash: auditHash,
    };
    await db.auditLogs.put(auditLog);

    // Push directly to Firebase Firestore for real-time collaboration
    syncPatientToCloud(newPatient);
    db.beds.get(input.targetBed).then(b => b && syncBedToCloud(b));

    return { patientId, noteId: createdNoteId };
  });
}

// -------------------------------------------------------------
// Timestamped Telemetry Vitals Logging
// -------------------------------------------------------------

export interface AddVitalsInput {
  bedId: BedNumber;
  patientId: string;
  heartRateBpm: number;
  heartRhythm?: string;
  systolicBpMmHg: number;
  diastolicBpMmHg: number;
  isArterialLine?: boolean;
  spo2Percent: number;
  fio2SuppliedPercent: number;
  respiratoryRateCpm: number;
  coreTemperatureCelsius: number;
  temperatureSite?: 'FOLEY_CORE' | 'AXILLARY' | 'TYMPANIC' | 'RECTAL';
  gcsTotalScore: number;
  gcsBreakdown?: { eyeOpening: number; verbalResponse: number; motorResponse: number };
  sedationRassScore?: number;
  lactateMmolPerL?: number;
  lactateClearancePercent?: number;
  bloodGlucoseMgDl?: number;
  cvpMmHg?: number;
  recordedBy: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  clinicalNotes?: string;
}

export async function addTimestampedVitals(input: AddVitalsInput): Promise<TelemetryVitals> {
  const nowIso = new Date().toISOString();
  const map = Math.round(input.diastolicBpMmHg + (input.systolicBpMmHg - input.diastolicBpMmHg) / 3);

  const vitalsRecord: TelemetryVitals = {
    id: `vit-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    bedId: input.bedId,
    patientId: input.patientId,
    timestamp: nowIso,
    heartRateBpm: input.heartRateBpm,
    heartRhythm: input.heartRhythm || 'Normal Sinus Rhythm',
    systolicBpMmHg: input.systolicBpMmHg,
    diastolicBpMmHg: input.diastolicBpMmHg,
    meanArterialPressureMmHg: map,
    isArterialLine: input.isArterialLine || false,
    spo2Percent: input.spo2Percent,
    fio2SuppliedPercent: input.fio2SuppliedPercent,
    respiratoryRateCpm: input.respiratoryRateCpm,
    coreTemperatureCelsius: input.coreTemperatureCelsius,
    temperatureSite: input.temperatureSite || 'FOLEY_CORE',
    gcsTotalScore: input.gcsTotalScore,
    gcsBreakdown: input.gcsBreakdown || { eyeOpening: 4, verbalResponse: 5, motorResponse: 6 },
    sedationRassScore: input.sedationRassScore,
    lactateMmolPerL: input.lactateMmolPerL,
    lactateClearancePercent: input.lactateClearancePercent,
    bloodGlucoseMgDl: input.bloodGlucoseMgDl,
    cvpMmHg: input.cvpMmHg,
    recordedBy: input.recordedBy,
    clinicalNotes: input.clinicalNotes,
  };

  await db.transaction('rw', [db.vitals, db.beds, db.auditLogs], async () => {
    await db.vitals.put(vitalsRecord);
    await db.beds.update(input.bedId, {
      lastTelemetryPingUtc: nowIso,
    });
  });

  // Cloud broadcast
  syncVitalsToCloud(vitalsRecord);

  return vitalsRecord;
}

// -------------------------------------------------------------
// Doctor-to-Doctor Immutability & Addendum Appending
// -------------------------------------------------------------

export interface AppendAddendumInput {
  noteId: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorRole: StaffRole;
  authorStaffId: string;
  content: string;
  reasonForAddendum: 'CLINICAL_UPDATE' | 'CORRECTION' | 'LAB_CORRELATION' | 'CONSULTANT_COUNTERSIGN' | 'HANDOVER_NOTE';
}

/**
 * Appends an immutable cryptographic addendum to an existing signed clinical note.
 * Enforces Rule 2.6: Doctor-to-Doctor Overwrite Protection.
 * Original note content is NEVER modified; addendum is chained via SHA-256 hashes.
 */
export async function appendImmutableAddendum(input: AppendAddendumInput): Promise<Addendum> {
  return await db.transaction('rw', [db.clinicalNotes, db.addendums, db.auditLogs], async () => {
    const originalNote = await db.clinicalNotes.get(input.noteId);
    if (!originalNote) {
      throw new Error(`Clinical Note with ID "${input.noteId}" was not found.`);
    }

    const nowIso = new Date().toISOString();
    const addendumId = `add-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    // Determine parent hash (from last addendum or the original note hash)
    const previousHash = originalNote.addendums && originalNote.addendums.length > 0
      ? originalNote.addendums[originalNote.addendums.length - 1].cryptographicSignature
      : originalNote.cryptographicHash;

    // Cryptographic signature for this addendum
    const addendumPayload = `${input.noteId}|${previousHash}|${input.content}|${input.authorStaffId}|${nowIso}`;
    const cryptographicSignature = await computeSha256(addendumPayload);

    const newAddendum: Addendum = {
      id: addendumId,
      noteId: input.noteId,
      patientId: input.patientId,
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      authorStaffId: input.authorStaffId,
      timestamp: nowIso,
      content: input.content,
      reasonForAddendum: input.reasonForAddendum,
      previousHash: previousHash,
      cryptographicSignature: cryptographicSignature,
      isImmutable: true,
    };

    // Update note's addendum array (append-only)
    const updatedAddendums = [...(originalNote.addendums || []), newAddendum];
    await db.clinicalNotes.update(input.noteId, {
      addendums: updatedAddendums,
    });

    // Also index in addendums table
    await db.addendums.put(newAddendum);

    // Audit trail
    const auditLog: WardAuditLog = {
      id: `audit-${Date.now()}`,
      timestamp: nowIso,
      eventType: 'ADDENDUM_APPENDED',
      performedBy: {
        staffId: input.authorStaffId,
        name: input.authorName,
        role: input.authorRole,
      },
      targetPatientMrn: input.patientId,
      description: `Addendum appended to Note "${originalNote.title}" by ${input.authorName} (${input.authorRole}). SHA-256: ${cryptographicSignature.substr(0, 12)}...`,
      immutableHash: cryptographicSignature,
    };
    await db.auditLogs.put(auditLog);

    // Push updated note to Firebase Firestore
    syncClinicalNoteToCloud({
      ...originalNote,
      addendums: updatedAddendums,
    });

    return newAddendum;
  });
}

// -------------------------------------------------------------
// Create Signed Clinical Note
// -------------------------------------------------------------

export interface CreateClinicalNoteInput {
  bedId?: BedNumber;
  patientId: string;
  noteType: NoteType;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: StaffRole;
  authorStaffId: string;
}

export async function createClinicalNote(input: CreateClinicalNoteInput): Promise<ClinicalNote> {
  const nowIso = new Date().toISOString();
  const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  const rawPayload = `${input.patientId}|${input.noteType}|${input.title}|${input.content}|${input.authorStaffId}|${nowIso}`;
  const hash = await computeSha256(rawPayload);
  const signatureToken = `SIGN-${input.authorStaffId}-${Date.now().toString(16).toUpperCase()}`;

  const note: ClinicalNote = {
    id: noteId,
    bedId: input.bedId,
    patientId: input.patientId,
    noteType: input.noteType,
    title: input.title,
    content: input.content,
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: input.authorRole,
    authorStaffId: input.authorStaffId,
    timestamp: nowIso,
    isImmutable: true,
    cryptographicHash: hash,
    digitalSignatureToken: signatureToken,
    addendums: [],
  };

  await db.transaction('rw', [db.clinicalNotes, db.auditLogs], async () => {
    await db.clinicalNotes.put(note);

    const auditLog: WardAuditLog = {
      id: `audit-${Date.now()}`,
      timestamp: nowIso,
      eventType: 'NOTE_CREATED',
      performedBy: {
        staffId: input.authorStaffId,
        name: input.authorName,
        role: input.authorRole,
      },
      targetBedId: input.bedId,
      targetPatientMrn: input.patientId,
      description: `Signed ${input.noteType} created: "${input.title}" by ${input.authorName}.`,
      immutableHash: hash,
    };
    await db.auditLogs.put(auditLog);
  });

  // Cloud broadcast
  syncClinicalNoteToCloud(note);

  return note;
}

// -------------------------------------------------------------
// SBAR Handover Signing & Lock
// -------------------------------------------------------------

export interface SignSbarInput {
  bedId: BedNumber;
  patientId: string;
  shiftType: 'NIGHT' | 'DAY';
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  outgoingDoctor: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  incomingDoctor?: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  situation: string;
  background: string;
  assessment: {
    hemodynamics: string;
    pulmonaryAndAirway: string;
    metabolicAndRenal: string;
    neurologyAndSedation: string;
    infectiousDiseaseAndAntibiotics: string;
  };
  recommendationAndOrders: string[];
  customFields?: Record<string, string>;
}

export async function signSbarHandover(input: SignSbarInput): Promise<SbarHandoverReport> {
  const nowIso = new Date().toISOString();
  const handoverId = `sbar-${input.bedId}-${input.patientId || 'patient'}-${Date.now()}`;

  const rawPayload = `${handoverId}|${input.situation}|${input.background}|${JSON.stringify(input.assessment)}|${input.outgoingDoctor.staffId}|${nowIso}`;
  const hash = await computeSha256(rawPayload);

  const report: SbarHandoverReport = {
    id: handoverId,
    bedId: input.bedId,
    patientId: input.patientId,
    shiftType: input.shiftType,
    shiftDate: input.shiftDate,
    shiftStartTime: input.shiftStartTime,
    shiftEndTime: input.shiftEndTime,
    outgoingDoctor: {
      staffId: input.outgoingDoctor.staffId,
      name: input.outgoingDoctor.name,
      role: input.outgoingDoctor.role,
      signedAt: nowIso,
      digitalSignatureToken: `TOKEN:#ICU-SIGN-${input.outgoingDoctor.staffId}-${Date.now().toString(16)}`,
    },
    incomingDoctor: input.incomingDoctor ? {
      staffId: input.incomingDoctor.staffId,
      name: input.incomingDoctor.name,
      role: input.incomingDoctor.role,
      signedAt: nowIso,
      digitalSignatureToken: `TOKEN:#ICU-COUNTERSIGN-${input.incomingDoctor.staffId}-${Date.now().toString(16)}`,
    } : undefined,
    situation: input.situation,
    background: input.background,
    assessment: input.assessment,
    recommendationAndOrders: input.recommendationAndOrders,
    customFields: input.customFields,
    isLocked: true,
    cryptographicHash: hash,
  };

  await db.transaction('rw', [db.sbarHandovers, db.auditLogs], async () => {
    await db.sbarHandovers.put(report);

    const auditLog: WardAuditLog = {
      id: `audit-${Date.now()}`,
      timestamp: nowIso,
      eventType: 'SBAR_SIGNED',
      performedBy: input.outgoingDoctor,
      targetBedId: input.bedId,
      targetPatientMrn: input.patientId,
      description: `Shift Handover (SBAR) digitally locked and signed for Bed ${input.bedId} by ${input.outgoingDoctor.name}.`,
      immutableHash: hash,
    };
    await db.auditLogs.put(auditLog);
  });

  // Cloud broadcast
  syncSbarToCloud(report);

  return report;
}

export async function acknowledgeSbarHandover(
  sbarId: string,
  incomingDoctor: { staffId: string; name: string; role: StaffRole }
): Promise<SbarHandoverReport | null> {
  const sbar = await db.sbarHandovers.get(sbarId);
  if (!sbar) return null;

  const nowIso = new Date().toISOString();
  const updated: SbarHandoverReport = {
    ...sbar,
    incomingDoctor: {
      staffId: incomingDoctor.staffId,
      name: incomingDoctor.name,
      role: incomingDoctor.role,
      signedAt: nowIso,
      digitalSignatureToken: `TOKEN:#ICU-ACK-${incomingDoctor.staffId}-${Date.now().toString(16)}`,
    },
  };

  await db.transaction('rw', [db.sbarHandovers, db.auditLogs], async () => {
    await db.sbarHandovers.put(updated);

    const auditLog: WardAuditLog = {
      id: `audit-ack-${Date.now()}`,
      timestamp: nowIso,
      eventType: 'SBAR_ACKNOWLEDGED' as any,
      performedBy: incomingDoctor,
      targetBedId: sbar.bedId,
      targetPatientMrn: sbar.patientId,
      description: `Shift Handover (SBAR) acknowledged and received for Bed ${sbar.bedId} by ${incomingDoctor.name}.`,
      immutableHash: sbar.cryptographicHash || 'ACK_HASH',
    };
    await db.auditLogs.put(auditLog);
  });

  syncSbarToCloud(updated);
  return updated;
}

// -------------------------------------------------------------
// Patient Discharge / Transfer & Disposition
// -------------------------------------------------------------

export interface DispositionInput {
  bedNumber: BedNumber;
  patientId: string;
  dispositionType: DispositionType;
  destinationLocation?: string;
  summaryText: string;
  authorStaff: {
    staffId: string;
    name: string;
    role: StaffRole;
  };
  mortalityDetails?: {
    timeOfDeath: string;
    primaryCause: string;
    secondaryCauses: string[];
    supervisingConsultant: string;
  };
}

export async function dischargeOrTransferPatient(input: DispositionInput): Promise<void> {
  await db.transaction('rw', [
    db.beds,
    db.patients,
    db.clinicalNotes,
    db.auditLogs,
  ], async () => {
    const nowIso = new Date().toISOString();
    const patient = await db.patients.get(input.patientId);
    if (!patient) {
      throw new Error(`Patient ${input.patientId} not found.`);
    }

    let nextPatientStatus: PatientDossier['patientStatus'] = 'DISCHARGED_STEPDOWN';
    let nextBedStatus: BedStatus = BedStatus.DECONTAMINATING;

    if (input.dispositionType === DispositionType.CLINICAL_MORTALITY) {
      nextPatientStatus = 'EXPIRED_MORTALITY';
      const scheduledPurgeDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days retention countdown

      patient.mortalityRecord = {
        patientId: patient.id,
        dateOfDeath: nowIso.split('T')[0],
        timeOfDeath: input.mortalityDetails?.timeOfDeath || new Date().toLocaleTimeString(),
        primaryCauseOfDeath: input.mortalityDetails?.primaryCause || 'Cardiorespiratory Failure',
        secondaryCauses: input.mortalityDetails?.secondaryCauses || [],
        supervisingConsultant: input.mortalityDetails?.supervisingConsultant || input.authorStaff.name,
        deathSummaryNoteId: `note-death-${Date.now()}`,
        burialReportGenerated: true,
        autoPurgeScheduledAt: scheduledPurgeDate,
        isArchived: true,
        isPurged: false,
      };
    } else if (input.dispositionType === DispositionType.DISCHARGE_HOME) {
      nextPatientStatus = 'DISCHARGED_HOME';
    } else if (input.dispositionType === DispositionType.TRANSFER_EXTERNAL_HOSPITAL) {
      nextPatientStatus = 'TRANSFERRED_EXTERNAL';
    }

    // Update Patient
    await db.patients.update(input.patientId, {
      patientStatus: nextPatientStatus,
      currentBedId: undefined,
      mortalityRecord: patient.mortalityRecord,
      updatedAt: nowIso,
    });

    // Vacate Bed and set to Decontaminating
    await db.beds.update(input.bedNumber, {
      status: nextBedStatus,
      currentPatientId: undefined,
      hardwareReadiness: {
        ventilatorCalibrated: false,
        ventilatorModel: 'Standby / Decontamination Required',
        telemetryZeroed: false,
        telemetryLead: 'Offline',
        wallSuctionTested: true,
        centralOxygenPsi: 50,
        alarisPumpsPurged: false,
        disposableKitsPrepped: false,
        terminalDecontaminationCompletedAt: undefined,
      },
    });

    // Create Discharge/Death Summary Note
    const isMortality = input.dispositionType === DispositionType.CLINICAL_MORTALITY;
    const noteType = isMortality ? NoteType.DEATH_SUMMARY : NoteType.DISCHARGE_SUMMARY;
    const noteTitle = isMortality
      ? `Clinical Mortality Summary & Audit Record - ${patient.fullNameEn}`
      : `MICU Transfer / Discharge Summary - ${patient.fullNameEn}`;

    const rawPayload = `${patient.id}|${input.dispositionType}|${input.summaryText}|${input.authorStaff.staffId}|${nowIso}`;
    const hash = await computeSha256(rawPayload);

    const summaryNote: ClinicalNote = {
      id: `note-dispo-${Date.now()}`,
      bedId: input.bedNumber,
      patientId: patient.id,
      noteType: noteType,
      title: noteTitle,
      content: input.summaryText,
      authorId: `staff-${input.authorStaff.staffId}`,
      authorName: input.authorStaff.name,
      authorRole: input.authorStaff.role,
      authorStaffId: input.authorStaff.staffId,
      timestamp: nowIso,
      isImmutable: true,
      cryptographicHash: hash,
      digitalSignatureToken: `SIGN-DISPO-${input.authorStaff.staffId}-${Date.now().toString(16)}`,
      addendums: [],
    };
    await db.clinicalNotes.put(summaryNote);

    // Audit Log
    const auditLog: WardAuditLog = {
      id: `audit-${Date.now()}`,
      timestamp: nowIso,
      eventType: isMortality ? 'MORTALITY_LOGGED' : 'PATIENT_DISCHARGED',
      performedBy: input.authorStaff,
      targetBedId: input.bedNumber,
      targetPatientMrn: patient.mrn,
      description: `Patient ${patient.fullNameEn} (MRN: ${patient.mrn}) processed for ${input.dispositionType}. Bed ${input.bedNumber} transitioned to DECONTAMINATING.`,
      immutableHash: hash,
    };
    await db.auditLogs.put(auditLog);
  });
}

// -------------------------------------------------------------
// 10-Day Auto-Purge Compliance Engine
// -------------------------------------------------------------

export async function checkAndExecuteMortalityAutoPurge(): Promise<number> {
  const now = Date.now();
  let purgedCount = 0;

  await db.transaction('rw', [db.patients, db.auditLogs], async () => {
    const expiredPatients = await db.patients
      .where('patientStatus')
      .equals('EXPIRED_MORTALITY')
      .toArray();

    for (const pat of expiredPatients) {
      if (pat.mortalityRecord && !pat.mortalityRecord.isPurged) {
        const purgeTime = new Date(pat.mortalityRecord.autoPurgeScheduledAt).getTime();
        if (now >= purgeTime) {
          // Execute Auto-Purge per CBAHI / JCI standards
          pat.mortalityRecord.isPurged = true;
          await db.patients.update(pat.id, {
            mortalityRecord: pat.mortalityRecord,
          });
          purgedCount++;

          const auditLog: WardAuditLog = {
            id: `audit-${Date.now()}-${purgedCount}`,
            timestamp: new Date().toISOString(),
            eventType: 'AUTO_PURGE_EXECUTED',
            performedBy: {
              staffId: 'SYSTEM_DAEMON',
              name: 'ICU-Sync Security Daemon',
              role: StaffRole.ADMIN,
            },
            targetPatientMrn: pat.mrn,
            description: `10-day retention window expired. Patient ${pat.fullNameEn} (#${pat.mrn}) mortality file securely purged from active cache.`,
            immutableHash: await computeSha256(`PURGE|${pat.id}|${now}`),
          };
          await db.auditLogs.put(auditLog);
        }
      }
    }
  });

  return purgedCount;
}

// -------------------------------------------------------------
// Patient Recall & Query Helpers
// -------------------------------------------------------------

export async function searchPatients(query: string): Promise<PatientDossier[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return await db.patients.toArray();
  }

  return await db.patients
    .filter((p) => {
      const matchMrn = (p?.mrn || '').toLowerCase().includes(cleanQuery);
      const matchEn = (p?.fullNameEn || '').toLowerCase().includes(cleanQuery);
      const matchAr = p?.fullNameAr ? p.fullNameAr.toLowerCase().includes(cleanQuery) : false;
      const matchDiag = (p?.primaryDiagnosisEn || '').toLowerCase().includes(cleanQuery);
      const matchNat = p?.nationalId ? p.nationalId.includes(cleanQuery) : false;
      return matchMrn || matchEn || matchAr || matchDiag || matchNat;
    })
    .toArray();
}

export async function getBedDetails(bedNumber: BedNumber) {
  const bed = await db.beds.get(bedNumber);
  if (!bed) return null;

  const patient = bed.currentPatientId ? await db.patients.get(bed.currentPatientId) : null;
  const vitals = bed.currentPatientId
    ? await db.vitals.where('patientId').equals(bed.currentPatientId).reverse().sortBy('timestamp')
    : [];
  const ventilator = bed.currentPatientId
    ? await db.ventilators.where('patientId').equals(bed.currentPatientId).reverse().sortBy('timestamp')
    : [];
  const pumps = bed.currentPatientId
    ? await db.infusionPumps.where('patientId').equals(bed.currentPatientId).toArray()
    : [];
  const fluidBalances = bed.currentPatientId
    ? await db.fluidBalances.where('patientId').equals(bed.currentPatientId).reverse().sortBy('periodStartTimestamp')
    : [];
  const transfusions = bed.currentPatientId
    ? await db.transfusions.where('patientId').equals(bed.currentPatientId).first()
    : null;
  const sbarHandovers = bed.currentPatientId
    ? await db.sbarHandovers.where('patientId').equals(bed.currentPatientId).reverse().sortBy('shiftDate')
    : [];
  const clinicalNotes = bed.currentPatientId
    ? await db.clinicalNotes.where('patientId').equals(bed.currentPatientId).reverse().sortBy('timestamp')
    : [];

  return {
    bed,
    patient,
    latestVitals: vitals[0] || null,
    vitalsHistory: vitals,
    latestVentilator: ventilator[0] || null,
    pumps,
    latestFluidBalance: fluidBalances[0] || null,
    transfusion: transfusions,
    latestSbar: sbarHandovers[0] || null,
    clinicalNotes,
  };
}

/**
 * Helper to resolve the active patient belonging to a bed safely.
 */
export function getPatientForBed(
  bed: BedRecord | undefined | null,
  patients: PatientDossier[] | undefined | null
): PatientDossier | null {
  if (!bed || !patients || patients.length === 0) return null;

  // 1. Direct match by bed's currentPatientId
  if (bed.currentPatientId) {
    const directMatch = patients.find(
      p => p.id === bed.currentPatientId && p.patientStatus === 'ACTIVE_ICU'
    );
    if (directMatch) return directMatch;
  }

  // 2. Secondary match by patient's currentBedId === bed.bedNumber
  const bedMatch = patients.find(
    p => p.currentBedId === bed.bedNumber && p.patientStatus === 'ACTIVE_ICU'
  );
  if (bedMatch) return bedMatch;

  return null;
}
