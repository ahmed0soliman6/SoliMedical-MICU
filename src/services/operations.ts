import { runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { firestore } from './firebase.ts';
import { 
  COLLECTIONS, 
  PatientContract, 
  BedContract, 
  TransferContract, 
  OperationContract
} from '../types/contracts.ts';
import { db } from '../db/icuSyncDb.ts';
import { BedStatus, BedNumber } from '../types/schema.ts';

const generateId = () => crypto.randomUUID();

/**
 * ADMISSION TRANSACTION
 * Ensures bed is empty, creates patient, operation, and transfer.
 */
export async function executeAdmission(
  patientData: Omit<PatientContract, 'patientId' | 'status' | 'createdAt'>,
  bedId: string,
  doctorId: string,
  unitId: string
): Promise<string> {
  return await runTransaction(firestore, async (transaction) => {
    const bedRef = doc(firestore, COLLECTIONS.BEDS, bedId);
    const bedSnap = await transaction.get(bedRef);
    
    if (!bedSnap.exists()) throw new Error('Bed does not exist');
    
    const bed = bedSnap.data() as BedContract;
    if (bed.activePatientId) throw new Error('Bed is already occupied');

    const patientId = generateId();
    const operationId = generateId();
    const transferId = generateId();

    const patientRef = doc(firestore, COLLECTIONS.PATIENTS, patientId);
    const operationRef = doc(firestore, COLLECTIONS.OPERATIONS, operationId);
    const transferRef = doc(firestore, COLLECTIONS.TRANSFERS, transferId);

    const newPatient: PatientContract = {
      ...patientData,
      patientId,
      status: 'ACTIVE_ICU',
      createdAt: serverTimestamp() as unknown as number,
    };

    const newOperation: OperationContract = {
      operationId,
      operationType: 'ADMISSION',
      initiatedBy: doctorId,
      initiatedAt: serverTimestamp() as unknown as number,
    };

    const newTransfer: TransferContract = {
      transferId,
      unitId,
      patientId,
      transferType: 'ADMISSION',
      operationId,
      fromBedId: null,
      toBedId: bedId,
      transferredBy: doctorId,
      transferredAt: serverTimestamp() as unknown as number,
      reason: 'Initial Admission',
    };

    transaction.set(patientRef, newPatient);
    transaction.set(operationRef, newOperation);
    transaction.set(transferRef, newTransfer);
    
    transaction.update(bedRef, {
      activePatientId: patientId,
      lastTransferId: transferId
    });

    return patientId;
  });
}

/**
 * TRANSFER TRANSACTION
 * Moves patient from one bed to another empty bed atomically.
 * Strictly adheres to patientId persistence and operation audit logging.
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
    
    const fromBedSnap = await transaction.get(fromBedRef);
    const toBedSnap = await transaction.get(toBedRef);

    if (!fromBedSnap.exists() || !toBedSnap.exists()) {
      throw new Error('السرير غير موجود في النظام.');
    }

    const fromBed = fromBedSnap.data() as BedContract;
    const toBed = toBedSnap.data() as BedContract;

    const sourcePatientId = fromBed.activePatientId || (fromBed as any).currentPatientId;
    if (sourcePatientId !== patientId) {
      throw new Error('المريض غير متواجد بالسرير المصدر.');
    }
    const destPatientId = toBed.activePatientId || (toBed as any).currentPatientId;
    if (destPatientId) {
      throw new Error('السرير المستهدف مشغول بالفعل.');
    }
    if ((toBed as any).status === 'UNAVAILABLE') {
      throw new Error('السرير المستهدف غير متاح للخدمة حالياً.');
    }

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
      reason
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
    
    transaction.update(fromBedRef, { 
      activePatientId: null,
      currentPatientId: null,
      status: 'VACANT'
    });
    transaction.update(toBedRef, {
      activePatientId: patientId,
      currentPatientId: patientId,
      status: 'OCCUPIED',
      lastTransferId: transferId
    });

    return transferId;
  });

  // Local state update after successful atomic transaction
  try {
    await db.beds.update(fromBedId, {
      status: BedStatus.VACANT,
      currentPatientId: null,
      activePatientId: null
    });
    await db.beds.update(toBedId, {
      status: BedStatus.OCCUPIED,
      currentPatientId: patientId,
      activePatientId: patientId
    });
    await db.patients.update(patientId, {
      currentBedId: toBedId as BedNumber
    });
  } catch (err) {
    console.warn('Local Dexie update following transfer:', err);
  }

  return transferResult;
}

/**
 * BED SWAP TRANSACTION
 * Swaps two occupied beds atomically in a single Firestore Transaction.
 * Patient medical records remain permanently bound to their fixed patientId.
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
      initiatedAt: serverTimestamp()
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
      reason
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
      reason
    };

    transaction.set(operationRef, newOperation);
    transaction.set(transferARef, transferA);
    transaction.set(transferBRef, transferB);

    transaction.update(bedARef, {
      activePatientId: patientBId,
      currentPatientId: patientBId,
      status: 'OCCUPIED',
      lastTransferId: transferBId
    });

    transaction.update(bedBRef, {
      activePatientId: patientAId,
      currentPatientId: patientAId,
      status: 'OCCUPIED',
      lastTransferId: transferAId
    });

    return operationId;
  });

  // Local state update after successful atomic transaction
  try {
    const bedA = await db.beds.get(bedAId);
    const bedB = await db.beds.get(bedBId);
    const patientAId = bedA?.currentPatientId || bedA?.activePatientId;
    const patientBId = bedB?.currentPatientId || bedB?.activePatientId;

    if (patientAId && patientBId) {
      await db.beds.update(bedAId, {
        status: BedStatus.OCCUPIED,
        currentPatientId: patientBId,
        activePatientId: patientBId
      });
      await db.beds.update(bedBId, {
        status: BedStatus.OCCUPIED,
        currentPatientId: patientAId,
        activePatientId: patientAId
      });
      await db.patients.update(patientAId, {
        currentBedId: bedBId as BedNumber
      });
      await db.patients.update(patientBId, {
        currentBedId: bedAId as BedNumber
      });
    }
  } catch (err) {
    console.warn('Local Dexie update following bed swap:', err);
  }

  return swapResult;
}

/**
 * DISCHARGE TRANSACTION
 * Frees the bed and sets patient status to DISCHARGED atomicaly.
 */
export async function executeDischarge(
  patientId: string,
  fromBedId: string,
  doctorId: string,
  unitId: string,
  reason: string
): Promise<string> {
  return await runTransaction(firestore, async (transaction) => {
    const bedRef = doc(firestore, COLLECTIONS.BEDS, fromBedId);
    const patientRef = doc(firestore, COLLECTIONS.PATIENTS, patientId);

    const bedSnap = await transaction.get(bedRef);
    const patientSnap = await transaction.get(patientRef);

    if (!bedSnap.exists() || !patientSnap.exists()) {
      throw new Error('Records do not exist');
    }

    const bed = bedSnap.data() as BedContract;

    if (bed.activePatientId !== patientId) {
      throw new Error('Patient is not in the specified bed');
    }

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
    
    transaction.update(bedRef, { activePatientId: null });
    transaction.update(patientRef, { status: 'DISCHARGED' });

    return transferId;
  });
}
