import { 
  runTransaction, 
  doc, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  getDocs,
  limit 
} from 'firebase/firestore';
import { firestore } from './firebase.ts';
import { 
  COLLECTIONS, 
  PatientContract, 
  BedContract, 
  TransferContract, 
  OperationContract,
  EpisodeContract 
} from '../types/contracts.ts';
import { db, ensureBedPatientSync } from '../db/icuSyncDb.ts';
import { BedStatus, BedNumber, PatientDossier } from '../types/schema.ts';
import { normalizeArabicName, extractLast4, computeSha256Hash } from './patientSearchUtils.ts';
import { toEnglishDigits } from './numberUtils.ts';

const generateId = () => crypto.randomUUID();

export interface AdmissionPayload {
  existingPatientId?: string; // If readmitting an existing patient
  mrn: string;
  nationalId?: string;
  fullNameAr: string;
  fullNameEn?: string;
  age?: number;
  gender?: string;
  bloodType?: string;
  weightKg?: number;
  heightCm?: number;
  codeStatus?: string;
  acuityLevel?: string;
  primaryDiagnosisAr?: string;
  primaryDiagnosisEn?: string;
  allergies?: string[];
  chronicDiseases?: string[];
  history?: string;
  presentingComplaint?: string;
}

export interface PatientCandidateMatch {
  patientId: string;
  mrn: string;
  fullNameAr: string;
  fullNameEn?: string;
  nationalIdLast4: string;
  gender?: string;
  age?: number;
  bloodType?: string;
  lastAdmissionDate?: string | number;
  lastDiagnosis?: string;
  allergies?: string[];
  chronicDiseases?: string[];
  matchType: 'MRN_EXACT' | 'NAME_AND_NATIONAL_ID_EXACT' | 'NAME_PARTIAL';
}

/**
 * Searches for existing registered patients by MRN or (Normalized Name + Last 4 digits of National ID).
 * Never performs destructive or automatic merges; returns candidates for clinician confirmation.
 */
