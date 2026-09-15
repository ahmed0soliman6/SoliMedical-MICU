import { collection, getDocs, query, orderBy, where, doc, getDoc, runTransaction } from 'firebase/firestore';
import { firestore } from './firebase.ts';
import { BedRecord, PatientRecord, BaseMedicalRecord, PatientBedTransfer, HandoverRecord } from '../types/schema.ts';

export async function getAllBeds(): Promise<BedRecord[]> {
  const q = query(collection(firestore, 'beds'), orderBy('displayOrder'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as BedRecord));
}

export async function getAllPatients(): Promise<PatientRecord[]> {
  const snap = await getDocs(collection(firestore, 'patients'));
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as PatientRecord));
}

export async function getMedicalRecords(patientId: string): Promise<BaseMedicalRecord[]> {
  const q = query(collection(firestore, 'medical_records'), where('patientId', '==', patientId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as BaseMedicalRecord));
}

export async function getHandovers(): Promise<HandoverRecord[]> {
  const q = query(collection(firestore, 'sbar_handovers'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as HandoverRecord));
}

export async function getPatientTransfers(patientId: string): Promise<PatientBedTransfer[]> {
  const q = query(collection(firestore, 'transfers'), where('patientId', '==', patientId), orderBy('transferredAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as unknown as PatientBedTransfer));
}
