import Dexie, { type Table } from 'dexie';
import { 
  BedRecord, 
  BedStatus,
  PatientDossier, 
  TelemetryVitals, 
  VentilatorParameters, 
  InfusionPumpLine, 
  FluidBalance24H, 
  StatLabPanel, 
  TransfusionTracker, 
  SbarHandoverReport, 
  ClinicalNote, 
  Addendum, 
  IcuUser,
  WardAuditLog
} from '../types/schema.ts';

export class IcuSyncDatabase extends Dexie {
  beds!: Table<BedRecord, string>;
  patients!: Table<PatientDossier, string>;
  vitals!: Table<TelemetryVitals, string>;
  ventilators!: Table<VentilatorParameters, string>;
  infusionPumps!: Table<InfusionPumpLine, string>;
  fluidBalances!: Table<FluidBalance24H, string>;
  statLabs!: Table<StatLabPanel, string>;
  transfusions!: Table<TransfusionTracker, string>;
  sbarHandovers!: Table<SbarHandoverReport, string>;
  clinicalNotes!: Table<ClinicalNote, string>;
  addendums!: Table<Addendum, string>;
  users!: Table<IcuUser, string>;
  auditLogs!: Table<WardAuditLog, string>;

  constructor() {
    super('SoliMedicalIcuSyncDB');
    this.version(1).stores({
      beds: 'bedNumber, status, currentPatientId',
      patients: 'id, mrn, fullNameEn, fullNameAr, patientStatus',
      vitals: 'id, bedId, patientId, timestamp',
      ventilators: 'id, bedId, patientId',
      infusionPumps: 'id, patientId, bedId',
      fluidBalances: 'id, patientId, date',
      statLabs: 'id, patientId, bedId, timestamp',
      transfusions: 'id, patientId, bedId, timestamp',
      sbarHandovers: 'id, bedNumber, patientId, timestamp',
      clinicalNotes: 'id, patientId, bedId, authorId, timestamp',
      addendums: 'id, originalNoteId, patientId, timestamp',
      users: 'uid, email, role, badgeId',
      auditLogs: 'id, timestamp, bedNumber, userId, action'
    });
  }
}

export const db = new IcuSyncDatabase();

export async function initializeDatabaseSeed(): Promise<void> {
  const count = await db.beds.count();
  if (count < 6) {
    const initialBeds: BedRecord[] = ['01', '02', '03', '04', '05', '06'].map((num, idx) => ({
      id: num,
      unitId: 'MICU-MAIN',
      bedNumber: num,
      bayName: `Critical Care Bay ${num}`,
      isActive: true,
      displayOrder: idx,
      status: BedStatus.VACANT,
      currentPatientId: null,
      lastCleanedAt: new Date().toISOString()
    }));
    await db.beds.bulkPut(initialBeds);
  }
}