export async function searchExistingPatients(
  inputName: string,
  inputNationalId: string,
  inputMrn?: string
): Promise<PatientCandidateMatch[]> {
  const matches: PatientCandidateMatch[] = [];
  const cleanMrn = inputMrn ? toEnglishDigits(inputMrn).trim() : '';
  const last4 = extractLast4(inputNationalId);
  const normalizedName = normalizeArabicName(inputName);

  const queryAndAdd = async (collName: string, qField: string, qValue: any, matchType: 'MRN_EXACT' | 'NAME_AND_NATIONAL_ID_EXACT', compoundCheck?: { field: string; value: any }) => {
    try {
      let q;
      if (compoundCheck) {
        q = query(
          collection(firestore, collName),
          where(qField, '==', qValue),
          where(compoundCheck.field, '==', compoundCheck.value),
          limit(5)
        );
      } else {
        q = query(
          collection(firestore, collName),
          where(qField, '==', qValue),
          limit(5)
        );
      }
      const snap = await getDocs(q);
      snap.forEach((d) => {
        const data = d.data() as any;
        const pId = data.patientId || data.id || d.id;
        if (!matches.some((m) => m.patientId === pId)) {
          matches.push({
            patientId: pId,
            mrn: data.mrn,
            fullNameAr: data.fullNameAr || data.fullName,
            fullNameEn: data.fullNameEn,
            nationalIdLast4: data.nationalIdLast4 || '',
            gender: data.gender,
            bloodType: data.bloodGroup || data.bloodType,
            allergies: data.allergiesSummary || (data.allergies && Array.isArray(data.allergies) ? data.allergies.map((a: any) => typeof a === 'string' ? a : a.allergen) : []),
            chronicDiseases: data.chronicConditionsSummary || (data.chronicDiseases && (typeof data.chronicDiseases === 'string' ? [data.chronicDiseases] : data.chronicDiseases)) || [],
            matchType,
          });
        }
      });
    } catch (e) {
      console.warn(`Firestore search on ${collName} failed:`, e);
    }
  };

  // 1. Exact MRN Search (Highest Priority)
  if (cleanMrn) {
    await queryAndAdd(COLLECTIONS.PATIENTS, 'mrn', cleanMrn, 'MRN_EXACT');
    await queryAndAdd('archivedPatients', 'mrn', cleanMrn, 'MRN_EXACT');
  }

  // 2. Strict Compound Match (Normalized Full Name + Last 4 digits ID)
  if (normalizedName && last4 && last4.length === 4) {
    await queryAndAdd(COLLECTIONS.PATIENTS, 'normalizedFullName', normalizedName, 'NAME_AND_NATIONAL_ID_EXACT', { field: 'nationalIdLast4', value: last4 });
    await queryAndAdd('archivedPatients', 'normalizedFullName', normalizedName, 'NAME_AND_NATIONAL_ID_EXACT', { field: 'nationalIdLast4', value: last4 });
  }

  // 3. Fallback search on local Dexie cache if online search returned no hits or was offline
  if (matches.length === 0) {
    try {
      const localPatients = await db.patients.toArray();
      for (const p of localPatients) {
        const pNorm = normalizeArabicName(p.fullNameAr || p.fullNameEn);
        const pLast4 = extractLast4(p.nationalId);
        const pMrn = toEnglishDigits(p.mrn).trim();

        if (cleanMrn && pMrn === cleanMrn) {
          matches.push({
            patientId: p.id,
            mrn: p.mrn,
            fullNameAr: p.fullNameAr || p.fullNameEn,
            fullNameEn: p.fullNameEn,
            nationalIdLast4: pLast4,
            gender: p.gender,
            age: p.age,
            bloodType: p.bloodType,
            lastAdmissionDate: p.admissionDate,
            lastDiagnosis: p.primaryDiagnosisAr || p.primaryDiagnosisEn,
            allergies: p.allergies?.map((a) => a.allergen),
            matchType: 'MRN_EXACT',
          });
        } else if (normalizedName && last4 && pNorm === normalizedName && pLast4 === last4) {
          matches.push({
            patientId: p.id,
            mrn: p.mrn,
            fullNameAr: p.fullNameAr || p.fullNameEn,
            fullNameEn: p.fullNameEn,
            nationalIdLast4: pLast4,
            gender: p.gender,
            age: p.age,
            bloodType: p.bloodType,
            lastAdmissionDate: p.admissionDate,
            lastDiagnosis: p.primaryDiagnosisAr || p.primaryDiagnosisEn,
            allergies: p.allergies?.map((a) => a.allergen),
            matchType: 'NAME_AND_NATIONAL_ID_EXACT',
          });
        }
      }
    } catch (err) {
      console.warn('Local Dexie candidate search warning:', err);
    }
  }

  return matches;
}

/**
 * ATOMIC ADMISSION TRANSACTION
 * Supports brand new admissions and readmissions of existing patients.
 * Syncs patients.currentBedId and beds.activePatientId atomically.
 */
