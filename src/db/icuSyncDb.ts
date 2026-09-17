import Dexie, { type Table } from 'dexie';
import { 
  BedRecord, 
  BedStatus,
  BedNumber,
  PatientDossier, 
  TelemetryVitals, 
  VentilatorParameters, 
  VentilatorMode,
  InfusionPumpLine, 
  FluidBalance24H, 
  StatLabPanel, 
  TransfusionTracker, 
  SbarHandoverReport, 
  ClinicalNote, 
  Addendum, 
  IcuUser,
  WardAuditLog,
  LabResultItem,
  InvestigationItem,
  PatientAntibiotic,
  Gender,
  CodeStatus,
  IntakePathway,
  AcuityLevel,
  StaffRole
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
  labResults!: Table<LabResultItem, string>;
  investigations!: Table<InvestigationItem, string>;
  patientAntibiotics!: Table<PatientAntibiotic, string>;

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

    this.version(2).stores({
      labResults: 'id, patientId, testName, timestamp, status',
      investigations: 'id, patientId, modality, timestamp, status'
    });

    this.version(3).stores({
      patients: 'id, mrn, fullNameEn, fullNameAr, patientStatus, currentBedId',
    });

    this.version(4).stores({
      patientAntibiotics: 'id, patientId, bedNumber, drugNameEn, status, startDate',
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
      status: idx === 0 ? BedStatus.OCCUPIED : idx === 1 ? BedStatus.OCCUPIED : idx === 2 ? BedStatus.ISOLATION : idx === 5 ? BedStatus.UNAVAILABLE : BedStatus.VACANT,
      currentPatientId: idx === 0 ? 'pat-bed-01' : idx === 1 ? 'pat-bed-02' : null,
      lastCleanedAt: new Date().toISOString()
    }));
    await db.beds.bulkPut(initialBeds);
  }

  // Seed initial demonstration patients if empty
  const patientCount = await db.patients.count();
  if (patientCount === 0) {
    const now = Date.now();
    const threeDaysAgo = new Date(now - 3 * 24 * 3600 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 2 * 24 * 3600 * 1000).toISOString();
    const oneDayAgo = new Date(now - 1 * 24 * 3600 * 1000).toISOString();
    const today = new Date(now).toISOString();

    const p1: PatientDossier = {
      id: 'pat-bed-01',
      mrn: 'MRN-104928',
      phoneNumber: '01098765432',
      nationalId: '26508120109283',
      fullNameEn: 'Mahmoud El-Sayed El-Sherif',
      fullNameAr: 'محمود السيد الشريف',
      age: 62,
      gender: Gender.MALE as any,
      weightKg: 78,
      heightCm: 172,
      idealBodyWeightKg: 70,
      codeStatus: CodeStatus.FULL_CODE as any,
      primaryDiagnosisEn: 'Acute Respiratory Distress Syndrome (ARDS) secondary to Septic Shock',
      primaryDiagnosisAr: 'متلازمة الضائقة التنفسية الحادة (ARDS) الناتجة عن صدمة إنتانية',
      intakePathway: IntakePathway.STAT_CRITICAL as any,
      admissionDate: threeDaysAgo,
      currentBedId: '01' as any,
      acuityLevel: AcuityLevel.CRITICAL_STAT as any,
      patientStatus: 'ACTIVE_ICU',
      allergies: [],
      microbiologyHistory: [],
      pastVisits: [],
      attendingPhysician: {
        staffId: 'DOC-101',
        name: 'د. هشام طلعت (Dr. Hesham Talaat)',
        role: StaffRole.CONSULTANT as any,
      },
      primaryNurse: {
        staffId: 'RN-302',
        name: 'ممرض/ منى حسان (RN Mona Hassan)',
        role: StaffRole.BEDSIDE_RN as any,
      },
      isolationPrecautions: ['Airborne Precautions'],
      createdAt: threeDaysAgo,
      updatedAt: today,
    };

    const p2: PatientDossier = {
      id: 'pat-bed-02',
      mrn: 'MRN-209841',
      phoneNumber: '01123456789',
      nationalId: '27204150104821',
      fullNameEn: 'Fatima Al-Zahra Ali',
      fullNameAr: 'فاطمة الزهراء علي',
      age: 58,
      gender: Gender.FEMALE as any,
      weightKg: 68,
      heightCm: 160,
      idealBodyWeightKg: 52,
      codeStatus: CodeStatus.FULL_CODE as any,
      primaryDiagnosisEn: 'Acute Anterior STEMI with Cardiogenic Shock',
      primaryDiagnosisAr: 'احتشاء أمامي حاد بعضلة القلب مع صدمة قلبية',
      intakePathway: IntakePathway.STAT_CRITICAL as any,
      admissionDate: twoDaysAgo,
      currentBedId: '02' as any,
      acuityLevel: AcuityLevel.HIGH_VIGILANCE as any,
      patientStatus: 'ACTIVE_ICU',
      allergies: [],
      microbiologyHistory: [],
      pastVisits: [],
      attendingPhysician: {
        staffId: 'DOC-102',
        name: 'د. طارق منصور (Dr. Tarek Mansour)',
        role: StaffRole.SPECIALIST as any,
      },
      primaryNurse: {
        staffId: 'RN-304',
        name: 'ممرض/ أحمد خليل (RN Ahmed Khalil)',
        role: StaffRole.BEDSIDE_RN as any,
      },
      createdAt: twoDaysAgo,
      updatedAt: today,
    };

    await db.patients.bulkPut([p1, p2]);

    // Seed serial lab results for Bed 01 showing exact trend: HG 5 > 7 > 8.5 > 8
    const sampleLabs: LabResultItem[] = [
      {
        id: 'lab-hg-1',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'HG',
        category: 'CBC',
        value: '5',
        unit: 'g/dL',
        normalRange: '12.0 - 16.0',
        timestamp: threeDaysAgo,
        status: 'RESULTED',
        notes: 'قراءة أولية عند الدخول - نوبة نزف هضمي حاد',
        recordedByName: 'د. هشام طلعت (Dr. Hesham)',
      },
      {
        id: 'lab-hg-2',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'HG',
        category: 'CBC',
        value: '7',
        unit: 'g/dL',
        normalRange: '12.0 - 16.0',
        timestamp: twoDaysAgo,
        status: 'RESULTED',
        notes: 'بعد نقل وحدتين دم مكدس PRBCs',
        recordedByName: 'د. طارق منصور (Dr. Tarek)',
      },
      {
        id: 'lab-hg-3',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'HG',
        category: 'CBC',
        value: '8.5',
        unit: 'g/dL',
        normalRange: '12.0 - 16.0',
        timestamp: oneDayAgo,
        status: 'RESULTED',
        notes: 'استجابة جيدة لنقل الدم وتوقف النزف',
        recordedByName: 'ممرض/ منى حسان (RN Mona)',
      },
      {
        id: 'lab-hg-4',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'HG',
        category: 'CBC',
        value: '8',
        unit: 'g/dL',
        normalRange: '12.0 - 16.0',
        timestamp: today,
        status: 'RESULTED',
        notes: 'استقرار نسبي للهيموجلوبين',
        recordedByName: 'د. هشام طلعت (Dr. Hesham)',
      },
      // Creatinine declining (improvement)
      {
        id: 'lab-cr-1',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'Creatinine',
        category: 'Biochemistry',
        value: '3.2',
        unit: 'mg/dL',
        normalRange: '0.7 - 1.3',
        timestamp: threeDaysAgo,
        status: 'RESULTED',
        notes: 'قصور كلوي حاد AKI',
        recordedByName: 'د. هشام طلعت',
      },
      {
        id: 'lab-cr-2',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'Creatinine',
        category: 'Biochemistry',
        value: '2.4',
        unit: 'mg/dL',
        normalRange: '0.7 - 1.3',
        timestamp: twoDaysAgo,
        status: 'RESULTED',
        notes: 'تحسن مع السوائل',
        recordedByName: 'د. طارق منصور',
      },
      {
        id: 'lab-cr-3',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'Creatinine',
        category: 'Biochemistry',
        value: '1.8',
        unit: 'mg/dL',
        normalRange: '0.7 - 1.3',
        timestamp: today,
        status: 'RESULTED',
        notes: 'استمرار التحسن الكلوي',
        recordedByName: 'د. هشام طلعت',
      },
      // WBC
      {
        id: 'lab-wbc-1',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'WBC',
        category: 'CBC',
        value: '18.5',
        unit: 'x10^9/L',
        normalRange: '4.0 - 11.0',
        timestamp: threeDaysAgo,
        status: 'RESULTED',
        notes: 'Leukocytosis due to sepsis',
        recordedByName: 'د. هشام طلعت',
      },
      {
        id: 'lab-wbc-2',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'WBC',
        category: 'CBC',
        value: '14.2',
        unit: 'x10^9/L',
        normalRange: '4.0 - 11.0',
        timestamp: twoDaysAgo,
        status: 'RESULTED',
        notes: 'Declining with Meropenem',
        recordedByName: 'د. طارق منصور',
      },
      {
        id: 'lab-wbc-3',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        testName: 'WBC',
        category: 'CBC',
        value: '11.0',
        unit: 'x10^9/L',
        normalRange: '4.0 - 11.0',
        timestamp: today,
        status: 'RESULTED',
        notes: 'Normalized range',
        recordedByName: 'د. هشام طلعت',
      },
    ];

    await db.labResults.bulkPut(sampleLabs);

    // Seed investigations for Bed 01
    const sampleInv: InvestigationItem[] = [
      {
        id: 'inv-cxr-1',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        modality: 'Chest X-Ray',
        testName: 'Portable AP Chest Radiograph',
        timestamp: threeDaysAgo,
        status: 'REPORTED',
        resultReport: 'Bilateral diffuse fluffy alveolar infiltrates consistent with ARDS stage 2. Endotracheal tube tip positioned 4 cm above carina.',
        recordedByName: 'د. أشرف رضوان (استشاري الأشعة)',
      },
      {
        id: 'inv-echo-1',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        modality: 'Echo',
        testName: 'Bedside Transthoracic Echocardiogram (POCUS)',
        timestamp: twoDaysAgo,
        status: 'REPORTED',
        resultReport: 'LVEF estimated 55%, hyperdynamic LV with mild septal hypokinesia. Normal RV size and function, no pericardial effusion.',
        recordedByName: 'د. طارق منصور (Dr. Tarek)',
      },
      {
        id: 'inv-ecg-1',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        modality: 'ECG',
        testName: '12-Lead Standard Electrocardiogram',
        timestamp: today,
        status: 'REPORTED',
        resultReport: 'Sinus rhythm, HR 96 bpm, PR 160ms, QTc 430ms. No ischemic ST elevation or malignant arrhythmia.',
        recordedByName: 'د. هشام طلعت (Dr. Hesham)',
      },
    ];

    await db.investigations.bulkPut(sampleInv);

    // Seed initial active antibiotics for Bed 01 & Bed 02
    const sampleAntibiotics: PatientAntibiotic[] = [
      {
        id: 'abx-bed01-mero',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        drugNameEn: 'Meropenem',
        drugNameAr: 'ميروبينيم',
        dose: '1 g',
        route: 'IV',
        frequency: 'Q8H (Extended 3h Infusion)',
        indication: 'Severe Sepsis & Ventilator-Associated Pneumonia (VAP)',
        category: 'Beta-Lactam / Carbapenem',
        startDate: threeDaysAgo.slice(0, 10),
        plannedDurationDays: 7,
        status: 'ACTIVE',
        renalAdjustment: 'Normal renal dose (CrCl > 50 mL/min)',
        requiresTdm: false,
        prescribedByDoctorName: 'Dr. Tarek Mansour (Consultant)',
        administeredByRN: 'RN Sarah Jenkins',
        notes: 'Extended 3-hour infusion protocol for optimal MIC time-dependent killing.',
        createdAt: threeDaysAgo,
        updatedAt: today,
      },
      {
        id: 'abx-bed01-vanco',
        patientId: 'pat-bed-01',
        bedNumber: '01',
        drugNameEn: 'Vancomycin',
        drugNameAr: 'فانكومايسين',
        dose: '1 g',
        route: 'IV',
        frequency: 'Q12H (Slow 2h infusion)',
        indication: 'Empirical MRSA coverage & Catheter Sepsis',
        category: 'Glycopeptide / Lipopeptide',
        startDate: threeDaysAgo.slice(0, 10),
        plannedDurationDays: 7,
        status: 'ACTIVE',
        renalAdjustment: 'Dose adjusted based on trough monitoring',
        requiresTdm: true,
        tdmTarget: 'Trough Target: 15 - 20 mcg/mL',
        latestTdmLevel: '16.8 mcg/mL',
        latestTdmTimestamp: twoDaysAgo,
        prescribedByDoctorName: 'Dr. Hesham Talaat (ICU Specialist)',
        administeredByRN: 'RN Sarah Jenkins',
        notes: 'Trough level 16.8 mcg/mL within therapeutic target. Next trough due tomorrow morning.',
        createdAt: threeDaysAgo,
        updatedAt: today,
      },
      {
        id: 'abx-bed02-tazo',
        patientId: 'pat-bed-02',
        bedNumber: '02',
        drugNameEn: 'Piperacillin / Tazobactam (Tazocin)',
        drugNameAr: 'بيبراسيلين / تازوباكتام (تازوسين)',
        dose: '4.5 g',
        route: 'IV',
        frequency: 'Q6H',
        indication: 'Complicated Intra-Abdominal Sepsis Post-Op',
        category: 'Beta-Lactam / Carbapenem',
        startDate: twoDaysAgo.slice(0, 10),
        plannedDurationDays: 7,
        status: 'ACTIVE',
        renalAdjustment: 'CrCl > 50 mL/min standard dosing',
        requiresTdm: false,
        prescribedByDoctorName: 'Dr. Hesham Talaat',
        administeredByRN: 'RN Ahmed Khaled',
        notes: 'Post-exploratory laparotomy broad spectrum coverage.',
        createdAt: twoDaysAgo,
        updatedAt: today,
      }
    ];

    await db.patientAntibiotics.bulkPut(sampleAntibiotics);
  } else {
    // Check if antibiotics table needs initial seed if empty
    const abxCount = await db.patientAntibiotics.count();
    if (abxCount === 0) {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000).toISOString();
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
      const today = now.toISOString();

      await db.patientAntibiotics.bulkPut([
        {
          id: 'abx-bed01-mero',
          patientId: 'pat-bed-01',
          bedNumber: '01',
          drugNameEn: 'Meropenem',
          drugNameAr: 'ميروبينيم',
          dose: '1 g',
          route: 'IV',
          frequency: 'Q8H (Extended 3h Infusion)',
          indication: 'Severe Sepsis & Ventilator-Associated Pneumonia (VAP)',
          category: 'Beta-Lactam / Carbapenem',
          startDate: threeDaysAgo.slice(0, 10),
          plannedDurationDays: 7,
          status: 'ACTIVE',
          renalAdjustment: 'Normal renal dose (CrCl > 50 mL/min)',
          requiresTdm: false,
          prescribedByDoctorName: 'Dr. Tarek Mansour (Consultant)',
          administeredByRN: 'RN Sarah Jenkins',
          notes: 'Extended 3-hour infusion protocol for optimal MIC time-dependent killing.',
          createdAt: threeDaysAgo,
          updatedAt: today,
        },
        {
          id: 'abx-bed01-vanco',
          patientId: 'pat-bed-01',
          bedNumber: '01',
          drugNameEn: 'Vancomycin',
          drugNameAr: 'فانكومايسين',
          dose: '1 g',
          route: 'IV',
          frequency: 'Q12H (Slow 2h infusion)',
          indication: 'Empirical MRSA coverage & Catheter Sepsis',
          category: 'Glycopeptide / Lipopeptide',
          startDate: threeDaysAgo.slice(0, 10),
          plannedDurationDays: 7,
          status: 'ACTIVE',
          renalAdjustment: 'Dose adjusted based on trough monitoring',
          requiresTdm: true,
          tdmTarget: 'Trough Target: 15 - 20 mcg/mL',
          latestTdmLevel: '16.8 mcg/mL',
          latestTdmTimestamp: twoDaysAgo,
          prescribedByDoctorName: 'Dr. Hesham Talaat (ICU Specialist)',
          administeredByRN: 'RN Sarah Jenkins',
          notes: 'Trough level 16.8 mcg/mL within therapeutic target. Next trough due tomorrow morning.',
          createdAt: threeDaysAgo,
          updatedAt: today,
        },
        {
          id: 'abx-bed02-tazo',
          patientId: 'pat-bed-02',
          bedNumber: '02',
          drugNameEn: 'Piperacillin / Tazobactam (Tazocin)',
          drugNameAr: 'بيبراسيلين / تازوباكتام (تازوسين)',
          dose: '4.5 g',
          route: 'IV',
          frequency: 'Q6H',
          indication: 'Complicated Intra-Abdominal Sepsis Post-Op',
          category: 'Beta-Lactam / Carbapenem',
          startDate: twoDaysAgo.slice(0, 10),
          plannedDurationDays: 7,
          status: 'ACTIVE',
          renalAdjustment: 'CrCl > 50 mL/min standard dosing',
          requiresTdm: false,
          prescribedByDoctorName: 'Dr. Hesham Talaat',
          administeredByRN: 'RN Ahmed Khaled',
          notes: 'Post-exploratory laparotomy broad spectrum coverage.',
          createdAt: twoDaysAgo,
          updatedAt: today,
        }
      ]);
    }
  }

  // Seed default ventilators if empty
  const ventCount = await db.ventilators.count();
  if (ventCount === 0) {
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 3600000).toISOString();
    const threeHoursAgo = new Date(now.getTime() - 3 * 3600000).toISOString();
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString();
    const oneHourAgo = new Date(now.getTime() - 1 * 3600000).toISOString();

    await db.ventilators.put({
      id: 'vent_01_pat-bed-01',
      bedId: BedNumber.BED_01,
      patientId: 'pat-bed-01',
      timestamp: now.toISOString(),
      deviceModel: 'Dräger Evita V800',
      mode: VentilatorMode.PRVC,
      fio2Percent: 40,
      peepCmH2O: 8,
      tidalVolumeMl: 420,
      peakInspiratoryPressureCmH2O: 22,
      plateauPressureCmH2O: 18,
      drivingPressureCmH2O: 10,
      setRespiratoryRateCpm: 16,
      actualRespiratoryRateCpm: 18,
      ieRatio: '1:2',
      isWeaningTrialActive: false,
      circuitLeakPercent: 2,
      recordedByStaffName: 'د. طارق منصور (Dr. Tarek)',
      history: [
        {
          id: 'hist-vent-1',
          timestamp: fourHoursAgo,
          mode: VentilatorMode.SIMV_VC,
          fio2Percent: 60,
          peepCmH2O: 10,
          tidalVolumeMl: 450,
          recordedByStaffName: 'د. هشام طلعت (Dr. Hesham)',
          deviceModel: 'Dräger Evita V800',
        },
        {
          id: 'hist-vent-2',
          timestamp: threeHoursAgo,
          mode: VentilatorMode.SIMV_VC,
          fio2Percent: 50,
          peepCmH2O: 10,
          tidalVolumeMl: 450,
          recordedByStaffName: 'ممرض/ منى حسان (RN Mona)',
          deviceModel: 'Dräger Evita V800',
        },
        {
          id: 'hist-vent-3',
          timestamp: twoHoursAgo,
          mode: VentilatorMode.PRVC,
          fio2Percent: 45,
          peepCmH2O: 8,
          tidalVolumeMl: 420,
          recordedByStaffName: 'د. طارق منصور (Dr. Tarek)',
          deviceModel: 'Dräger Evita V800',
        },
        {
          id: 'hist-vent-4',
          timestamp: oneHourAgo,
          mode: VentilatorMode.PRVC,
          fio2Percent: 40,
          peepCmH2O: 8,
          tidalVolumeMl: 420,
          recordedByStaffName: 'د. طارق منصور (Dr. Tarek)',
          deviceModel: 'Dräger Evita V800',
        }
      ]
    });
  }

  // Reconcile and synchronize bed occupancy state with active patients in IndexedDB
  const currentBeds = await db.beds.toArray();
  const allPatients = await db.patients.toArray();
  const activePatients = allPatients.filter(p => p.patientStatus === 'ACTIVE_ICU');

  const assignedPatientIds = new Set<string>();

  for (const b of currentBeds) {
    let modified = false;

    // 1. Find active patient for this bed
    let targetPatient: PatientDossier | undefined;

    // Check if bed's currentPatientId matches an active unassigned patient
    if (b.currentPatientId && !assignedPatientIds.has(b.currentPatientId)) {
      const p = activePatients.find(pt => pt.id === b.currentPatientId);
      if (p) targetPatient = p;
    }

    // Secondary fallback: check patient by currentBedId if not yet claimed
    if (!targetPatient) {
      const p = activePatients.find(pt => pt.currentBedId === b.bedNumber && !assignedPatientIds.has(pt.id));
      if (p) targetPatient = p;
    }

    if (targetPatient) {
      assignedPatientIds.add(targetPatient.id);

      if (b.currentPatientId !== targetPatient.id) {
        b.currentPatientId = targetPatient.id;
        b.activePatientId = targetPatient.id;
        modified = true;
      }
      if (b.status !== BedStatus.OCCUPIED && b.status !== BedStatus.ISOLATION) {
        b.status = BedStatus.OCCUPIED;
        modified = true;
      }
      if (targetPatient.currentBedId !== b.bedNumber) {
        targetPatient.currentBedId = b.bedNumber as BedNumber;
        await db.patients.put(targetPatient);
      }
    } else {
      // Bed is vacant (or unavailable/isolation without patient)
      if (b.currentPatientId !== null) {
        b.currentPatientId = null;
        b.activePatientId = null;
        modified = true;
      }
      if (b.status === BedStatus.OCCUPIED) {
        b.status = BedStatus.VACANT;
        modified = true;
      }
    }

    if (modified) {
      await db.beds.put(b);
    }
  }
}

