import { runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { firestore } from './firebase.ts';
import { 
  COLLECTIONS, 
  PatientContract, 
  BedContract, 
  TransferContract, 
  OperationContract
} from '../types/contracts.ts';

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
 * Moves patient from one bed to another empty bed atomicaly.
 */
export async function executeTransfer(
  patientId: string,
  fromBedId: string,
  toBedId: string,
  doctorId: string,
  unitId: string,
  reason: string
): Promise<string> {
  return await runTransaction(firestore, async (transaction) => {
    const fromBedRef = doc(firestore, COLLECTIONS.BEDS, fromBedId);
    const toBedRef = doc(firestore, COLLECTIONS.BEDS, toBedId);
    
    const fromBedSnap = await transaction.get(fromBedRef);
    const toBedSnap = await transaction.get(toBedRef);

    if (!fromBedSnap.exists() || !toBedSnap.exists()) {
      throw new Error('Beds do not exist');
    }

    const fromBed = fromBedSnap.data() as BedContract;
    const toBed = toBedSnap.data() as BedContract;

    if (fromBed.activePatientId !== patientId) {
      throw new Error('Patient is not in the source bed');
    }
    if (toBed.activePatientId) {
      throw new Error('Destination bed is already occupied');
    }

    const operationId = generateId();
    const transferId = generateId();

    const operationRef = doc(firestore, COLLECTIONS.OPERATIONS, operationId);
    const transferRef = doc(firestore, COLLECTIONS.TRANSFERS, transferId);

    const newOperation: OperationContract = {
      operationId,
      operationType: 'TRANSFER',
      initiatedBy: doctorId,
      initiatedAt: serverTimestamp() as unknown as number,
    };

    const newTransfer: TransferContract = {
      transferId,
      unitId,
      patientId,
      transferType: 'TRANSFER',
      operationId,
      fromBedId,
      toBedId,
      transferredBy: doctorId,
      transferredAt: serverTimestamp() as unknown as number,
      reason,
    };

    transaction.set(operationRef, newOperation);
    transaction.set(transferRef, newTransfer);
    
    transaction.update(fromBedRef, { activePatientId: null });
    transaction.update(toBedRef, {
      activePatientId: patientId,
      lastTransferId: transferId
    });

    return transferId;
  });
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