export async function executeAdmission(
  payload: AdmissionPayload,
  bedId: string,
  doctorId: string,
  doctorName: string,
  unitId: string
): Promise<{ patientId: string; episodeId: string; transferId: string }> {
  const patientId = payload.existingPatientId || generateId();
  const episodeId = generateId();
  const operationId = generateId();
  const transferId = generateId();

  const isReadmission = !!payload.existingPatientId;
  const nowMs = Date.now();
  const last4 = extractLast4(payload.nationalId);
  const normalizedName = normalizeArabicName(payload.fullNameAr || payload.fullNameEn);
  const idHash = payload.nationalId ? await computeSha256Hash(payload.nationalId) : '';

  await runTransaction(firestore, async (transaction) => {
    const bedRef = doc(firestore, COLLECTIONS.BEDS, bedId);
    const bedSnap = await transaction.get(bedRef);

    if (!bedSnap.exists()) {
      throw new Error('السرير غير مسجل في النظام.');
    }

    const bedData = bedSnap.data() as BedContract;
    if (bedData.activePatientId) {
      throw new Error('السرير المختار مشغول حالياً بمريض آخر.');
    }

    const patientRef = doc(firestore, COLLECTIONS.PATIENTS, patientId);
    const episodeRef = doc(firestore, COLLECTIONS.EPISODES, episodeId);
    const operationRef = doc(firestore, COLLECTIONS.OPERATIONS, operationId);
    const transferRef = doc(firestore, COLLECTIONS.TRANSFERS, transferId);

    const patientDoc: PatientContract = {
      patientId,
      unitId,
      mrn: toEnglishDigits(payload.mrn).trim(),
      fullName: payload.fullNameAr || payload.fullNameEn || '',
      fullNameAr: payload.fullNameAr,
      fullNameEn: payload.fullNameEn || payload.fullNameAr,
      normalizedFullName: normalizedName,
      nationalIdLast4: last4,
      nationalIdHash: idHash,
      dateOfBirth: '',
      gender: (payload.gender as any) || 'OTHER',
      bloodGroup: payload.bloodType,
      idealBodyWeightKg: payload.weightKg,
      allergiesSummary: payload.allergies || [],
      chronicConditionsSummary: payload.chronicDiseases || [],
      currentStatus: 'ACTIVE_ICU',
      status: 'ACTIVE_ICU',
      currentBedId: bedId,
      currentEpisodeId: episodeId,
      codeStatus: payload.codeStatus || 'FULL_CODE',
      acuityLevel: payload.acuityLevel || 'CRITICAL_STAT',
      archiveStatus: 'HOT',
      archiveDate: null,
      archiveStoragePath: null,
      archiveId: null,
      createdAt: isReadmission ? (undefined as any) : (serverTimestamp() as unknown as number),
      createdBy: doctorId,
      createdByUid: doctorId,
      updatedAt: serverTimestamp() as unknown as number,
      updatedByUid: doctorId,
    };

    const newEpisode: EpisodeContract = {
      episodeId,
      patientId,
      bedId,
      unitId,
      admissionDate: nowMs,
      dischargeDate: null,
      admittingDoctorUid: doctorId,
      admittingDoctorName: doctorName || doctorId,
      primaryDiagnosis: payload.primaryDiagnosisEn || payload.primaryDiagnosisAr || '',
      primaryDiagnosisAr: payload.primaryDiagnosisAr,
      primaryDiagnosisEn: payload.primaryDiagnosisEn,
      acuityLevel: payload.acuityLevel,
      codeStatus: payload.codeStatus,
      status: 'ACTIVE',
      createdAt: nowMs,
      updatedAt: nowMs,
    };

    const newOperation: OperationContract = {
      operationId,
      operationType: isReadmission ? 'READMISSION' : 'ADMISSION',
      initiatedBy: doctorId,
      initiatedAt: serverTimestamp() as unknown as number,
    };

    const newTransfer: TransferContract = {
      transferId,
      unitId,
      patientId,
      transferType: isReadmission ? 'READMISSION' : 'ADMISSION',
      operationId,
      fromBedId: null,
      toBedId: bedId,
      transferredBy: doctorName || doctorId,
      transferredAt: serverTimestamp() as unknown as number,
      reason: isReadmission ? 'Patient Readmission' : 'Initial Direct Admission',
    };

    if (isReadmission) {
      transaction.set(patientRef, patientDoc, { merge: true });
      const archivedRef = doc(firestore, 'archivedPatients', patientId);
      transaction.delete(archivedRef);
    } else {
      transaction.set(patientRef, patientDoc);
    }

    transaction.set(episodeRef, newEpisode);
    transaction.set(operationRef, newOperation);
    transaction.set(transferRef, newTransfer);

    transaction.update(bedRef, {
      activePatientId: patientId,
      currentPatientId: patientId,
      status: 'OCCUPIED',
      lastTransferId: transferId,
    });
  });

  return { patientId, episodeId, transferId };
}

/**
 * ATOMIC TRANSFER TRANSACTION
 * Moves patient from one bed to another empty bed atomically.
 * Updates both fromBed, toBed, and patients.currentBedId in a single transaction.
 */
export async function executeTransfer(
  patientId: string,
  fromBedId: string,
  toBedId: string,
  doctorId: string,
  unitId: string,
  reason: string,
  doctorName?: string
): Promise<string> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('لا يمكن تنفيذ عملية النقل أثناء انقطاع الاتصال (Offline). يرجى التأكد من اتصال الإنترنت.');
  }

  const transferResult = await runTransaction(firestore, async (transaction) => {
    const fromBedRef = doc(firestore, COLLECTIONS.BEDS, fromBedId);
    const toBedRef = doc(firestore, COLLECTIONS.BEDS, toBedId);
    const patientRef = doc(firestore, COLLECTIONS.PATIENTS, patientId);

    const fromBedSnap = await transaction.get(fromBedRef);
    const toBedSnap = await transaction.get(toBedRef);
    const patientSnap = await transaction.get(patientRef);

    if (!fromBedSnap.exists() || !toBedSnap.exists() || !patientSnap.exists()) {
      throw new Error('بيانات السرير أو المريض غير موجودة في النظام.');
    }

    const fromBed = fromBedSnap.data() as any;
    const toBed = toBedSnap.data() as any;
    const patientData = patientSnap.data() as any;

    const sourcePatientId = fromBed.activePatientId || fromBed.currentPatientId;
    if (sourcePatientId !== patientId) {
      throw new Error('المريض غير متواجد بالسرير المصدر.');
    }
    const destPatientId = toBed.activePatientId || toBed.currentPatientId;
    if (destPatientId) {
      throw new Error('السرير المستهدف مشغول بالفعل.');
    }
    if (toBed.status === 'UNAVAILABLE') {
      throw new Error('السرير المستهدف غير متاح للخدمة حالياً.');
    }

    const isPatientIsolated = !!(
      (patientData.isolationPrecautions && patientData.isolationPrecautions.length > 0) ||
      (fromBed.isolation && fromBed.isolation.isIsolated) ||
      fromBed.status === 'ISOLATION'
    );

    const isolationPayload = isPatientIsolated
      ? (fromBed.isolation && fromBed.isolation.isIsolated
          ? fromBed.isolation
          : {
              isIsolated: true,
              type: 'Airborne',
              reason: 'Clinical Isolation',
              startDate: new Date().toISOString(),
              precautions: patientData.isolationPrecautions || [],
            })
      : { isIsolated: false, precautions: [] };

    const operationId = generateId();
    const transferId = generateId();

    const operationRef = doc(firestore, COLLECTIONS.OPERATIONS, operationId);
    const transferRef = doc(firestore, COLLECTIONS.TRANSFERS, transferId);

    const newOperation = {
      operationId,
      operationType: 'TRANSFER',
      patientId,
      fromBedId,
      toBedId,
      doctorId,
      doctorName: doctorName || doctorId,
      createdAt: Date.now(),
      initiatedBy: doctorId,
      initiatedAt: serverTimestamp(),
      reason,
    };

    const newTransfer: TransferContract = {
      transferId,
      unitId,
      patientId,
      transferType: 'TRANSFER',
      operationId,
      fromBedId,
      toBedId,
      transferredBy: doctorName || doctorId,
      transferredAt: serverTimestamp() as unknown as number,
      reason,
    };

    transaction.set(operationRef, newOperation);
    transaction.set(transferRef, newTransfer);

    // 1. Release source bed completely in Firestore
    transaction.update(fromBedRef, {
      activePatientId: null,
      currentPatientId: null,
      status: 'VACANT',
      isolation: { isIsolated: false, precautions: [] },
      updatedAt: Date.now(),
    });

    // 2. Assign target bed in Firestore
    transaction.update(toBedRef, {
      activePatientId: patientId,
      currentPatientId: patientId,
      status: isPatientIsolated ? 'ISOLATION' : 'OCCUPIED',
      isolation: isPatientIsolated ? isolationPayload : { isIsolated: false, precautions: [] },
      lastTransferId: transferId,
      updatedAt: Date.now(),
    });

    // 3. Update patient's current bed in Firestore
    transaction.update(patientRef, {
      currentBedId: toBedId,
      isolationPrecautions: isPatientIsolated ? (isolationPayload.precautions && isolationPayload.precautions.length > 0 ? isolationPayload.precautions : ['Contact Precautions']) : [],
      updatedAt: serverTimestamp(),
      updatedByUid: doctorId,
    });

    return transferId;
  });

  // Local cache update
  try {
    const fromBed = await db.beds.get(fromBedId);
    const pat = await db.patients.get(patientId);
    const isIsolated = !!(
      (pat?.isolationPrecautions && pat.isolationPrecautions.length > 0) ||
      (fromBed?.isolation && fromBed.isolation.isIsolated) ||
      fromBed?.status === BedStatus.ISOLATION
    );
    const isolationPayload = isIsolated
      ? (fromBed?.isolation && fromBed.isolation.isIsolated
          ? fromBed.isolation
          : {
              isIsolated: true,
              type: 'Airborne',
              reason: 'Clinical Isolation',
              startDate: new Date().toISOString(),
              precautions: pat?.isolationPrecautions || ['Contact Precautions'],
            })
      : { isIsolated: false, precautions: [] };

    await db.beds.update(fromBedId, {
      status: BedStatus.VACANT,
      currentPatientId: null,
      activePatientId: null,
      isolation: { isIsolated: false, precautions: [] },
    });
    await db.beds.update(toBedId, {
      status: isIsolated ? BedStatus.ISOLATION : BedStatus.OCCUPIED,
      currentPatientId: patientId,
      activePatientId: patientId,
      isolation: isIsolated ? isolationPayload : { isIsolated: false, precautions: [] },
    });
    await db.patients.update(patientId, {
      currentBedId: toBedId as BedNumber,
      isolationPrecautions: isIsolated ? (isolationPayload.precautions && isolationPayload.precautions.length > 0 ? isolationPayload.precautions : ['Contact Precautions']) : [],
      updatedAt: new Date().toISOString(),
    });
    await ensureBedPatientSync();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('icu-data-updated'));
    }
  } catch (err) {
    console.warn('Local Dexie update following transfer:', err);
  }

  return transferResult;
}

/**
 * ATOMIC BED SWAP TRANSACTION
 * Swaps two occupied beds atomically in a single Firestore Transaction.
 * Updates bedA, bedB, patientA, patientB together.
 */
export async function executeBedSwap(
  bedAId: string,
  bedBId: string,
  doctorId: string,
  doctorName: string,
  unitId: string,
  reason: string
): Promise<string> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('لا يمكن تنفيذ عملية تبديل الأسرة أثناء انقطاع الاتصال (Offline). يرجى التأكد من اتصال الإنترنت.');
  }

  if (bedAId === bedBId) {
    throw new Error('لا يمكن تبديل السرير مع نفسه.');
  }

  const swapResult = await runTransaction(firestore, async (transaction) => {
    const bedARef = doc(firestore, COLLECTIONS.BEDS, bedAId);
    const bedBRef = doc(firestore, COLLECTIONS.BEDS, bedBId);

    const bedASnap = await transaction.get(bedARef);
    const bedBSnap = await transaction.get(bedBRef);

    if (!bedASnap.exists() || !bedBSnap.exists()) {
      throw new Error('أحد السريرين غير موجود.');
    }

    const bedAData = bedASnap.data() as any;
    const bedBData = bedBSnap.data() as any;

    const patientAId = bedAData.activePatientId || bedAData.currentPatientId;
    const patientBId = bedBData.activePatientId || bedBData.currentPatientId;

    if (!patientAId || !patientBId) {
      throw new Error('كلا السريرين يجب أن يكونا مشغولين لتنفيذ عملية التبديل.');
    }

    if (bedAData.status === 'UNAVAILABLE' || bedBData.status === 'UNAVAILABLE') {
      throw new Error('أحد السريرين غير متاح للخدمة.');
    }

    const patientARef = doc(firestore, COLLECTIONS.PATIENTS, patientAId);
    const patientBRef = doc(firestore, COLLECTIONS.PATIENTS, patientBId);

    const patientASnap = await transaction.get(patientARef);
    const patientBSnap = await transaction.get(patientBRef);

    const patientAData = patientASnap.exists() ? (patientASnap.data() as any) : {};
    const patientBData = patientBSnap.exists() ? (patientBSnap.data() as any) : {};

    const isPatientAIsolated = !!(
      (patientAData.isolationPrecautions && patientAData.isolationPrecautions.length > 0) ||
      (bedAData.isolation && bedAData.isolation.isIsolated) ||
      bedAData.status === 'ISOLATION'
    );
    const isPatientBIsolated = !!(
      (patientBData.isolationPrecautions && patientBData.isolationPrecautions.length > 0) ||
      (bedBData.isolation && bedBData.isolation.isIsolated) ||
      bedBData.status === 'ISOLATION'
    );

    const isolationA = isPatientAIsolated
      ? (bedAData.isolation && bedAData.isolation.isIsolated
          ? bedAData.isolation
          : { isIsolated: true, type: 'Airborne', reason: 'Clinical Isolation', startDate: new Date().toISOString(), precautions: patientAData.isolationPrecautions || ['Contact Precautions'] })
      : { isIsolated: false, precautions: [] };

    const isolationB = isPatientBIsolated
      ? (bedBData.isolation && bedBData.isolation.isIsolated
          ? bedBData.isolation
          : { isIsolated: true, type: 'Airborne', reason: 'Clinical Isolation', startDate: new Date().toISOString(), precautions: patientBData.isolationPrecautions || ['Contact Precautions'] })
      : { isIsolated: false, precautions: [] };

    const operationId = generateId();
    const transferAId = generateId();
    const transferBId = generateId();

    const operationRef = doc(firestore, COLLECTIONS.OPERATIONS, operationId);
    const transferARef = doc(firestore, COLLECTIONS.TRANSFERS, transferAId);
    const transferBRef = doc(firestore, COLLECTIONS.TRANSFERS, transferBId);

    const newOperation = {
      operationId,
      operationType: 'BED_SWAP',
      bedAId,
      bedBId,
      patientAId,
      patientBId,
      reason,
      performedBy: doctorName || doctorId,
      doctorId,
      doctorName,
      createdAt: Date.now(),
      initiatedBy: doctorId,
      initiatedAt: serverTimestamp(),
    };

    const transferA = {
      transferId: transferAId,
      unitId,
      patientId: patientAId,
      transferType: 'BED_SWAP',
      operationId,
      fromBedId: bedAId,
      toBedId: bedBId,
      transferredBy: doctorName || doctorId,
      transferredAt: serverTimestamp(),
      reason,
    };

    const transferB = {
      transferId: transferBId,
      unitId,
      patientId: patientBId,
      transferType: 'BED_SWAP',
      operationId,
      fromBedId: bedBId,
      toBedId: bedAId,
      transferredBy: doctorName || doctorId,
      transferredAt: serverTimestamp(),
      reason,
    };

    transaction.set(operationRef, newOperation);
    transaction.set(transferARef, transferA);
    transaction.set(transferBRef, transferB);

    // Bed A now receives Patient B -> takes on Patient B's isolation status
    transaction.update(bedARef, {
      activePatientId: patientBId,
      currentPatientId: patientBId,
      status: isPatientBIsolated ? 'ISOLATION' : 'OCCUPIED',
      isolation: isPatientBIsolated ? isolationB : { isIsolated: false, precautions: [] },
      lastTransferId: transferBId,
      updatedAt: Date.now(),
    });

    // Bed B now receives Patient A -> takes on Patient A's isolation status
    transaction.update(bedBRef, {
      activePatientId: patientAId,
      currentPatientId: patientAId,
      status: isPatientAIsolated ? 'ISOLATION' : 'OCCUPIED',
      isolation: isPatientAIsolated ? isolationA : { isIsolated: false, precautions: [] },
      lastTransferId: transferAId,
      updatedAt: Date.now(),
    });

    transaction.update(patientARef, {
      currentBedId: bedBId,
      isolationPrecautions: isPatientAIsolated ? (isolationA.precautions && isolationA.precautions.length > 0 ? isolationA.precautions : ['Contact Precautions']) : [],
      updatedAt: serverTimestamp(),
      updatedByUid: doctorId,
    });

    transaction.update(patientBRef, {
      currentBedId: bedAId,
      isolationPrecautions: isPatientBIsolated ? (isolationB.precautions && isolationB.precautions.length > 0 ? isolationB.precautions : ['Contact Precautions']) : [],
      updatedAt: serverTimestamp(),
      updatedByUid: doctorId,
    });

    return operationId;
  });

  // Local state update
  try {
    const bedA = await db.beds.get(bedAId);
    const bedB = await db.beds.get(bedBId);
    const patientAId = bedA?.currentPatientId || bedA?.activePatientId;
    const patientBId = bedB?.currentPatientId || bedB?.activePatientId;

    if (patientAId && patientBId) {
      const patA = await db.patients.get(patientAId);
      const patB = await db.patients.get(patientBId);

      const isPatientAIsolated = !!(
        (patA?.isolationPrecautions && patA.isolationPrecautions.length > 0) ||
        (bedA?.isolation && bedA.isolation.isIsolated) ||
        bedA?.status === BedStatus.ISOLATION
      );
      const isPatientBIsolated = !!(
        (patB?.isolationPrecautions && patB.isolationPrecautions.length > 0) ||
        (bedB?.isolation && bedB.isolation.isIsolated) ||
        bedB?.status === BedStatus.ISOLATION
      );

      const isolationA = isPatientAIsolated
        ? (bedA?.isolation && bedA.isolation.isIsolated
            ? bedA.isolation
            : { isIsolated: true, type: 'Airborne', reason: 'Clinical Isolation', startDate: new Date().toISOString(), precautions: patA?.isolationPrecautions || ['Contact Precautions'] })
        : { isIsolated: false, precautions: [] };

      const isolationB = isPatientBIsolated
        ? (bedB?.isolation && bedB.isolation.isIsolated
            ? bedB.isolation
            : { isIsolated: true, type: 'Airborne', reason: 'Clinical Isolation', startDate: new Date().toISOString(), precautions: patB?.isolationPrecautions || ['Contact Precautions'] })
        : { isIsolated: false, precautions: [] };

      await db.beds.update(bedAId, {
        status: isPatientBIsolated ? BedStatus.ISOLATION : BedStatus.OCCUPIED,
        currentPatientId: patientBId,
        activePatientId: patientBId,
        isolation: isPatientBIsolated ? isolationB : { isIsolated: false, precautions: [] },
      });
      await db.beds.update(bedBId, {
        status: isPatientAIsolated ? BedStatus.ISOLATION : BedStatus.OCCUPIED,
        currentPatientId: patientAId,
        activePatientId: patientAId,
        isolation: isPatientAIsolated ? isolationA : { isIsolated: false, precautions: [] },
      });
      await db.patients.update(patientAId, {
        currentBedId: bedBId as BedNumber,
        isolationPrecautions: isPatientAIsolated ? (isolationA.precautions && isolationA.precautions.length > 0 ? isolationA.precautions : ['Contact Precautions']) : [],
        updatedAt: new Date().toISOString(),
      });
      await db.patients.update(patientBId, {
        currentBedId: bedAId as BedNumber,
        isolationPrecautions: isPatientBIsolated ? (isolationB.precautions && isolationB.precautions.length > 0 ? isolationB.precautions : ['Contact Precautions']) : [],
        updatedAt: new Date().toISOString(),
      });
      await ensureBedPatientSync();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('icu-data-updated'));
      }
    }
  } catch (err) {
    console.warn('Local Dexie update following bed swap:', err);
  }

  return swapResult;
}

/**
 * ATOMIC DISCHARGE TRANSACTION
 * Frees the bed and updates patient status to DISCHARGED atomically.
 * Medical records remain permanently untouched.
 */
export async function executeDischarge(
  patientId: string,
  fromBedId: string,
  doctorId: string,
  unitId: string,
  reason: string,
  outcome: string = 'DISCHARGED_STEPDOWN'
): Promise<string> {
  const dischargeResult = await runTransaction(firestore, async (transaction) => {
    const bedRef = doc(firestore, COLLECTIONS.BEDS, fromBedId);
    const patientRef = doc(firestore, COLLECTIONS.PATIENTS, patientId);

    const bedSnap = await transaction.get(bedRef);
    const patientSnap = await transaction.get(patientRef);

    if (!bedSnap.exists() || !patientSnap.exists()) {
      throw new Error('Records do not exist');
    }

    const bed = bedSnap.data() as any;
    const activePatId = bed.activePatientId || bed.currentPatientId;
    if (activePatId !== patientId) {
      throw new Error('المريض غير متواجد بالسرير المحدد.');
    }

    const patientData = patientSnap.data() as PatientContract;
    const currentEpisodeId = patientData.currentEpisodeId;

    const operationId = generateId();
    const transferId = generateId();

    const operationRef = doc(firestore, COLLECTIONS.OPERATIONS, operationId);
    const transferRef = doc(firestore, COLLECTIONS.TRANSFERS, transferId);

    const newOperation: OperationContract = {
      operationId,
      operationType: 'DISCHARGE',
      initiatedBy: doctorId,
      initiatedAt: serverTimestamp() as unknown as number,
    };

    const newTransfer: TransferContract = {
      transferId,
      unitId,
      patientId,
      transferType: 'DISCHARGE',
      operationId,
      fromBedId,
      toBedId: null,
      transferredBy: doctorId,
      transferredAt: serverTimestamp() as unknown as number,
      reason,
    };

    transaction.set(operationRef, newOperation);
    transaction.set(transferRef, newTransfer);

    transaction.update(bedRef, {
      activePatientId: null,
      currentPatientId: null,
      status: 'VACANT',
      isolation: { isIsolated: false, precautions: [] },
      updatedAt: Date.now(),
    });

    transaction.update(patientRef, {
      currentStatus: 'DISCHARGED',
      patientStatus: outcome,
      status: 'DISCHARGED',
      currentBedId: null,
      isArchived: true,
      dischargeDate: new Date().toISOString(),
      updatedAt: serverTimestamp(),
      updatedByUid: doctorId,
    });

    if (currentEpisodeId) {
      const episodeRef = doc(firestore, COLLECTIONS.EPISODES, currentEpisodeId);
      transaction.update(episodeRef, {
        dischargeDate: Date.now(),
        status: 'DISCHARGED',
        outcome,
        updatedAt: Date.now(),
      });
    }

    return transferId;
  });

  try {
    await db.beds.update(fromBedId, {
      status: BedStatus.VACANT,
      currentPatientId: null,
      activePatientId: null,
      isolation: { isIsolated: false, precautions: [] },
    });
    await db.patients.update(patientId, {
      patientStatus: outcome as any,
      currentBedId: null as any,
      archiveStatus: 'ARCHIVED',
      updatedAt: new Date().toISOString(),
    });
    await ensureBedPatientSync();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('icu-data-updated'));
    }
  } catch (err) {
    console.warn('Local Dexie update following discharge:', err);
  }

  return dischargeResult;
}
