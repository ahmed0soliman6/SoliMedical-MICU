import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Wind, 
  Droplet, 
  Activity, 
  FileText, 
  ShieldCheck, 
  ArrowLeft, 
  Plus, 
  Clock, 
  Lock, 
  CheckCircle2, 
  ExternalLink,
  Scale,
  Trash2,
  Edit3,
  Save,
  AlertCircle,
  Calendar,
  User,
  Check,
  ArrowRightLeft,
  ShieldAlert,
  FlaskConical,
  Microscope,
  Phone,
  Fingerprint,
  Layers,
  Sparkles,
  AlertTriangle,
  Camera,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  BedRecord, 
  PatientDossier, 
  TelemetryVitals, 
  VentilatorParameters, 
  InfusionPumpLine, 
  FluidBalance24H, 
  SbarHandoverReport, 
  ClinicalNote,
  CodeStatus,
  StaffRole,
  DispositionType,
  StatLabPanel,
  LabResultItem,
  InvestigationItem,
  BedStatus,
  AcuityLevel,
  BedNumber
} from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { dischargeOrTransferPatient, getPatientForBed } from '../services/dataModel.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { syncStatLabsToCloud, syncPatientToCloud } from '../services/firebase.ts';
import { LabFlowsheetSection } from './LabFlowsheetSection.tsx';
import { InvestigationsSection } from './InvestigationsSection.tsx';
import { PatientTransferModal } from './PatientTransferModal.tsx';
import { BedSwapModal } from './BedSwapModal.tsx';
import { BedIsolationModal } from './BedIsolationModal.tsx';
import { AiLabScannerModal } from './AiLabScannerModal.tsx';
import { VentilatorModal } from './VentilatorModal.tsx';
import { InfusionPumpModal } from './InfusionPumpModal.tsx';
import { FluidBalanceModal } from './FluidBalanceModal.tsx';
import { 
  BedsideCardsConfigModal, 
  BedsideCardsConfig, 
  DEFAULT_BEDSIDE_CARDS_CONFIG 
} from './BedsideCardsConfigModal.tsx';

interface BedsideFlowsheetProps {
  bed: BedRecord;
  patient: PatientDossier;
  allBeds?: BedRecord[];
  allPatients?: PatientDossier[];
  onSelectBed?: (bedNumber: BedNumber) => void;
  onBack: () => void;
  onOpenAddVitals: () => void;
  onOpenAddAddendum: (noteId: string, author: string) => void;
  onOpenSbarSign: () => void;
  onDataUpdated: () => void;
}

export const BedsideFlowsheet: React.FC<BedsideFlowsheetProps> = ({
  bed,
  patient,
  allBeds = [],
  allPatients = [],
  onSelectBed,
  onBack,
  onOpenAddVitals,
  onOpenAddAddendum,
  onOpenSbarSign,
  onDataUpdated,
}) => {
  const { settings } = useSystemSettings();
  const { t, lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'all' | 'paperFlowsheet' | 'labs' | 'investigations' | 'vitals' | 'vent' | 'pumps' | 'fluids' | 'sbar' | 'notes' | 'disposition'>('paperFlowsheet');
  const [isPatientCardCollapsed, setIsPatientCardCollapsed] = useState<boolean>(true);
  const [isDispositionCardCollapsed, setIsDispositionCardCollapsed] = useState<boolean>(true);
  const [isHistoryCardCollapsed, setIsHistoryCardCollapsed] = useState<boolean>(true);
  const [isDemographicsCardCollapsed, setIsDemographicsCardCollapsed] = useState<boolean>(true);
  const [isMicrobiologyCardCollapsed, setIsMicrobiologyCardCollapsed] = useState<boolean>(true);
  const [isPaperVitalsCardCollapsed, setIsPaperVitalsCardCollapsed] = useState<boolean>(true);
  const [isPaperVentCardCollapsed, setIsPaperVentCardCollapsed] = useState<boolean>(true);
  const [isPaperPumpsCardCollapsed, setIsPaperPumpsCardCollapsed] = useState<boolean>(true);
  const [isPaperFluidsCardCollapsed, setIsPaperFluidsCardCollapsed] = useState<boolean>(true);
  const [isPaperLabsCardCollapsed, setIsPaperLabsCardCollapsed] = useState<boolean>(true);
  const [isPaperInvestigationsCardCollapsed, setIsPaperInvestigationsCardCollapsed] = useState<boolean>(true);
  const [isPaperSbarCardCollapsed, setIsPaperSbarCardCollapsed] = useState<boolean>(true);
  const [isPaperNotesCardCollapsed, setIsPaperNotesCardCollapsed] = useState<boolean>(true);
  
  const [vitalsHistory, setVitalsHistory] = useState<TelemetryVitals[]>([]);
  const [ventilator, setVentilator] = useState<VentilatorParameters | null>(null);
  const [pumps, setPumps] = useState<InfusionPumpLine[]>([]);
  const [fluidBalance, setFluidBalance] = useState<FluidBalance24H | null>(null);
  const [sbarList, setSbarList] = useState<SbarHandoverReport[]>([]);
  const [notesList, setNotesList] = useState<ClinicalNote[]>([]);
  const [labsList, setLabsList] = useState<StatLabPanel[]>([]);
  const [labResults, setLabResults] = useState<LabResultItem[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationItem[]>([]);

  // Clinical equipment and card management modals
  const [isVentilatorModalOpen, setIsVentilatorModalOpen] = useState(false);
  const [isPumpModalOpen, setIsPumpModalOpen] = useState(false);
  const [selectedPumpForEdit, setSelectedPumpForEdit] = useState<InfusionPumpLine | null>(null);
  const [isFluidModalOpen, setIsFluidModalOpen] = useState(false);
  const [isCardsConfigModalOpen, setIsCardsConfigModalOpen] = useState(false);

  // Bedside cards configuration per bed
  const [cardsConfig, setCardsConfig] = useState<BedsideCardsConfig>(() => {
    try {
      const saved = localStorage.getItem(`icu_cards_config_${bed.bedNumber}`);
      return saved ? JSON.parse(saved) : DEFAULT_BEDSIDE_CARDS_CONFIG;
    } catch {
      return DEFAULT_BEDSIDE_CARDS_CONFIG;
    }
  });

  const handleSaveCardsConfig = (newConfig: BedsideCardsConfig) => {
    setCardsConfig(newConfig);
    try {
      localStorage.setItem(`icu_cards_config_${bed.bedNumber}`, JSON.stringify(newConfig));
    } catch (e) {
      console.error('Failed to persist cards config:', e);
    }
  };

  // Operation modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isIsolationModalOpen, setIsIsolationModalOpen] = useState(false);

  // History & Diagnosis edit states
  const [isHistoryEditing, setIsHistoryEditing] = useState(false);
  const [historyInput, setHistoryInput] = useState(patient.history || '');
  const [presentingComplaintInput, setPresentingComplaintInput] = useState(patient.presentingComplaint || '');
  const [chronicDiseasesInput, setChronicDiseasesInput] = useState(patient.chronicDiseases || '');
  const [primaryDiagnosisEnInput, setPrimaryDiagnosisEnInput] = useState(patient.primaryDiagnosisEn || '');
  const [primaryDiagnosisArInput, setPrimaryDiagnosisArInput] = useState(patient.primaryDiagnosisAr || '');

  // Lab modal and form states
  const [isAddLabModalOpen, setIsAddLabModalOpen] = useState(false);
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [isAiLabScannerOpen, setIsAiLabScannerOpen] = useState(false);
  const [aiScannerPreset, setAiScannerPreset] = useState<'ABG' | 'CBC' | 'ALL'>('ALL');
  const [labForm, setLabForm] = useState({
    timestamp: '',
    wbc: '', hb: '', hct: '', plt: '', diff: '', typeAnemia: '',
    inr: '', pt: '', ptt: '', fib: '',
    k: '', na: '', creat: '', bun: '', totalBili: '', alb: '', procalc: '', crp: '',
    ca: '', phos: '', mg: '', alt: '', ast: '', alp: '', ggt: '',
    amylase: '', lipase: '', troponin: '', ck: '', ckMb: '', esr: '',
    urea: '', uricAcid: '',
    ph: '', pco2: '', po2: '', hco3: '', be: '', lactate: '', pf: '',
  });

  // Disposition form state
  const [dispType, setDispType] = useState<DispositionType>(DispositionType.TRANSFER_GENERAL_WARD);
  const [dispSummary, setDispSummary] = useState<string>('Patient stabilized and transferred to High Dependency Unit (HDU).');
  const [physicianSign, setPhysicianSign] = useState<string>('Dr. Hesham Talaat');
  const [isDispPanelOpen, setIsDispPanelOpen] = useState<boolean>(false);

  useEffect(() => {
    loadBedsideData();
  }, [bed.bedNumber, patient.id]);

  useEffect(() => {
    // Reset edit states on patient change
    setHistoryInput(patient.history || '');
    setPresentingComplaintInput(patient.presentingComplaint || '');
    setChronicDiseasesInput(patient.chronicDiseases || '');
    setPrimaryDiagnosisEnInput(patient.primaryDiagnosisEn || '');
    setPrimaryDiagnosisArInput(patient.primaryDiagnosisAr || '');
    setIsHistoryEditing(false);
  }, [patient.id]);

  const loadBedsideData = async () => {
    const vitals = await db.vitals
      .where('patientId')
      .equals(patient.id)
      .reverse()
      .sortBy('timestamp');
    setVitalsHistory(vitals);

    const vent = await db.ventilators
      .where('bedId')
      .equals(bed.bedNumber)
      .first();
    setVentilator(vent || null);

    const pumpLines = await db.infusionPumps
      .where('patientId')
      .equals(patient.id)
      .toArray();
    setPumps(pumpLines);

    const fluids = await db.fluidBalances
      .where('patientId')
      .equals(patient.id)
      .first();
    setFluidBalance(fluids || null);

    const sbars = await db.sbarHandovers
      .where('patientId')
      .equals(patient.id)
      .reverse()
      .sortBy('shiftDate');
    setSbarList(sbars);

    const notes = await db.clinicalNotes
      .where('patientId')
      .equals(patient.id)
      .reverse()
      .sortBy('timestamp');
    setNotesList(notes);

    const labs = await db.statLabs
      .where('patientId')
      .equals(patient.id)
      .sortBy('timestamp');
    setLabsList(labs);

    // Load Daily Lab Flowsheet Items (Trend-enabled)
    let labItems = await db.labResults
      .where('patientId')
      .equals(patient.id)
      .sortBy('timestamp');

    if (labItems.length === 0) {
      const now = Date.now();
      const oneHour = 3600000;
      const oneDay = 86400000;
      const seedLabs: LabResultItem[] = [
        {
          id: `lab-${patient.id}-hb1`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'HG (Hemoglobin)',
          category: 'CBC',
          value: '5',
          unit: 'g/dL',
          normalRange: '12.0 - 16.0',
          timestamp: new Date(now - 3 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Hesham Talaat (Consultant)',
          notes: 'Severe acute blood loss on admission - 2 units PRBC ordered'
        },
        {
          id: `lab-${patient.id}-hb2`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'HG (Hemoglobin)',
          category: 'CBC',
          value: '7',
          unit: 'g/dL',
          normalRange: '12.0 - 16.0',
          timestamp: new Date(now - 2 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Sarah Al-Otaibi (Specialist)',
          notes: 'Post-transfusion 1st check, active stabilization'
        },
        {
          id: `lab-${patient.id}-hb3`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'HG (Hemoglobin)',
          category: 'CBC',
          value: '8.5',
          unit: 'g/dL',
          normalRange: '12.0 - 16.0',
          timestamp: new Date(now - 1 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Hesham Talaat (Consultant)',
          notes: 'Target reached > 8.0 g/dL, hemodynamic stability improved'
        },
        {
          id: `lab-${patient.id}-hb4`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'HG (Hemoglobin)',
          category: 'CBC',
          value: '8',
          unit: 'g/dL',
          normalRange: '12.0 - 16.0',
          timestamp: new Date(now - 4 * oneHour).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Ahmed Mansoor (Resident)',
          notes: 'Morning ICU rounds check - stable'
        },
        {
          id: `lab-${patient.id}-wbc1`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'WBC',
          category: 'CBC',
          value: '18.4',
          unit: 'x10³/µL',
          normalRange: '4.0 - 11.0',
          timestamp: new Date(now - 3 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Hesham Talaat',
          notes: 'Septic leukocytosis'
        },
        {
          id: `lab-${patient.id}-wbc2`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'WBC',
          category: 'CBC',
          value: '14.2',
          unit: 'x10³/µL',
          normalRange: '4.0 - 11.0',
          timestamp: new Date(now - 2 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Sarah Al-Otaibi',
          notes: 'Responding to broad-spectrum Meropenem'
        },
        {
          id: `lab-${patient.id}-wbc3`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'WBC',
          category: 'CBC',
          value: '11.5',
          unit: 'x10³/µL',
          normalRange: '4.0 - 11.0',
          timestamp: new Date(now - 1 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Ahmed Mansoor',
          notes: 'Resolving infection'
        },
        {
          id: `lab-${patient.id}-k1`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'K (Potassium)',
          category: 'Electrolytes',
          value: '5.6',
          unit: 'mmol/L',
          normalRange: '3.5 - 5.0',
          timestamp: new Date(now - 2 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Sarah Al-Otaibi',
          notes: 'Mild hyperkalemia managed with calcium gluconate'
        },
        {
          id: `lab-${patient.id}-k2`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'K (Potassium)',
          category: 'Electrolytes',
          value: '4.7',
          unit: 'mmol/L',
          normalRange: '3.5 - 5.0',
          timestamp: new Date(now - 1 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Hesham Talaat',
          notes: 'Electrolytes normalized'
        },
        {
          id: `lab-${patient.id}-k3`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'K (Potassium)',
          category: 'Electrolytes',
          value: '4.2',
          unit: 'mmol/L',
          normalRange: '3.5 - 5.0',
          timestamp: new Date(now - 3 * oneHour).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Ahmed Mansoor',
          notes: 'Optimal cardiac stability'
        },
        {
          id: `lab-${patient.id}-cr1`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'Creatinine',
          category: 'Renal',
          value: '2.8',
          unit: 'mg/dL',
          normalRange: '0.7 - 1.3',
          timestamp: new Date(now - 2 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Hesham Talaat',
          notes: 'Acute Kidney Injury (AKI Stage 2)'
        },
        {
          id: `lab-${patient.id}-cr2`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'Creatinine',
          category: 'Renal',
          value: '2.1',
          unit: 'mg/dL',
          normalRange: '0.7 - 1.3',
          timestamp: new Date(now - 1 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Sarah Al-Otaibi',
          notes: 'Improving with fluid resuscitation'
        },
        {
          id: `lab-${patient.id}-cr3`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'Creatinine',
          category: 'Renal',
          value: '1.4',
          unit: 'mg/dL',
          normalRange: '0.7 - 1.3',
          timestamp: new Date(now - 3 * oneHour).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Ahmed Mansoor',
          notes: 'Renal recovery ongoing'
        },
        {
          id: `lab-${patient.id}-lact1`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'Lactate',
          category: 'ABG',
          value: '4.5',
          unit: 'mmol/L',
          normalRange: '0.5 - 2.0',
          timestamp: new Date(now - 2 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Hesham Talaat',
          notes: 'Lactic acidosis on admission'
        },
        {
          id: `lab-${patient.id}-lact2`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'Lactate',
          category: 'ABG',
          value: '2.4',
          unit: 'mmol/L',
          normalRange: '0.5 - 2.0',
          timestamp: new Date(now - 1 * oneDay).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Sarah Al-Otaibi',
          notes: 'Clearing nicely'
        },
        {
          id: `lab-${patient.id}-lact3`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          testName: 'Lactate',
          category: 'ABG',
          value: '1.3',
          unit: 'mmol/L',
          normalRange: '0.5 - 2.0',
          timestamp: new Date(now - 3 * oneHour).toISOString(),
          status: 'RESULTED',
          recordedByName: 'Dr. Ahmed Mansoor',
          notes: 'Complete lactate clearance'
        }
      ];
      await db.labResults.bulkPut(seedLabs);
      labItems = seedLabs;
    }
    setLabResults(labItems);

    // Load Investigations & Imaging Items
    let invItems = await db.investigations
      .where('patientId')
      .equals(patient.id)
      .sortBy('timestamp');

    if (invItems.length === 0) {
      const now = Date.now();
      const seedInvs: InvestigationItem[] = [
        {
          id: `inv-${patient.id}-1`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          modality: 'Chest X-Ray',
          testName: 'Portable AP Chest Radiograph',
          timestamp: new Date(now - 18 * 3600000).toISOString(),
          status: 'REPORTED',
          resultReport: 'Endotracheal tube tip is 3.5 cm above the carina. Right internal jugular CVC tip at cavoatrial junction. Bilateral patchy bibasilar infiltrates consistent with ARDS / aspiration, slightly improved compared to admission film. No pneumothorax.',
          recordedByName: 'Dr. Khaled Radiologist',
          notes: 'Bedside portable study completed'
        },
        {
          id: `inv-${patient.id}-2`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          modality: 'Ultrasound',
          testName: 'Bedside POCUS - Focused Cardiac & Lung Ultrasound',
          timestamp: new Date(now - 6 * 3600000).toISOString(),
          status: 'REPORTED',
          resultReport: 'LV function hyperdynamic with EF ~55-60%. No pericardial effusion. IVC collapsible > 50% indicating fluid responsiveness. Lung ultrasound demonstrates bilateral B-lines in anterior and lateral zones.',
          recordedByName: 'Dr. Hesham Talaat (Consultant)',
          notes: 'Bedside echocardiogram and BLUE protocol'
        },
        {
          id: `inv-${patient.id}-3`,
          patientId: patient.id,
          bedNumber: bed.bedNumber,
          modality: 'ECG',
          testName: '12-Lead Electrocardiogram',
          timestamp: new Date(now - 2 * 3600000).toISOString(),
          status: 'REPORTED',
          resultReport: 'Sinus tachycardia at 104 bpm. Normal axis. QTc 432 ms. No ST elevation or depression. Non-specific T wave flattening in V4-V6.',
          recordedByName: 'Dr. Ahmed Mansoor (Resident)',
          notes: 'Routine morning monitoring'
        }
      ];
      await db.investigations.bulkPut(seedInvs);
      invItems = seedInvs;
    }
    setInvestigations(invItems);
  };

  const latestVitals = vitalsHistory[0] || null;

  // Ventilator Driving Pressure & PF Ratio Calculations
  const drivingPressure = (ventilator?.plateauPressureCmH2O && ventilator?.peepCmH2O)
    ? ventilator.plateauPressureCmH2O - ventilator.peepCmH2O
    : null;

  const handleSavePatientHistory = async () => {
    try {
      const updatedPatient = {
        ...patient,
        history: historyInput,
        presentingComplaint: presentingComplaintInput,
        chronicDiseases: chronicDiseasesInput,
        primaryDiagnosisEn: primaryDiagnosisEnInput,
        primaryDiagnosisAr: primaryDiagnosisArInput,
        updatedAt: new Date().toISOString()
      };
      await db.patients.put(updatedPatient);
      await syncPatientToCloud(updatedPatient);
      setIsHistoryEditing(false);
      onDataUpdated();
      alert(lang === 'ar' ? 'تم حفظ التاريخ المرضي والبيانات الطبية بنجاح!' : 'Medical history and clinical data saved successfully!');
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء حفظ التاريخ الطبي.' : 'Error saving patient details.');
    }
  };

  const handleOpenAddLabColumn = () => {
    setEditingLabId(null);
    setLabForm({
      timestamp: new Date().toISOString().slice(0, 16),
      wbc: '', hb: '', hct: '', plt: '', diff: '', typeAnemia: '',
      inr: '', pt: '', ptt: '', fib: '',
      k: '', na: '', creat: '', bun: '', totalBili: '', alb: '', procalc: '', crp: '',
      ca: '', phos: '', mg: '', alt: '', ast: '', alp: '', ggt: '',
      amylase: '', lipase: '', troponin: '', ck: '', ckMb: '', esr: '',
      urea: '', uricAcid: '',
      ph: '', pco2: '', po2: '', hco3: '', be: '', lactate: '', pf: '',
    });
    setIsAddLabModalOpen(true);
  };

  const handleApplyScannedToForm = (fields: Record<string, string>, timestamp?: string) => {
    setLabForm(prev => ({
      ...prev,
      ...fields,
      timestamp: timestamp || prev.timestamp || new Date().toISOString().slice(0, 16),
    }));
    setIsAddLabModalOpen(true);
  };

  const handleDirectSaveScannedLab = async (data: {
    fields: Record<string, string>;
    items: Array<{
      testName: string;
      category: string;
      value: string;
      unit: string;
      normalRange: string;
      flag?: string;
    }>;
    timestamp: string;
    summaryEn: string;
    summaryAr: string;
  }) => {
    const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Guest';
    const labId = `labs-${Date.now()}`;
    const f = data.fields;
    
    const labEntry: StatLabPanel = {
      id: labId,
      bedId: bed.bedNumber,
      patientId: patient.id,
      timestamp: new Date(data.timestamp || new Date()).toISOString(),
      abg: {
        ph: parseFloat(f.ph) || 0,
        pco2MmHg: parseFloat(f.pco2) || 0,
        po2MmHg: parseFloat(f.po2) || 0,
        hco3MmolPerL: parseFloat(f.hco3) || 0,
        baseExcessMmolPerL: parseFloat(f.be) || 0,
        lactateMmolPerL: parseFloat(f.lactate) || 0,
        pao2Fio2Ratio: parseFloat(f.pf) || 0,
      },
      cbc: {
        wbcCountKPerUl: parseFloat(f.wbc) || 0,
        hemoglobinGPerDl: parseFloat(f.hb) || 0,
        hematocritPercent: parseFloat(f.hct) || 0,
        plateletCountKPerUl: parseFloat(f.plt) || 0,
        differential: f.diff || '',
        typeAnemia: f.typeAnemia || '',
      },
      coagulation: {
        inr: parseFloat(f.inr) || 0,
        ptSeconds: parseFloat(f.pt) || 0,
        pttSeconds: parseFloat(f.ptt) || 0,
        fibrinogenMgPerDl: parseFloat(f.fib) || undefined,
      },
      biochemistry: {
        potassiumMeqPerL: parseFloat(f.k) || 0,
        sodiumMeqPerL: parseFloat(f.na) || 0,
        creatinineMgPerDl: parseFloat(f.creat) || 0,
        bunMgPerDl: parseFloat(f.bun) || undefined,
        totalBilirubinMgPerDl: parseFloat(f.totalBili) || 0,
        albuminGPerDl: parseFloat(f.alb) || 0,
        procalcitoninNgPerMl: parseFloat(f.procalc) || undefined,
        crpMgPerL: parseFloat(f.crp) || undefined,
        calciumMeqPerL: parseFloat(f.ca) || undefined,
        phosphorusMeqPerL: parseFloat(f.phos) || undefined,
        magnesiumMeqPerL: parseFloat(f.mg) || undefined,
        altUPerL: parseFloat(f.alt) || undefined,
        astUPerL: parseFloat(f.ast) || undefined,
        alpUPerL: parseFloat(f.alp) || undefined,
        ggtUPerL: parseFloat(f.ggt) || undefined,
        amylaseUPerL: parseFloat(f.amylase) || undefined,
        lipaseUPerL: parseFloat(f.lipase) || undefined,
        troponinNgPerMl: parseFloat(f.troponin) || undefined,
        ckUPerL: parseFloat(f.ck) || undefined,
        ckMbUPerL: parseFloat(f.ckMb) || undefined,
        esrMmHr: parseFloat(f.esr) || undefined,
        ureaMgPerDl: parseFloat(f.urea) || undefined,
        uricAcidMgPerDl: parseFloat(f.uricAcid) || undefined,
      },
      isCriticalAlert: (parseFloat(f.lactate) > 2.0 || (parseFloat(f.ph) > 0 && (parseFloat(f.ph) < 7.30 || parseFloat(f.ph) > 7.50))),
      reviewedByDoctorName: `${doctorName} (AI Verified)`,
    };

    await db.statLabs.put(labEntry);
    await syncStatLabsToCloud(labEntry);

    // Also add to individual lab results for cumulative trend visualization
    if (data.items && data.items.length > 0) {
      const newItems: LabResultItem[] = data.items.map((it, idx) => ({
        id: `labitem-${Date.now()}-${idx}`,
        patientId: patient.id,
        bedNumber: bed.bedNumber,
        testName: it.testName,
        category: it.category as any || 'Other',
        value: it.value,
        unit: it.unit || '',
        normalRange: it.normalRange || '',
        status: 'RESULTED',
        timestamp: new Date(data.timestamp || new Date()).toISOString(),
        notes: `AI OCR Extracted - ${data.summaryEn}`,
        recordedByName: doctorName,
        recordedByStaffId: currentUser?.id,
      }));
      await db.labResults.bulkPut(newItems);
    }

    await loadBedsideData();
    onDataUpdated();
  };

  const handleStartEditLabColumn = (lab: StatLabPanel) => {
    const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Guest';
    const author = lab.reviewedByDoctorName || 'Dr. Guest';
    const isAuthor = author === doctorName || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
    
    if (!isAuthor) {
      alert(lang === 'ar' 
        ? `⚠️ غير مصرح: تم تسجيل هذا العمود بواسطة [${author}]. لا يمكن التعديل عليه لضمان نزاهة السجلات السريرية.`
        : `⚠️ Unauthorized: This column was recorded by [${author}]. It cannot be edited to maintain clinical record integrity.`);
      return;
    }

    setEditingLabId(lab.id);
    setLabForm({
      timestamp: lab.timestamp.slice(0, 16),
      wbc: lab.cbc.wbcCountKPerUl?.toString() || '',
      hb: lab.cbc.hemoglobinGPerDl?.toString() || '',
      hct: lab.cbc.hematocritPercent?.toString() || '',
      plt: lab.cbc.plateletCountKPerUl?.toString() || '',
      diff: lab.cbc.differential || '',
      typeAnemia: lab.cbc.typeAnemia || '',
      inr: lab.coagulation.inr?.toString() || '',
      pt: lab.coagulation.ptSeconds?.toString() || '',
      ptt: lab.coagulation.pttSeconds?.toString() || '',
      fib: lab.coagulation.fibrinogenMgPerDl?.toString() || '',
      k: lab.biochemistry.potassiumMeqPerL?.toString() || '',
      na: lab.biochemistry.sodiumMeqPerL?.toString() || '',
      creat: lab.biochemistry.creatinineMgPerDl?.toString() || '',
      bun: lab.biochemistry.bunMgPerDl?.toString() || '',
      totalBili: lab.biochemistry.totalBilirubinMgPerDl?.toString() || '',
      alb: lab.biochemistry.albuminGPerDl?.toString() || '',
      procalc: lab.biochemistry.procalcitoninNgPerMl?.toString() || '',
      crp: lab.biochemistry.crpMgPerL?.toString() || '',
      ca: lab.biochemistry.calciumMeqPerL?.toString() || '',
      phos: lab.biochemistry.phosphorusMeqPerL?.toString() || '',
      mg: lab.biochemistry.magnesiumMeqPerL?.toString() || '',
      alt: lab.biochemistry.altUPerL?.toString() || '',
      ast: lab.biochemistry.astUPerL?.toString() || '',
      alp: lab.biochemistry.alpUPerL?.toString() || '',
      ggt: lab.biochemistry.ggtUPerL?.toString() || '',
      amylase: lab.biochemistry.amylaseUPerL?.toString() || '',
      lipase: lab.biochemistry.lipaseUPerL?.toString() || '',
      troponin: lab.biochemistry.troponinNgPerMl?.toString() || '',
      ck: lab.biochemistry.ckUPerL?.toString() || '',
      ckMb: lab.biochemistry.ckMbUPerL?.toString() || '',
      esr: lab.biochemistry.esrMmHr?.toString() || '',
      urea: lab.biochemistry.ureaMgPerDl?.toString() || '',
      uricAcid: lab.biochemistry.uricAcidMgPerDl?.toString() || '',
      ph: lab.abg.ph?.toString() || '',
      pco2: lab.abg.pco2MmHg?.toString() || '',
      po2: lab.abg.po2MmHg?.toString() || '',
      hco3: lab.abg.hco3MmolPerL?.toString() || '',
      be: lab.abg.baseExcessMmolPerL?.toString() || '',
      lactate: lab.abg.lactateMmolPerL?.toString() || '',
      pf: lab.abg.pao2Fio2Ratio?.toString() || '',
    });
    setIsAddLabModalOpen(true);
  };

  const handleDeleteLabColumn = async (id: string, author: string) => {
    const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Guest';
    const isAuthor = author === doctorName || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
    if (!isAuthor) {
      alert(lang === 'ar' 
        ? `⚠️ غير مصرح: تم تسجيل هذا العمود بواسطة [${author}]. ولا يمكن حذفه لضمان سلامة السجلات الطبية.`
        : `⚠️ Unauthorized: This column was recorded by [${author}]. It cannot be deleted to preserve medical records integrity.`);
      return;
    }

    const confirmPrompt = lang === 'ar'
      ? 'هل أنت متأكد من حذف هذا العمود بالكامل؟'
      : 'Are you sure you want to delete this lab column?';
    if (!confirm(confirmPrompt)) return;

    try {
      await db.statLabs.delete(id);
      const labs = await db.statLabs
        .where('patientId')
        .equals(patient.id)
        .sortBy('timestamp');
      setLabsList(labs);
      onDataUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLabColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const labId = editingLabId || `labs-${Date.now()}`;
      const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Guest';
      
      const labEntry: StatLabPanel = {
        id: labId,
        bedId: bed.bedNumber,
        patientId: patient.id,
        timestamp: new Date(labForm.timestamp).toISOString(),
        abg: {
          ph: parseFloat(labForm.ph) || 0,
          pco2MmHg: parseFloat(labForm.pco2) || 0,
          po2MmHg: parseFloat(labForm.po2) || 0,
          hco3MmolPerL: parseFloat(labForm.hco3) || 0,
          baseExcessMmolPerL: parseFloat(labForm.be) || 0,
          lactateMmolPerL: parseFloat(labForm.lactate) || 0,
          pao2Fio2Ratio: parseFloat(labForm.pf) || 0,
        },
        cbc: {
          wbcCountKPerUl: parseFloat(labForm.wbc) || 0,
          hemoglobinGPerDl: parseFloat(labForm.hb) || 0,
          hematocritPercent: parseFloat(labForm.hct) || 0,
          plateletCountKPerUl: parseFloat(labForm.plt) || 0,
          differential: labForm.diff || '',
          typeAnemia: labForm.typeAnemia || '',
        },
        coagulation: {
          inr: parseFloat(labForm.inr) || 0,
          ptSeconds: parseFloat(labForm.pt) || 0,
          pttSeconds: parseFloat(labForm.ptt) || 0,
          fibrinogenMgPerDl: parseFloat(labForm.fib) || undefined,
        },
        biochemistry: {
          potassiumMeqPerL: parseFloat(labForm.k) || 0,
          sodiumMeqPerL: parseFloat(labForm.na) || 0,
          creatinineMgPerDl: parseFloat(labForm.creat) || 0,
          bunMgPerDl: parseFloat(labForm.bun) || undefined,
          totalBilirubinMgPerDl: parseFloat(labForm.totalBili) || 0,
          albuminGPerDl: parseFloat(labForm.alb) || 0,
          procalcitoninNgPerMl: parseFloat(labForm.procalc) || undefined,
          crpMgPerL: parseFloat(labForm.crp) || undefined,
          calciumMeqPerL: parseFloat(labForm.ca) || undefined,
          phosphorusMeqPerL: parseFloat(labForm.phos) || undefined,
          magnesiumMeqPerL: parseFloat(labForm.mg) || undefined,
          altUPerL: parseFloat(labForm.alt) || undefined,
          astUPerL: parseFloat(labForm.ast) || undefined,
          alpUPerL: parseFloat(labForm.alp) || undefined,
          ggtUPerL: parseFloat(labForm.ggt) || undefined,
          amylaseUPerL: parseFloat(labForm.amylase) || undefined,
          lipaseUPerL: parseFloat(labForm.lipase) || undefined,
          troponinNgPerMl: parseFloat(labForm.troponin) || undefined,
          ckUPerL: parseFloat(labForm.ck) || undefined,
          ckMbUPerL: parseFloat(labForm.ckMb) || undefined,
          esrMmHr: parseFloat(labForm.esr) || undefined,
          ureaMgPerDl: parseFloat(labForm.urea) || undefined,
          uricAcidMgPerDl: parseFloat(labForm.uricAcid) || undefined,
        },
        isCriticalAlert: false,
        reviewedByDoctorName: editingLabId 
          ? (labsList.find(l => l.id === editingLabId)?.reviewedByDoctorName || doctorName)
          : doctorName,
      };

      await db.statLabs.put(labEntry);
      await syncStatLabsToCloud(labEntry);
      
      setIsAddLabModalOpen(false);
      setEditingLabId(null);
      
      const labs = await db.statLabs
        .where('patientId')
        .equals(patient.id)
        .sortBy('timestamp');
      setLabsList(labs);
      onDataUpdated();
      
      alert(lang === 'ar' ? 'تم تسجيل قراءة التحاليل بنجاح!' : 'Lab column recorded successfully!');
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء الحفظ.' : 'Error saving lab values.');
    }
  };

  const handleExecuteDisposition = async () => {
    const confirmPrompt = lang === 'ar'
      ? `هل أنت متأكد من تسجيل خروج / نقل مريض السرير ${bed.bedNumber}؟`
      : `Confirm discharge/transfer for Bed ${bed.bedNumber}?`;
    if (!confirm(confirmPrompt)) return;
    try {
      await dischargeOrTransferPatient({
        bedNumber: bed.bedNumber,
        patientId: patient.id,
        dispositionType: dispType,
        summaryText: dispSummary,
        authorStaff: {
          staffId: 'DOC-8811',
          name: physicianSign,
          role: StaffRole.CONSULTANT,
        },
      });
      onDataUpdated();
      onBack();
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء تنفيذ إجراء الخروج.' : 'An error occurred during disposition.');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Quick Bed Switcher Bar (Direct Single-Click Page Navigation) */}
      {allBeds.length > 0 && onSelectBed && (
        <div className="bg-[#0a1224] border border-slate-800/80 rounded-xl px-3 py-2 flex items-center gap-1.5 overflow-x-auto shadow-sm">
          <button
            onClick={onBack}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
            title={lang === 'ar' ? 'العودة لشبكة الأسِرّة الستة' : 'Back to Bed Console'}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'شبكة الأسِرّة' : 'Console'}</span>
          </button>

          <span className="text-slate-700 mx-1">|</span>

          {allBeds.map((b) => {
            const isCurrent = b.bedNumber === bed.bedNumber;
            const bPatient = getPatientForBed(b, allPatients);
            const isOccupied = b.status === 'OCCUPIED' || (b.status === 'ISOLATION' && !!bPatient) || !!bPatient;

            return (
              <button
                key={b.bedNumber}
                onClick={() => onSelectBed(b.bedNumber as BedNumber)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-teal-500/25 text-teal-200 border border-teal-500/60 font-black shadow-md'
                    : 'bg-[#0e172a] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span className="font-mono font-bold text-teal-400">{b.bedNumber}</span>
                <span className="truncate max-w-[90px] text-[11px]">
                  {isOccupied 
                    ? (bPatient?.fullNameAr?.split(' ')[0] || bPatient?.fullNameEn?.split(' ')[0] || (lang === 'ar' ? 'مشغول' : 'Occupied'))
                    : (lang === 'ar' ? 'شاغر' : 'Vacant')}
                </span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${isOccupied ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </button>
            );
          })}
        </div>
      )}

      {/* Top Dossier Header Card (Collapsible) */}
      <div 
        onClick={() => setIsPatientCardCollapsed(!isPatientCardCollapsed)}
        className="bg-[#0b1224] border border-slate-700/80 hover:border-teal-500/40 rounded-2xl p-3.5 sm:p-4 shadow-xl transition-all cursor-pointer select-none"
      >
        {isPatientCardCollapsed ? (
          /* Collapsed View: ONLY Bed Number, Patient Name, Diagnosis Subtitle, and Chevron indicator */
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBack();
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex-shrink-0"
                title={lang === 'ar' ? 'العودة لشبكة الأسِرّة' : 'Back to Bed Matrix'}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <span className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono font-black text-sm flex items-center justify-center shadow-md flex-shrink-0">
                {bed.bedNumber}
              </span>

              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg font-bold text-white truncate">
                  {patient.fullNameAr || patient.fullNameEn}
                </h1>

                {(patient.primaryDiagnosisAr || patient.primaryDiagnosisEn) && (
                  <p className="text-xs text-teal-300/80 font-mono truncate mt-0.5">
                    <span className="text-slate-400 font-sans">{lang === 'ar' ? 'التشخيص:' : 'Dx:'}</span>{' '}
                    {lang === 'ar' 
                      ? (patient.primaryDiagnosisAr || patient.primaryDiagnosisEn) 
                      : (patient.primaryDiagnosisEn || patient.primaryDiagnosisAr)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCardsConfigModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                title={lang === 'ar' ? 'تخصيص الخواص والبطاقات' : 'Customize Properties'}
              >
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'تخصيص الخواص' : 'Properties'}</span>
              </button>

              <div className="p-1.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                <ChevronDown className="w-5 h-5 text-teal-400" />
              </div>
            </div>
          </div>
        ) : (
          /* Expanded View: Complete Dossier Details & CTAs */
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Back Button & Patient Summary */}
              <div className="flex items-start gap-3">
                <button
                  onClick={onBack}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex-shrink-0 mt-0.5"
                  title={lang === 'ar' ? 'العودة لشبكة الأسِرّة' : 'Back to Bed Matrix'}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono font-black text-sm flex items-center justify-center shadow-md">
                      {bed.bedNumber}
                    </span>
                    <h1 className="text-lg sm:text-xl font-bold text-white">
                      {patient.fullNameAr || patient.fullNameEn}
                    </h1>
                    
                    {/* Fixed Patient ID */}
                    <div className="flex items-center gap-1 font-mono text-xs text-teal-300 font-semibold px-2.5 py-0.5 rounded bg-teal-950/80 border border-teal-800/80 shadow-sm">
                      <Fingerprint className="w-3.5 h-3.5 text-teal-400" />
                      <span>ID: {patient.id}</span>
                    </div>

                    <span className="font-mono text-xs text-slate-300 font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                      MRN #{patient.mrn}
                    </span>

                    {/* Bed Status Badge */}
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
                      bed.status === BedStatus.ISOLATION || (bed.isolation?.isIsolated ?? false)
                        ? 'bg-amber-950 text-amber-300 border border-amber-600'
                        : bed.status === BedStatus.UNAVAILABLE
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : bed.status === BedStatus.OCCUPIED
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {bed.status === BedStatus.ISOLATION || (bed.isolation?.isIsolated ?? false)
                        ? (lang === 'ar' ? '⚠️ سرير عزل طبي' : '⚠️ ISOLATION BED')
                        : bed.status === BedStatus.UNAVAILABLE
                        ? (lang === 'ar' ? '🔒 سرير غير متاح' : '🔒 UNAVAILABLE')
                        : bed.status === BedStatus.OCCUPIED
                        ? (lang === 'ar' ? '● سرير مشغول' : '● OCCUPIED')
                        : (lang === 'ar' ? '○ سرير شاغر' : '○ VACANT')}
                    </span>

                    {settings.features.enableCodeStatus && (
                      <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
                        patient.codeStatus === CodeStatus.DNR 
                          ? 'bg-purple-950 text-purple-300 border border-purple-700' 
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      }`}>
                        {patient.codeStatus}
                      </span>
                    )}
                    {settings.features.enableAcuityLevels && (
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md ${
                        patient.acuityLevel === 'CRITICAL_STAT'
                          ? 'bg-red-950 text-red-400 border border-red-700 animate-pulse'
                          : 'bg-teal-950 text-teal-300 border border-teal-800'
                      }`}>
                        {patient.acuityLevel}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                    <span className="font-semibold text-slate-200">{lang === 'ar' ? 'التشخيص الأساسي:' : 'Primary Diagnosis:'}</span>{' '}
                    {lang === 'ar' 
                      ? `${patient.primaryDiagnosisAr} — ${patient.primaryDiagnosisEn}` 
                      : `${patient.primaryDiagnosisEn} — ${patient.primaryDiagnosisAr}`}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-300 mt-1.5 flex-wrap font-mono">
                    <span>{lang === 'ar' ? 'العمر والنوع:' : 'Age/Gender:'} <strong className="text-white">{patient.age} {lang === 'ar' ? 'سنة' : 'yo'} ({patient.gender === 'MALE' ? (lang === 'ar' ? 'ذكر' : 'Male') : (lang === 'ar' ? 'أنثى' : 'Female')})</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-teal-400" />
                      <span>{lang === 'ar' ? 'الهاتف:' : 'Phone:'} <strong className="text-white">{patient.phoneNumber || '—'}</strong></span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{lang === 'ar' ? 'تاريخ الدخول:' : 'Admitted:'} <strong className="text-white">{new Date(patient.admissionDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</strong></span>
                    </span>
                    <span>•</span>
                    <span>{lang === 'ar' ? 'الوزن:' : 'Weight:'} <strong className="text-white">{patient.weightKg}</strong> {lang === 'ar' ? 'كجم' : 'kg'} (IBW: <strong className="text-teal-400">{patient.idealBodyWeightKg}</strong> {lang === 'ar' ? 'كجم' : 'kg'})</span>
                    <span>•</span>
                    <span>{lang === 'ar' ? 'الاستشاري:' : 'Attending:'} <strong className="text-slate-200">{patient.attendingPhysician.name}</strong></span>
                    <span>•</span>
                    <span>{lang === 'ar' ? 'التمريض:' : 'Primary RN:'} <strong className="text-slate-200">{patient.primaryNurse.name}</strong></span>
                  </div>
                </div>
              </div>

              {/* Bed Operational Controls & Collapse Button */}
              <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center flex-wrap justify-end">
                <button
                  onClick={() => setIsCardsConfigModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title={lang === 'ar' ? 'تخصيص وإدارة بطاقات السرير (إظهار/إخفاء/تعديل)' : 'Manage & Customize Bedside Cards'}
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{lang === 'ar' ? 'تخصيص البطاقات' : 'Cards Layout'}</span>
                </button>

                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title={lang === 'ar' ? 'نقل المريض لسرير شاغر مع الاحتفاظ بكافة بياناته وسجلاته' : 'Transfer patient to vacant bed'}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                  <span>{lang === 'ar' ? 'نقل المريض' : 'Transfer Bed'}</span>
                </button>

                <button
                  onClick={() => setIsSwapModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title={lang === 'ar' ? 'تبديل سريرين ومشغولين في عملية موحدة واحدة آمنة' : 'Atomic bed swap between two patients'}
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>{lang === 'ar' ? 'تبديل سريرين' : 'Swap Beds'}</span>
                </button>

                <button
                  onClick={() => setIsIsolationModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  title={lang === 'ar' ? 'تعديل حالة السرير وتدابير العزل الطبي' : 'Manage bed status & isolation precautions'}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === 'ar' ? 'العزل والحالة' : 'Bed Status'}</span>
                </button>

                {settings.features.enableTelemetryVitals && (
                  <button
                    onClick={onOpenAddVitals}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Activity className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تسجيل علامات' : 'Record Vitals'}</span>
                  </button>
                )}

                {settings.features.enableSbarHandover && (
                  <button
                    onClick={onOpenSbarSign}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-teal-500/20 active:scale-95 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تسليم SBAR' : 'SBAR Sign'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsPatientCardCollapsed(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                  <span>{lang === 'ar' ? 'طي بطاقة البيانات' : 'Collapse Details'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick ICU Disposition Panel (لوحة إجراءات إنهاء الإقامة والتحويل المباشر) */}
      <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              {lang === 'ar' ? 'إجراءات ترحيل المريض وتفريغ السرير المباشر' : 'Immediate Patient Disposition & Bed Vacating Controls'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {lang === 'ar' 
                ? 'خيارات سريرية فورية لتسجيل الخروج وتحويل المريض أو إقرار الوفاة، وتفريغ السرير لاستقبال حالة أخرى.' 
                : 'Instantly record clinical ward transfer, discharge home, or clinical mortality to vacate this bed.'}
            </p>
          </div>

          {/* Direct Disposition Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Transfer to Ward */}
            <button
              onClick={() => {
                setDispType(DispositionType.TRANSFER_GENERAL_WARD);
                setDispSummary(lang === 'ar' ? 'نقل المريض لقسم الباطنة العامة بعد استقرار الحالة التنفسية والقلبية تماماً واستقرار كافة العلامات الحيوية.' : 'Hemodynamically stable with adequate respiratory efforts. Transferred to inpatient general ward under medicine team.');
                setIsDispPanelOpen(true);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isDispPanelOpen && dispType === DispositionType.TRANSFER_GENERAL_WARD
                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/10'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>{lang === 'ar' ? 'تحويل لقسم / جناح' : 'Transfer to Ward'}</span>
            </button>

            {/* 2. Discharge Home (Improved) */}
            <button
              onClick={() => {
                setDispType(DispositionType.DISCHARGE_HOME);
                setDispSummary(lang === 'ar' ? 'خروج المريض للمنزل لتحسن حالته السريرية واستقرار وظائف الأعضاء، مع إرشادات المتابعة الطبية.' : 'Patient fully recovered, all clinical markers within acceptable baseline. Discharged home with follow-up protocols.');
                setIsDispPanelOpen(true);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isDispPanelOpen && dispType === DispositionType.DISCHARGE_HOME
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'ar' ? 'خروج تحسن للمنزل' : 'Discharge Improved'}</span>
            </button>

            {/* 3. Clinical Mortality */}
            <button
              onClick={() => {
                setDispType(DispositionType.CLINICAL_MORTALITY);
                setDispSummary(lang === 'ar' ? 'تسجيل حالة وفاة المريض وتوقف عضلة القلب ومظاهر التنفس تماماً بعد فشل محاولات الإنعاش الرئوي.' : 'Patient expired due to progressive cardiorespiratory failure. Standard resuscitation protocol completed and death declared.');
                setIsDispPanelOpen(true);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isDispPanelOpen && dispType === DispositionType.CLINICAL_MORTALITY
                  ? 'bg-red-500/20 border-red-500 text-red-300 shadow-md shadow-red-500/10'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span>{lang === 'ar' ? 'تسجيل حالة وفاة' : 'Clinical Mortality'}</span>
            </button>
          </div>
        </div>

        {/* Embedded Confirmation & Documentation Form */}
        {isDispPanelOpen && (
          <div className="bg-[#070c18] border border-slate-800 p-4 rounded-xl space-y-4 animate-in slide-in-from-top-3 duration-200 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <span className={`w-2 h-2 rounded-full ${
                dispType === DispositionType.CLINICAL_MORTALITY ? 'bg-red-500' :
                dispType === DispositionType.DISCHARGE_HOME ? 'bg-emerald-500' : 'bg-blue-500'
              }`} />
              <strong className="text-white">
                {dispType === DispositionType.CLINICAL_MORTALITY ? (lang === 'ar' ? 'توثيق حالة الوفاة والسبب السريري للوفاة' : 'Documentation of Clinical Mortality') :
                 dispType === DispositionType.DISCHARGE_HOME ? (lang === 'ar' ? 'توثيق خروج تحسن للمنزل' : 'Documentation of Discharge Home') :
                 (lang === 'ar' ? 'توثيق قرار نقل المريض إلى الجناح الداخلي' : 'Documentation of Ward Transfer')}
              </strong>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">
                  {lang === 'ar' ? 'التقرير الطبي / التقرير النهائي للوفاة أو الخروج' : 'Clinical Summary / Final Diagnosis & Remarks'}
                </label>
                <textarea
                  rows={3}
                  value={dispSummary}
                  onChange={(e) => setDispSummary(e.target.value)}
                  className="w-full bg-[#0a1224] border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 font-semibold block mb-1 font-mono">
                    {lang === 'ar' ? 'توقيع الطبيب المعتمد ورقم الاعتماد' : 'Authorizing Physician Signature / License ID'}
                  </label>
                  <input
                    type="text"
                    value={physicianSign}
                    onChange={(e) => setPhysicianSign(e.target.value)}
                    className="w-full bg-[#0a1224] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none font-bold"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsDispPanelOpen(false)}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 font-semibold transition-all border border-slate-800"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteDisposition}
                    className={`px-5 py-2 rounded-xl font-bold transition-all shadow-lg active:scale-95 ${
                      dispType === DispositionType.CLINICAL_MORTALITY
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30'
                        : dispType === DispositionType.DISCHARGE_HOME
                        ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/20'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
                    }`}
                  >
                    {lang === 'ar' ? 'تأكيد الإجراء وتفريغ السرير فوراً' : 'Confirm & Discharge Patient'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl">
        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
          {[
            { 
              id: 'all', 
              label: lang === 'ar' ? 'الكل (جميع البطاقات)' : 'ALL (Combined Flowsheets)', 
              icon: Layers, 
              enabled: true 
            },
            { 
              id: 'paperFlowsheet', 
              label: lang === 'ar' ? 'الورقة الطبية الموحدة (Paper Chart)' : 'Paper Flowsheet', 
              icon: FileText, 
              enabled: true 
            },
            { 
              id: 'labs', 
              label: lang === 'ar' ? `التحاليل والجدول اليومي (${labResults.length})` : `Daily Lab Flowsheet (${labResults.length})`, 
              icon: FlaskConical, 
              enabled: true 
            },
            { 
              id: 'investigations', 
              label: lang === 'ar' ? `الفحوصات والأشعات (${investigations.length})` : `Radiology & Investigations (${investigations.length})`, 
              icon: Microscope, 
              enabled: true 
            },
            { 
              id: 'vitals', 
              label: lang === 'ar' ? 'العلامات الحيوية (Vitals)' : 'Vitals & Telemetry', 
              icon: Activity, 
              enabled: settings.features.enableTelemetryVitals 
            },
            { 
              id: 'vent', 
              label: lang === 'ar' ? 'التنفس الصناعي (Vent & ABG)' : 'Ventilator & ABG', 
              icon: Wind, 
              enabled: settings.features.enableVentilatorParameters 
            },
            { 
              id: 'pumps', 
              label: lang === 'ar' ? 'مضخات المحاليل (Infusion Pumps)' : 'Infusion Pumps', 
              icon: Droplet, 
              enabled: settings.features.enableInfusionPumps 
            },
            { 
              id: 'fluids', 
              label: lang === 'ar' ? 'ميزان السوائل ونقل الدم (Fluids & MTP)' : '24h Fluid Balance & MTP', 
              icon: Scale, 
              enabled: settings.features.enableFluidBalance 
            },
            { 
              id: 'sbar', 
              label: lang === 'ar' ? `تسليم المناوبة SBAR (${sbarList.length})` : `SBAR Handovers (${sbarList.length})`, 
              icon: ShieldCheck, 
              enabled: settings.features.enableSbarHandover 
            },
            { 
              id: 'notes', 
              label: lang === 'ar' ? `الملاحظات المشفرة (${notesList.length})` : `Clinical Notes (${notesList.length})`, 
              icon: FileText, 
              enabled: settings.features.enableClinicalNotes 
            },
            { 
              id: 'disposition', 
              label: lang === 'ar' ? 'إنهاء الإقامة / النقل (Disposition)' : 'ICU Disposition & Discharge', 
              icon: ExternalLink, 
              enabled: true 
            },
          ].filter(t => t.enabled).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 0: Paper Flowsheet Chart (الورقة الطبية الإلكترونية) */}
      {(activeTab === 'paperFlowsheet' || activeTab === 'all') && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Top Row: History & Patient Data Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* History & Presenting Complaints Box */}
            <div className="lg:col-span-2 bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3">
              <div 
                onClick={() => setIsHistoryCardCollapsed(!isHistoryCardCollapsed)}
                className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-400" />
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'التاريخ الطبي والشكوى الحالية' : 'Clinical History & Complaints'}
                  </h3>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCardsConfigModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                    title={lang === 'ar' ? 'تخصيص الخواص' : 'Customize Properties'}
                  >
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">{lang === 'ar' ? 'تخصيص الخواص' : 'Properties'}</span>
                  </button>

                  {!isHistoryEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsHistoryEditing(true);
                        setIsHistoryCardCollapsed(false);
                      }}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      {lang === 'ar' ? 'تعديل البيانات' : 'Edit Info'}
                    </button>
                  )}

                  <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                    {isHistoryCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {!isHistoryCardCollapsed && (
                <>
                  {isHistoryEditing ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        {lang === 'ar' ? 'الشكوى الحالية والأعراض (C/O)' : 'Presenting Complaints (C/O)'}
                      </label>
                      <textarea
                        rows={3}
                        value={presentingComplaintInput}
                        onChange={(e) => setPresentingComplaintInput(e.target.value)}
                        placeholder="e.g. c/o acute hepatitis, RUQ pain, jaundice..."
                        className="w-full bg-[#070c18] border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        {lang === 'ar' ? 'التاريخ المرضي السابق (Past Hx)' : 'Past Medical History (Past Hx)'}
                      </label>
                      <textarea
                        rows={3}
                        value={historyInput}
                        onChange={(e) => setHistoryInput(e.target.value)}
                        placeholder="e.g. Past Hx: IDA, Menses 2 months ago..."
                        className="w-full bg-[#070c18] border border-slate-800 rounded-xl p-3 text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      {lang === 'ar' ? 'الأمراض المزمنة والمصاحبة' : 'Chronic Illnesses & Comorbidities'}
                    </label>
                    <input
                      type="text"
                      value={chronicDiseasesInput}
                      onChange={(e) => setChronicDiseasesInput(e.target.value)}
                      placeholder="e.g. Diabetes, Hypertension, CAD..."
                      className="w-full bg-[#070c18] border border-slate-800 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        {lang === 'ar' ? 'التشخيص الأساسي (EN)' : 'Primary Diagnosis (EN)'}
                      </label>
                      <input
                        type="text"
                        value={primaryDiagnosisEnInput}
                        onChange={(e) => setPrimaryDiagnosisEnInput(e.target.value)}
                        className="w-full bg-[#070c18] border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        {lang === 'ar' ? 'التشخيص الأساسي (AR)' : 'Primary Diagnosis (AR)'}
                      </label>
                      <input
                        type="text"
                        value={primaryDiagnosisArInput}
                        onChange={(e) => setPrimaryDiagnosisArInput(e.target.value)}
                        className="w-full bg-[#070c18] border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsHistoryEditing(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePatientHistory}
                      className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-md shadow-teal-500/15"
                    >
                      <Save className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'حفظ ومزامنة' : 'Save & Sync'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                  {/* Complaints Column */}
                  <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-teal-400 font-mono block">
                      {lang === 'ar' ? 'الشكوى الحالية والتحليل الأعراضي (C/O)' : 'Presenting Complaint (C/O)'}
                    </span>
                    <p className="text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                      {patient.presentingComplaint || (lang === 'ar' ? 'لم تسجل شكوى حالية بعد.' : 'No presenting complaints registered.')}
                    </p>
                  </div>

                  {/* Past Hx & Chronic diseases */}
                  <div className="space-y-3">
                    <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-400 font-mono block">
                        {lang === 'ar' ? 'التاريخ الطبي السابق (Past Hx)' : 'Past Medical History (Past Hx)'}
                      </span>
                      <p className="text-slate-200 font-mono whitespace-pre-wrap">
                        {patient.history || (lang === 'ar' ? 'لا يوجد تاريخ مرضي مسجل.' : 'No past history recorded.')}
                      </p>
                    </div>

                    <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 block font-mono">
                        {lang === 'ar' ? 'الأمراض المزمنة (Chronic Diseases)' : 'Chronic Diseases & Comorbidities'}
                      </span>
                      <p className="text-slate-200 font-mono font-bold">
                        {patient.chronicDiseases || (lang === 'ar' ? 'لا توجد أمراض مزمنة مصاحبة.' : 'None reported.')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            {/* Demographics / Pt Data Box */}
            <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
              <div 
                onClick={() => setIsDemographicsCardCollapsed(!isDemographicsCardCollapsed)}
                className="border-b border-slate-800 pb-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
              >
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'بيانات المريض الأساسية' : 'Patient Demographics'}
                  </h3>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCardsConfigModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                    title={lang === 'ar' ? 'تخصيص الخواص' : 'Customize Properties'}
                  >
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">{lang === 'ar' ? 'تخصيص الخواص' : 'Properties'}</span>
                  </button>

                  <span className="font-mono text-[11px] text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800 font-bold">
                    {bed.bedNumber}
                  </span>

                  <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                    {isDemographicsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {!isDemographicsCardCollapsed && (
                <>
                  <div className="grid grid-cols-2 gap-3.5 my-4 text-xs font-mono">
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'الاسم كاملاً' : 'Full Name'}</div>
                      <div className="text-white font-bold mt-0.5 text-xs truncate">
                        {patient.fullNameAr || patient.fullNameEn}
                      </div>
                    </div>

                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'رقم السجل المدني / الهوية' : 'National ID'}</div>
                      <div className="text-slate-300 font-bold mt-0.5">{patient.nationalId || '—'}</div>
                    </div>

                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'السن والجنس' : 'Age & Gender'}</div>
                      <div className="text-white font-bold mt-0.5">
                        {patient.age} {lang === 'ar' ? 'سنة' : 'yo'} / {patient.gender}
                      </div>
                    </div>

                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'تاريخ دخول العناية' : 'ICU Admission Date'}</div>
                      <div className="text-teal-400 font-bold mt-0.5">
                        {new Date(patient.admissionDate).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>

                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'الوزن والوزن المثالي' : 'Weight / IBW'}</div>
                      <div className="text-white font-bold mt-0.5">
                        {patient.weightKg}kg (IBW: <span className="text-teal-400">{patient.idealBodyWeightKg}</span>kg)
                      </div>
                    </div>

                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'الطبيب والممرض المسؤول' : 'Team RN / MD'}</div>
                      <div className="text-slate-300 mt-0.5 text-[10px] truncate">
                        MD: {patient.attendingPhysician.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex items-center gap-1.5 leading-snug">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>
                      {lang === 'ar'
                        ? 'البيانات الطبية والتاريخ المرضي يتزامن فوريّاً مع شاشات المراقبة السريرية والأجهزة اللوحية.'
                        : 'Clinical history updates synchronize instantly with core monitors and staff bedside tablets.'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactive Labs Grid Table (التحاليل الطبية المتسلسلة التراكمية) */}
          <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3">
            <div 
              onClick={() => setIsPaperLabsCardCollapsed(!isPaperLabsCardCollapsed)}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
            >
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'جدول التحاليل المتسلسلة التراكمية' : 'Sequential Laboratories Grid'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {lang === 'ar'
                      ? 'عرض التحاليل متسلسلة زمنياً مع حظر التعديل التبادلي وحماية المصداقية.'
                      : 'Labs ordered chronologically with doctor-lock protection.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCardsConfigModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                  title={lang === 'ar' ? 'تخصيص الخواص' : 'Customize Properties'}
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'تخصيص الخواص' : 'Properties'}</span>
                </button>

                {settings.enableAiLabScanner && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAiScannerPreset('ALL');
                      setIsAiLabScannerOpen(true);
                      setIsPaperLabsCardCollapsed(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="hidden sm:inline">{lang === 'ar' ? 'قراءة بالذكاء الاصطناعي' : 'AI Scan'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAddLabColumn();
                    setIsPaperLabsCardCollapsed(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'إضافة عمود تحاليل' : 'Add Column'}</span>
                </button>

                <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                  {isPaperLabsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>
              </div>
            </div>

            {!isPaperLabsCardCollapsed && (
              <>

            {labsList.length === 0 ? (
              <div className="bg-[#070c18] border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-3">
                <div className="text-sm font-semibold">{lang === 'ar' ? 'لا توجد قراءات تحاليل مسجلة لهذا المريض بعد.' : 'No lab columns recorded for this patient yet.'}</div>
                <button
                  onClick={handleOpenAddLabColumn}
                  className="px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all"
                >
                  {lang === 'ar' ? 'سجل أول قراءة للتحاليل الآن' : 'Record First Lab Column Now'}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-[#070c18]">
                <table className="w-full text-xs font-mono border-collapse select-text">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800">
                      <th className={`p-3 text-left font-bold text-slate-400 border-r border-slate-800 sticky left-0 bg-slate-950 z-10 w-44 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {lang === 'ar' ? 'التحاليل الطبية / التاريخ' : 'Lab Parameter / Date'}
                      </th>
                      {labsList.map((lab) => {
                        const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Guest';
                        const isAuthor = lab.reviewedByDoctorName === doctorName || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
                        return (
                          <th key={lab.id} className="p-2 border-r border-slate-800 text-center min-w-[140px] relative group bg-[#090f1d]">
                            <div className="text-teal-400 font-bold">
                              {new Date(lab.timestamp).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { day: '2-digit', month: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(lab.timestamp).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </div>
                            <div className="text-[9px] text-slate-500 font-sans mt-0.5 flex items-center justify-center gap-1">
                              <User className="w-2.5 h-2.5 text-indigo-400" />
                              <span className="truncate max-w-[100px]" title={lab.reviewedByDoctorName}>{lab.reviewedByDoctorName}</span>
                            </div>

                            {/* Hover Actions: Lock / Edit / Delete */}
                            <div className="flex items-center justify-center gap-1.5 mt-2 pt-1 border-t border-slate-800/80">
                              {isAuthor ? (
                                <>
                                  <button
                                    onClick={() => handleStartEditLabColumn(lab)}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-teal-400 transition-all"
                                    title={lang === 'ar' ? 'تعديل هذا العمود' : 'Edit Column'}
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLabColumn(lab.id, lab.reviewedByDoctorName || 'Dr. Guest')}
                                    className="p-1 rounded bg-slate-800 hover:bg-red-950/60 text-red-400 transition-all"
                                    title={lang === 'ar' ? 'حذف العمود' : 'Delete Column'}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              ) : (
                                <span 
                                  className="p-1 text-slate-500 flex items-center gap-1 bg-slate-900/60 rounded px-2 cursor-not-allowed text-[8px] font-sans"
                                  title={lang === 'ar' ? `مغلق بواسطة ${lab.reviewedByDoctorName}` : `Locked by ${lab.reviewedByDoctorName}`}
                                  onClick={() => alert(lang === 'ar' 
                                    ? `⚠️ سجل طبي محمي: هذا العمود تم تسجيله بواسطة [${lab.reviewedByDoctorName}]. لا يمكن تعديله أو التلاعب به لضمان الدقة والنزاهة السريرية.` 
                                    : `⚠️ Protected Clinical Record: This column was recorded by [${lab.reviewedByDoctorName}]. Overwriting or editing another doctor's entry is strictly forbidden.`)}
                                >
                                  <Lock className="w-2.5 h-2.5 text-slate-600" />
                                  <span>{lang === 'ar' ? 'مغلق' : 'Locked'}</span>
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Panel 1: CBC */}
                    <tr className="bg-slate-900/50 border-b border-slate-800 font-bold"><td colSpan={labsList.length + 1} className="p-2 text-teal-300 border-r border-slate-800 sticky left-0 bg-[#0e172a]">{lang === 'ar' ? 'صورة الدم كاملة (CBC)' : 'Complete Blood Count (CBC)'}</td></tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'كريات الدم البيضاء (WBCs)' : 'WBCs (k/uL)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-white">{l.cbc.wbcCountKPerUl || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الهيموجلوبين (Hb)' : 'Hb (g/dL)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-teal-300 font-bold">{l.cbc.hemoglobinGPerDl || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الصفائح الدموية (PLT)' : 'PLT (k/uL)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-white">{l.cbc.plateletCountKPerUl || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'العد التفريقي (Differential)' : 'WBC Differential'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300 truncate max-w-[120px]" title={l.cbc.differential}>{l.cbc.differential || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'نوع الأنيميا (Type anemia)' : 'Type of Anemia'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300 truncate max-w-[120px]" title={l.cbc.typeAnemia}>{l.cbc.typeAnemia || '—'}</td>)}
                    </tr>

                    {/* Panel 2: Coagulation */}
                    <tr className="bg-slate-900/50 border-b border-slate-800 font-bold"><td colSpan={labsList.length + 1} className="p-2 text-cyan-300 border-r border-slate-800 sticky left-0 bg-[#0e172a]">{lang === 'ar' ? 'تخثر الدم والسيولة (Coagulation)' : 'Coagulation Panel'}</td></tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">INR</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-amber-300 font-bold">{l.coagulation.inr || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'وقت البروثرومبين PT' : 'PT (sec)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.coagulation.ptSeconds || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'وقت الثرومبوبلاستين الجزئي PTT' : 'PTT (sec)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.coagulation.pttSeconds || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الفيبرينوجين' : 'Fibrinogen (mg/dL)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.coagulation.fibrinogenMgPerDl || '—'}</td>)}
                    </tr>

                    {/* Panel 3: KFTs */}
                    <tr className="bg-slate-900/50 border-b border-slate-800 font-bold"><td colSpan={labsList.length + 1} className="p-2 text-indigo-300 border-r border-slate-800 sticky left-0 bg-[#0e172a]">{lang === 'ar' ? 'وظائف الكلى (KFTs)' : 'Kidney Function Tests (KFTs)'}</td></tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'اليوريا (Urea)' : 'Urea (mg/dL)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-white">{l.biochemistry.ureaMgPerDl || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الكرياتينين (Creat)' : 'Creatinine (mg/dL)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-orange-300 font-bold">{l.biochemistry.creatinineMgPerDl || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'حمض اليوريك (UA)' : 'Uric Acid (UA)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.uricAcidMgPerDl || '—'}</td>)}
                    </tr>

                    {/* Panel 4: Electrolytes */}
                    <tr className="bg-slate-900/50 border-b border-slate-800 font-bold"><td colSpan={labsList.length + 1} className="p-2 text-pink-300 border-r border-slate-800 sticky left-0 bg-[#0e172a]">{lang === 'ar' ? 'الأملاح والأيونات (Electrolytes)' : 'Serum Electrolytes'}</td></tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الصوديوم (Na)' : 'Sodium (Na)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-teal-300">{l.biochemistry.sodiumMeqPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'البوتاسيوم (K)' : 'Potassium (K)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-emerald-300 font-bold">{l.biochemistry.potassiumMeqPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الكالسيوم (Ca)' : 'Calcium (Ca)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.calciumMeqPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الفوسفور (Phos)' : 'Phosphorus (Phos)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.phosphorusMeqPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'المغنيسيوم (Mg)' : 'Magnesium (Mg)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.magnesiumMeqPerL || '—'}</td>)}
                    </tr>

                    {/* Panel 5: LFTs */}
                    <tr className="bg-slate-900/50 border-b border-slate-800 font-bold"><td colSpan={labsList.length + 1} className="p-2 text-yellow-400 border-r border-slate-800 sticky left-0 bg-[#0e172a]">{lang === 'ar' ? 'وظائف الكبد والأنزيمات (LFTs)' : 'Liver Function Tests (LFTs)'}</td></tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الصفراء الكلية (Bili)' : 'Total Bilirubin'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-amber-300">{l.biochemistry.totalBilirubinMgPerDl || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'الألبومين (Alb)' : 'Albumin (g/dL)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.albuminGPerDl || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">ALT</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-white">{l.biochemistry.altUPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">AST</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-white">{l.biochemistry.astUPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">ALP</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.alpUPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">GGT</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.ggtUPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">CK (الكرياتين كايناز)</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.ckUPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">CK-MB</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.ckMbUPerL || '—'}</td>)}
                    </tr>

                    {/* Panel 6: Pancreatic / Cardiac / Inflammatory */}
                    <tr className="bg-slate-900/50 border-b border-slate-800 font-bold"><td colSpan={labsList.length + 1} className="p-2 text-rose-300 border-r border-slate-800 sticky left-0 bg-[#0e172a]">{lang === 'ar' ? 'أنزيمات البنكرياس والقلب والالتهاب' : 'Pancreatic, Cardiac & Inflammatory Biomarkers'}</td></tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">Amylase</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.amylaseUPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">Lipase</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.lipaseUPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">Troponin</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-red-400 font-bold">{l.biochemistry.troponinNgPerMl || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">CRP (البروتين التفاعلي)</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.crpMgPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">ESR</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.biochemistry.esrMmHr || '—'}</td>)}
                    </tr>

                    {/* Panel 7: ABG */}
                    <tr className="bg-slate-900/50 border-b border-slate-800 font-bold"><td colSpan={labsList.length + 1} className="p-2 text-violet-300 border-r border-slate-800 sticky left-0 bg-[#0e172a]">{lang === 'ar' ? 'غازات الدم الشرياني (ABG)' : 'Arterial Blood Gas (ABG) Panel'}</td></tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">pH (الحموضة)</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-cyan-300 font-bold">{l.abg.ph || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">pO₂ (الأكسجين)</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-white">{l.abg.po2MmHg || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">pCO₂ (ثاني أكسيد الكربون)</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-white">{l.abg.pco2MmHg || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">HCO₃ (البيكربونات)</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-white">{l.abg.hco3MmolPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">Base Excess (BE)</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-slate-300">{l.abg.baseExcessMmolPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800/80 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">{lang === 'ar' ? 'اللاكتات (Lactate)' : 'Lactate (mmol/L)'}</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-orange-400 font-bold">{l.abg.lactateMmolPerL || '—'}</td>)}
                    </tr>
                    <tr className="border-b border-slate-800 hover:bg-slate-900/40">
                      <td className="p-2.5 border-r border-slate-800 sticky left-0 bg-[#070c18] font-bold text-slate-300">P/F Ratio</td>
                      {labsList.map(l => <td key={l.id} className="p-2.5 text-center border-r border-slate-800 text-emerald-400 font-bold">{l.abg.pao2Fio2Ratio || '—'}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
              </>
            )}
          </div>

          {/* Connected Support Equipment & Bedside Systems (الأجهزة الموصلة والمضخات وميزان السوائل) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Ventilator connectivity status */}
            {cardsConfig.showVentilatorCard && (
              <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3 flex flex-col justify-between">
                <div>
                  <div 
                    onClick={() => setIsPaperVentCardCollapsed(!isPaperVentCardCollapsed)}
                    className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Wind className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-sm font-bold text-white">{lang === 'ar' ? 'جهاز التنفس الصناعي' : 'Ventilator'}</h3>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCardsConfigModalOpen(true);
                        }}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                        title={lang === 'ar' ? 'تخصيص الخواص' : 'Customize Properties'}
                      >
                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      </button>

                      {ventilator && (
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[10px] font-bold">
                          {ventilator.mode}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsVentilatorModalOpen(true);
                          setIsPaperVentCardCollapsed(false);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                        title={lang === 'ar' ? 'إضافة أو تعديل إعدادات جهاز التنفس' : 'Add / Edit Ventilator Parameters'}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{ventilator ? (lang === 'ar' ? 'تعديل' : 'Edit') : (lang === 'ar' ? 'إضافة' : 'Add')}</span>
                      </button>

                      <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                        {isPaperVentCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {!isPaperVentCardCollapsed && (
                    <>
                      {ventilator ? (
                        <div 
                          onClick={() => setIsVentilatorModalOpen(true)}
                          className="grid grid-cols-2 gap-2.5 text-xs font-mono mt-3 cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                            <div className="text-[10px] text-slate-500">FiO₂ Provided</div>
                            <div className="text-teal-300 font-bold text-sm mt-0.5">{ventilator.fio2Percent}%</div>
                          </div>
                          <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                            <div className="text-[10px] text-slate-500">PEEP</div>
                            <div className="text-cyan-300 font-bold text-sm mt-0.5">{ventilator.peepCmH2O} cmH2O</div>
                          </div>
                          <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                            <div className="text-[10px] text-slate-500">Tidal Vol (Vt)</div>
                            <div className="text-white font-bold text-sm mt-0.5">{ventilator.setTidalVolumeMl} mL</div>
                          </div>
                          <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                            <div className="text-[10px] text-slate-500">Set Rate (RR)</div>
                            <div className="text-slate-200 font-bold text-sm mt-0.5">{ventilator.setRespiratoryRateCpm} bpm</div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-400 bg-[#070c18] rounded-xl border border-slate-800/80 mt-3 space-y-2">
                          <p>{lang === 'ar' ? 'المريض يتنفس تلقائياً بدون أجهزة جائرة.' : 'Patient breathing spontaneously (Room Air / HFNC).'}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsVentilatorModalOpen(true);
                              setIsPaperVentCardCollapsed(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'توصيل جهاز تنفس صناعي' : 'Connect Mechanical Vent'}</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Infusion lines connectivity status */}
            {cardsConfig.showInfusionPumpsCard && (
              <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3 flex flex-col justify-between">
                <div>
                  <div 
                    onClick={() => setIsPaperPumpsCardCollapsed(!isPaperPumpsCardCollapsed)}
                    className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Droplet className="w-5 h-5 text-amber-400" />
                      <h3 className="text-sm font-bold text-white">{lang === 'ar' ? 'مضخات ومحاليل وريدية' : 'Infusion Pumps'}</h3>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCardsConfigModalOpen(true);
                        }}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                        title={lang === 'ar' ? 'تخصيص الخواص' : 'Customize Properties'}
                      >
                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      </button>

                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800 font-bold">
                        {pumps.length} {lang === 'ar' ? 'نشط' : 'active'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPumpForEdit(null);
                          setIsPumpModalOpen(true);
                          setIsPaperPumpsCardCollapsed(false);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                        title={lang === 'ar' ? 'إضافة مضخة أو خط تنقيط وريدي جديد' : 'Add Infusion Pump Line'}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إضافة' : 'Add'}</span>
                      </button>

                      <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                        {isPaperPumpsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {!isPaperPumpsCardCollapsed && (
                    <>
                      {pumps.length > 0 ? (
                        <div className="space-y-2 max-h-[140px] overflow-y-auto mt-3">
                          {pumps.map(p => (
                            <div 
                              key={p.id} 
                              className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-xs hover:border-amber-500/40 transition-colors"
                            >
                              <div 
                                className="cursor-pointer flex-1 min-w-0"
                                onClick={() => {
                                  setSelectedPumpForEdit(p);
                                  setIsPumpModalOpen(true);
                                }}
                              >
                                <div className="font-bold text-white font-mono truncate max-w-[150px]">{p.drugNameEn}</div>
                                <div className="text-[9px] text-slate-500">{p.diluentFluid} (Conc: {p.concentrationMgPerMl}mg/mL)</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="text-right font-mono cursor-pointer"
                                  onClick={() => {
                                    setSelectedPumpForEdit(p);
                                    setIsPumpModalOpen(true);
                                  }}
                                >
                                  <div className="text-amber-400 font-bold">{p.currentRate} {p.rateUnit}</div>
                                  <div className="text-[9px] text-slate-500">Rem: {p.volumeRemainingMl}mL</div>
                                </div>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(lang === 'ar' ? `هل أنت متأكد من حذف مضخة [${p.drugNameEn}]؟` : `Delete infusion pump [${p.drugNameEn}]?`)) {
                                      await db.infusionPumps.delete(p.id);
                                      await loadBedsideData();
                                      onDataUpdated();
                                    }
                                  }}
                                  className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف المضخة' : 'Delete line'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-xs text-slate-400 bg-[#070c18] rounded-xl border border-slate-800/80 mt-3 space-y-2">
                          <p>{lang === 'ar' ? 'لا توجد قنوات حقن وريدي مسجلة حالياً.' : 'No active infusion pumps registered.'}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPumpForEdit(null);
                              setIsPumpModalOpen(true);
                              setIsPaperPumpsCardCollapsed(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'إضافة مضخة وريدية' : 'Add Infusion Pump'}</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Daily Fluid balances */}
            {cardsConfig.showFluidBalanceCard && (
              <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-3 flex flex-col justify-between">
                <div>
                  <div 
                    onClick={() => setIsPaperFluidsCardCollapsed(!isPaperFluidsCardCollapsed)}
                    className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Scale className="w-5 h-5 text-teal-400" />
                      <h3 className="text-sm font-bold text-white">{lang === 'ar' ? 'ميزان السوائل 24 ساعة' : 'Fluid Balance'}</h3>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCardsConfigModalOpen(true);
                        }}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                        title={lang === 'ar' ? 'تخصيص الخواص' : 'Customize Properties'}
                      >
                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      </button>

                      {fluidBalance && (() => {
                        const netVal = fluidBalance.netCumulativeBalanceMl ?? (fluidBalance as any).netBalance24HMl ?? 0;
                        return (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${netVal >= 0 ? 'bg-amber-950 text-amber-300' : 'bg-teal-950 text-teal-300'}`}>
                            Net: {netVal > 0 ? `+${netVal}` : netVal} mL
                          </span>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFluidModalOpen(true);
                          setIsPaperFluidsCardCollapsed(false);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                        title={lang === 'ar' ? 'تسجيل أو تعديل ميزان السوائل والبول' : 'Record / Edit Fluid Balance'}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{fluidBalance ? (lang === 'ar' ? 'تعديل' : 'Edit') : (lang === 'ar' ? 'تسجيل' : 'Record')}</span>
                      </button>

                      <div className="p-1 rounded-lg bg-slate-800 text-slate-400">
                        {isPaperFluidsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {!isPaperFluidsCardCollapsed && (
                    <>
                      {fluidBalance ? (() => {
                        const totalIntake = fluidBalance.intakeBreakdown?.totalIntakeMl ?? (fluidBalance as any).totalIntakeMl ?? 0;
                        const urineVal = fluidBalance.outputBreakdown?.urineOutputMl ?? (fluidBalance as any).outputBreakdown?.urineMl ?? 0;
                        return (
                          <div 
                            onClick={() => setIsFluidModalOpen(true)}
                            className="grid grid-cols-2 gap-2 text-xs font-mono mt-3 cursor-pointer hover:opacity-90 transition-opacity"
                          >
                            <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-500">Intake Total</div>
                              <div className="text-cyan-300 font-bold mt-0.5">{totalIntake} mL</div>
                            </div>
                            <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                              <div className="text-[10px] text-slate-500">Output Urine (UOP)</div>
                              <div className="text-amber-400 font-bold mt-0.5">{urineVal} mL</div>
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="p-6 text-center text-xs text-slate-400 bg-[#070c18] rounded-xl border border-slate-800/80 mt-3 space-y-2">
                          <p>{lang === 'ar' ? 'لم يسجل ميزان السوائل لليوم.' : 'No fluid balance records for today.'}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setIsFluidModalOpen(true);
                              setIsPaperFluidsCardCollapsed(false);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'تسجيل ميزان اليوم' : 'Log Today Balance'}</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Gorgeous Modal for Adding/Editing Lab Columns */}
          {isAddLabModalOpen && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl w-full max-w-4xl p-6 shadow-2xl space-y-4 my-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    <span>
                      {editingLabId 
                        ? (lang === 'ar' ? 'تعديل عمود التحاليل الطبي' : 'Edit Lab Column Details')
                        : (lang === 'ar' ? 'تسجيل عمود تحاليل متسلسلة جديد' : 'Record New Lab Column')}
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {settings.enableAiLabScanner && (
                      <button
                        type="button"
                        onClick={() => {
                          setAiScannerPreset('ALL');
                          setIsAiLabScannerOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-fuchsia-400" />
                        <span>{lang === 'ar' ? 'تصوير شريط التحليل (AI Scanner)' : 'Scan Lab Strip (AI)'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddLabModalOpen(false);
                        setEditingLabId(null);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all text-sm font-black"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveLabColumn} className="space-y-4 text-xs">
                  {/* Timestamp picker */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        {lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time of Sample Extraction'}
                      </label>
                      <input
                        type="datetime-local"
                        value={labForm.timestamp}
                        onChange={(e) => setLabForm({ ...labForm, timestamp: e.target.value })}
                        required
                        className="w-full bg-[#070c18] border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        {lang === 'ar' ? 'اسم الطبيب المسؤول (تلقائي)' : 'Recording Physician Name (Auto)'}
                      </label>
                      <input
                        type="text"
                        disabled
                        value={editingLabId ? (labsList.find(l => l.id === editingLabId)?.reviewedByDoctorName || 'Dr. Guest') : (currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Guest')}
                        className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-2 text-slate-400 cursor-not-allowed font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto max-h-[400px] pr-2">
                    {/* CBC Panel */}
                    <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <div className="text-xs font-bold text-teal-400 uppercase font-mono">{lang === 'ar' ? 'صورة الدم (CBC)' : 'Complete Blood Count (CBC)'}</div>
                        {settings.enableAiLabScanner && (
                          <button
                            type="button"
                            onClick={() => {
                              setAiScannerPreset('CBC');
                              setIsAiLabScannerOpen(true);
                            }}
                            className="px-2 py-0.5 rounded-md bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                            title={lang === 'ar' ? 'تصوير وقراءة تقرير CBC بالذكاء الاصطناعي' : 'Scan CBC report with AI'}
                          >
                            <Camera className="w-3 h-3 text-teal-400" />
                            <span>{lang === 'ar' ? 'تصوير CBC' : 'Scan CBC'}</span>
                          </button>
                        )}
                      </div>
                      <div>
                        <label className="text-slate-400 mb-1 block">WBCs (k/uL)</label>
                        <input type="number" step="any" value={labForm.wbc} onChange={e => setLabForm({ ...labForm, wbc: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-slate-400 mb-1 block">Hb Hemoglobin (g/dL)</label>
                        <input type="number" step="any" value={labForm.hb} onChange={e => setLabForm({ ...labForm, hb: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-slate-400 mb-1 block">Hematocrit Hct (%)</label>
                        <input type="number" step="any" value={labForm.hct} onChange={e => setLabForm({ ...labForm, hct: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-slate-400 mb-1 block">Platelets PLT (k/uL)</label>
                        <input type="number" step="any" value={labForm.plt} onChange={e => setLabForm({ ...labForm, plt: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-slate-400 mb-1 block">{lang === 'ar' ? 'العد التفريقي' : 'WBC Differential'}</label>
                        <input type="text" value={labForm.diff} onChange={e => setLabForm({ ...labForm, diff: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-slate-400 mb-1 block">{lang === 'ar' ? 'نوع الأنيميا' : 'Type of Anemia'}</label>
                        <input type="text" value={labForm.typeAnemia} onChange={e => setLabForm({ ...labForm, typeAnemia: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                      </div>
                    </div>

                    {/* Biochemistry & KFTs / Electrolytes */}
                    <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1.5 uppercase font-mono">{lang === 'ar' ? 'الكيمياء والوظائف والأملاح' : 'Chemistry & Kidney / Electrolytes'}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 mb-1 block">Urea</label>
                          <input type="number" step="any" value={labForm.urea} onChange={e => setLabForm({ ...labForm, urea: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Creatinine</label>
                          <input type="number" step="any" value={labForm.creat} onChange={e => setLabForm({ ...labForm, creat: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Uric Acid</label>
                          <input type="number" step="any" value={labForm.uricAcid} onChange={e => setLabForm({ ...labForm, uricAcid: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">BUN</label>
                          <input type="number" step="any" value={labForm.bun} onChange={e => setLabForm({ ...labForm, bun: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 mb-1 block">Sodium Na</label>
                          <input type="number" step="any" value={labForm.na} onChange={e => setLabForm({ ...labForm, na: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Potass K</label>
                          <input type="number" step="any" value={labForm.k} onChange={e => setLabForm({ ...labForm, k: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Calcium Ca</label>
                          <input type="number" step="any" value={labForm.ca} onChange={e => setLabForm({ ...labForm, ca: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Phos</label>
                          <input type="number" step="any" value={labForm.phos} onChange={e => setLabForm({ ...labForm, phos: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-slate-400 mb-1 block">Magnesium Mg</label>
                          <input type="number" step="any" value={labForm.mg} onChange={e => setLabForm({ ...labForm, mg: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 mb-1 block">Tot Bilirubin</label>
                          <input type="number" step="any" value={labForm.totalBili} onChange={e => setLabForm({ ...labForm, totalBili: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Albumin</label>
                          <input type="number" step="any" value={labForm.alb} onChange={e => setLabForm({ ...labForm, alb: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">ALT</label>
                          <input type="number" step="any" value={labForm.alt} onChange={e => setLabForm({ ...labForm, alt: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">AST</label>
                          <input type="number" step="any" value={labForm.ast} onChange={e => setLabForm({ ...labForm, ast: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">ALP</label>
                          <input type="number" step="any" value={labForm.alp} onChange={e => setLabForm({ ...labForm, alp: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">GGT</label>
                          <input type="number" step="any" value={labForm.ggt} onChange={e => setLabForm({ ...labForm, ggt: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                      </div>
                    </div>

                    {/* Coagulation, Biomarkers & ABG */}
                    <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <div className="text-xs font-bold text-violet-400 uppercase font-mono">{lang === 'ar' ? 'غازات الدم والعلامات (ABG)' : 'ABGs & Cardiac / Coagulation'}</div>
                        {settings.enableAiLabScanner && (
                          <button
                            type="button"
                            onClick={() => {
                              setAiScannerPreset('ABG');
                              setIsAiLabScannerOpen(true);
                            }}
                            className="px-2 py-0.5 rounded-md bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                            title={lang === 'ar' ? 'تصوير وقراءة شريط غازات الدم ABG بالذكاء الاصطناعي' : 'Scan ABG strip with AI'}
                          >
                            <Camera className="w-3 h-3 text-violet-400" />
                            <span>{lang === 'ar' ? 'تصوير ABG' : 'Scan ABG'}</span>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 mb-1 block">pH</label>
                          <input type="number" step="any" value={labForm.ph} onChange={e => setLabForm({ ...labForm, ph: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">pCO₂ (mmHg)</label>
                          <input type="number" step="any" value={labForm.pco2} onChange={e => setLabForm({ ...labForm, pco2: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">pO₂ (mmHg)</label>
                          <input type="number" step="any" value={labForm.po2} onChange={e => setLabForm({ ...labForm, po2: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">HCO₃</label>
                          <input type="number" step="any" value={labForm.hco3} onChange={e => setLabForm({ ...labForm, hco3: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Base Excess</label>
                          <input type="number" step="any" value={labForm.be} onChange={e => setLabForm({ ...labForm, be: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Lactate</label>
                          <input type="number" step="any" value={labForm.lactate} onChange={e => setLabForm({ ...labForm, lactate: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none font-bold text-orange-400" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-400 mb-1 block">INR</label>
                          <input type="number" step="any" value={labForm.inr} onChange={e => setLabForm({ ...labForm, inr: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Fibrinogen</label>
                          <input type="number" step="any" value={labForm.fib} onChange={e => setLabForm({ ...labForm, fib: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Troponin</label>
                          <input type="number" step="any" value={labForm.troponin} onChange={e => setLabForm({ ...labForm, troponin: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">CRP</label>
                          <input type="number" step="any" value={labForm.crp} onChange={e => setLabForm({ ...labForm, crp: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Amylase</label>
                          <input type="number" step="any" value={labForm.amylase} onChange={e => setLabForm({ ...labForm, amylase: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-slate-400 mb-1 block">Lipase</label>
                          <input type="number" step="any" value={labForm.lipase} onChange={e => setLabForm({ ...labForm, lipase: e.target.value })} className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddLabModalOpen(false);
                        setEditingLabId(null);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/25"
                    >
                      <Check className="w-4 h-4" />
                      <span>{editingLabId ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (lang === 'ar' ? 'تسجيل القراءة' : 'Record Column')}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Vitals & Telemetry */}
      {(activeTab === 'vitals' || activeTab === 'all') && (
        <div className="space-y-4">
          {latestVitals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* MAP */}
              <div className="bg-[#090f1d] border border-slate-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Mean Arterial Pressure (MAP)</div>
                <div className={`text-xl sm:text-2xl font-black font-mono mt-1 ${
                  latestVitals.meanArterialPressureMmHg < 65 ? 'text-red-400 animate-pulse' : 'text-cyan-300'
                }`}>
                  {latestVitals.meanArterialPressureMmHg} <span className="text-xs font-normal text-slate-400">mmHg</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  BP: {latestVitals.systolicBpMmHg}/{latestVitals.diastolicBpMmHg}
                </div>
              </div>

              {/* Heart Rate */}
              <div className="bg-[#090f1d] border border-slate-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                  <Heart className="w-3 h-3 text-red-400" />
                  <span>Heart Rate (HR)</span>
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono mt-1 text-emerald-400">
                  {latestVitals.heartRateBpm} <span className="text-xs font-normal text-slate-400">bpm</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  {latestVitals.heartRhythm}
                </div>
              </div>

              {/* SpO2 */}
              <div className="bg-[#090f1d] border border-slate-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold">SpO₂ & FiO₂</div>
                <div className="text-xl sm:text-2xl font-black font-mono mt-1 text-teal-300">
                  {latestVitals.spo2Percent}%
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  FiO₂: {latestVitals.fio2SuppliedPercent}%
                </div>
              </div>

              {/* Core Temp */}
              <div className="bg-[#090f1d] border border-slate-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Core Temp</div>
                <div className="text-xl sm:text-2xl font-black font-mono mt-1 text-amber-300">
                  {latestVitals.coreTemperatureCelsius}°C
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Site: {latestVitals.temperatureSite}
                </div>
              </div>

              {/* GCS & RASS */}
              <div className="bg-[#090f1d] border border-slate-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold">GCS / RASS</div>
                <div className="text-xl sm:text-2xl font-black font-mono mt-1 text-indigo-300">
                  {latestVitals.gcsTotalScore}/15
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  RASS: {latestVitals.sedationRassScore ?? 'N/A'}
                </div>
              </div>

              {/* Lactate */}
              <div className="bg-[#090f1d] border border-slate-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Lactate & Glucose</div>
                <div className="text-xl sm:text-2xl font-black font-mono mt-1 text-purple-300">
                  {latestVitals.lactateMmolPerL ?? '—'} <span className="text-xs font-normal text-slate-400">mmol/L</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  RBG: {latestVitals.bloodGlucoseMgDl ?? '—'} mg/dL
                </div>
              </div>
            </div>
          )}

          {/* Historical Feed Table */}
          <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>{lang === 'ar' ? 'سجل العلامات الحيوية التاريخية (Telemetry Trajectory)' : 'Telemetry History Trajectory'}</span>
              </h3>
              <button
                onClick={onOpenAddVitals}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة قراءة جديدة' : 'Add Reading'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2 px-3">{lang === 'ar' ? 'التوقيت' : 'Time'}</th>
                    <th className="py-2 px-3">MAP (mmHg)</th>
                    <th className="py-2 px-3">BP (Sys/Dia)</th>
                    <th className="py-2 px-3">HR (bpm)</th>
                    <th className="py-2 px-3">SpO₂ (%)</th>
                    <th className="py-2 px-3">RR (cpm)</th>
                    <th className="py-2 px-3">{lang === 'ar' ? 'اللاكتات' : 'Lactate'}</th>
                    <th className="py-2 px-3">{lang === 'ar' ? 'المسجل' : 'Staff'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {vitalsHistory.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(v.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </td>
                      <td className={`py-2.5 px-3 font-bold ${v.meanArterialPressureMmHg < 65 ? 'text-red-400' : 'text-cyan-300'}`}>
                        {v.meanArterialPressureMmHg}
                      </td>
                      <td className="py-2.5 px-3 text-white">
                        {v.systolicBpMmHg}/{v.diastolicBpMmHg} {v.isArterialLine ? '(Art)' : '(Cuff)'}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400">
                        {v.heartRateBpm}
                      </td>
                      <td className="py-2.5 px-3 text-teal-300">
                        {v.spo2Percent}% ({v.fio2SuppliedPercent}% Fi)
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {v.respiratoryRateCpm}
                      </td>
                      <td className="py-2.5 px-3 text-purple-300">
                        {v.lactateMmolPerL ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px] font-sans">
                        {v.recordedBy.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Ventilator & ABG */}
      {(activeTab === 'vent' || activeTab === 'all') && (
        <div className="space-y-4">
          {ventilator ? (
            <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wind className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' 
                      ? 'إعدادات جهاز التنفس الصناعي (Hamilton / Dräger V800)' 
                      : 'Mechanical Ventilator Settings (Hamilton / Dräger V800)'}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-700 font-mono font-bold text-xs">
                  MODE: {ventilator.mode}
                </span>
              </div>

              {/* Ventilator Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">FiO₂ Supplied</div>
                  <div className="text-xl font-bold text-teal-300 mt-1">{ventilator.fio2Percent}%</div>
                </div>

                <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">PEEP</div>
                  <div className="text-xl font-bold text-cyan-300 mt-1">{ventilator.peepCmH2O} <span className="text-xs text-slate-400">cmH2O</span></div>
                </div>

                <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Set Tidal Volume (Vt)</div>
                  <div className="text-xl font-bold text-white mt-1">{ventilator.setTidalVolumeMl} <span className="text-xs text-slate-400">mL</span></div>
                  <div className="text-[10px] text-teal-400 font-sans mt-0.5">
                    ({Math.round((ventilator.setTidalVolumeMl || ventilator.tidalVolumeMl || 420) / (patient.idealBodyWeightKg || (patient.gender === 'MALE' ? 70 : 60) || 70))} mL/kg IBW)
                  </div>
                </div>

                <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Set Rate (RR)</div>
                  <div className="text-xl font-bold text-slate-200 mt-1">{ventilator.setRespiratoryRateCpm} <span className="text-xs text-slate-400">bpm</span></div>
                </div>

                <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Peak Pressure (Ppeak)</div>
                  <div className="text-xl font-bold text-amber-300 mt-1">{ventilator.peakInspiratoryPressureCmH2O ?? '—'} <span className="text-xs text-slate-400">cmH2O</span></div>
                </div>

                <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Plateau Pressure (Pplat)</div>
                  <div className="text-xl font-bold text-indigo-300 mt-1">{ventilator.plateauPressureCmH2O ?? '—'} <span className="text-xs text-slate-400">cmH2O</span></div>
                </div>

                <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">Driving Pressure (Pplat - PEEP)</div>
                  <div className={`text-xl font-bold mt-1 ${
                    drivingPressure && drivingPressure > 14 ? 'text-red-400 font-black' : 'text-emerald-400'
                  }`}>
                    {drivingPressure ?? '—'} <span className="text-xs text-slate-400">cmH2O</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-sans">Target: &lt; 14 cmH2O (Lung-protective)</div>
                </div>

                <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">PaO₂ / FiO₂ Ratio (P/F)</div>
                  <div className={`text-xl font-bold mt-1 ${
                    ventilator.pao2Fio2Ratio && ventilator.pao2Fio2Ratio < 100 
                      ? 'text-red-400' 
                      : ventilator.pao2Fio2Ratio && ventilator.pao2Fio2Ratio < 200 
                      ? 'text-amber-400' 
                      : 'text-emerald-400'
                  }`}>
                    {ventilator.pao2Fio2Ratio ?? '—'}
                  </div>
                  <div className="text-[9px] text-red-400 font-sans font-bold">
                    {ventilator.pao2Fio2Ratio && ventilator.pao2Fio2Ratio < 100 && 'Severe ARDS (Berlin definition)'}
                    {ventilator.pao2Fio2Ratio && ventilator.pao2Fio2Ratio >= 100 && ventilator.pao2Fio2Ratio < 200 && 'Moderate ARDS'}
                    {ventilator.pao2Fio2Ratio && ventilator.pao2Fio2Ratio >= 200 && ventilator.pao2Fio2Ratio < 300 && 'Mild ARDS'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0b1224] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              {lang === 'ar' 
                ? 'المريض يتنفس تلقائياً بدون جهاز تنفس صناعي جائر (Spontaneous Breathing on Room Air / Venturi Mask).'
                : 'Patient is spontaneously breathing (Room Air / High-Flow Nasal Cannula / Mask).'}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Infusion Pumps */}
      {(activeTab === 'pumps' || activeTab === 'all') && (
        <div className="space-y-4">
          <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Droplet className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'مضخات الحقن الوريدي المتواصل (Alaris Smart Pumps)' : 'Vasoactive Continuous Infusion Lines'}
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {pumps.length} {lang === 'ar' ? 'قنوات نشطة' : 'Active Channels'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pumps.map((pump) => (
                <div 
                  key={pump.id}
                  className="bg-[#070c18] border border-slate-800 p-4 rounded-xl space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold">
                        {pump.pumpChannel}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1">
                        {lang === 'ar' ? `${pump.drugNameEn} (${pump.drugNameAr})` : pump.drugNameEn}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {lang === 'ar' 
                          ? `التركيز: ${pump.concentrationMgPerMl} mg/mL • المحلول: ${pump.diluentFluid}` 
                          : `Concentration: ${pump.concentrationMgPerMl} mg/mL • Diluent: ${pump.diluentFluid}`}
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                      {pump.status}
                    </span>
                  </div>

                  <div className="bg-[#0a101f] p-3 rounded-lg flex items-center justify-between font-mono">
                    <div>
                      <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'معدل التدفق (Current Rate)' : 'Current Rate'}</div>
                      <div className="text-lg font-black text-amber-300">
                        {pump.currentRate} <span className="text-xs text-slate-400">{pump.rateUnit}</span>
                      </div>
                    </div>

                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'المتبقي (Remaining)' : 'Remaining Volume'}</div>
                      <div className="text-sm font-bold text-slate-200">
                        {pump.volumeRemainingMl} mL
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">{lang === 'ar' ? 'هدف المعايرة:' : 'Titration Target:'}</span> {pump.targetParameter}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Fluids & MTP */}
      {(activeTab === 'fluids' || activeTab === 'all') && (
        <div className="space-y-4">
          {fluidBalance ? (() => {
            const netVal = fluidBalance.netCumulativeBalanceMl ?? (fluidBalance as any).netBalance24HMl ?? 0;
            const totalIntake = fluidBalance.intakeBreakdown?.totalIntakeMl ?? (fluidBalance as any).totalIntakeMl ?? 0;
            const totalOutput = fluidBalance.outputBreakdown?.totalOutputMl ?? (fluidBalance as any).totalOutputMl ?? 0;
            const ivMaint = fluidBalance.intakeBreakdown?.ivMaintenanceFluidMl ?? (fluidBalance as any).intakeBreakdown?.crystalloidMl ?? 0;
            const ivMeds = fluidBalance.intakeBreakdown?.ivMedicationInfusionsMl ?? (fluidBalance as any).intakeBreakdown?.infusionsMl ?? 0;
            const urineVal = fluidBalance.outputBreakdown?.urineOutputMl ?? (fluidBalance as any).outputBreakdown?.urineMl ?? 0;
            const uopRate = fluidBalance.outputBreakdown?.hourlyUrineAverageMlPerHour ?? (fluidBalance as any).outputBreakdown?.hourlyUrineRateMlPerHr ?? 0;
            
            const bloodMl = fluidBalance.intakeBreakdown?.bloodProductsMl ?? 0;
            const prbcUnits = (fluidBalance as any).transfusionProductsGiven?.prbcUnits ?? (bloodMl > 0 ? Math.ceil(bloodMl / 250) : 0);
            const ffpUnits = (fluidBalance as any).transfusionProductsGiven?.ffpUnits ?? 0;
            const plateletsUnits = (fluidBalance as any).transfusionProductsGiven?.plateletsUnits ?? 0;

            return (
              <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="w-5 h-5 text-teal-400" />
                    <h3 className="text-base font-bold text-white">
                      {lang === 'ar' 
                        ? 'ميزان السوائل ونقل مشتقات الدم (Fluid Balance & MTP)' 
                        : '24-Hour Fluid Balance & Massive Transfusion (MTP)'}
                    </h3>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-mono font-black ${
                    netVal >= 0 
                      ? 'bg-amber-950 text-amber-300 border border-amber-700' 
                      : 'bg-teal-950 text-teal-300 border border-teal-700'
                  }`}>
                    NET 24H: {netVal > 0 ? `+${netVal}` : netVal} mL
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                  <div className="bg-[#070c18] p-3.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'إجمالي المدخلات (Total Intake)' : 'Total Intake'}</div>
                    <div className="text-xl font-bold text-cyan-300 mt-1">{totalIntake} mL</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {lang === 'ar'
                        ? `محاليل: ${ivMaint} mL • مضخات: ${ivMeds} mL`
                        : `Crystalloid: ${ivMaint} mL • Infusions: ${ivMeds} mL`}
                    </div>
                  </div>

                  <div className="bg-[#070c18] p-3.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'إجمالي المخرجات (Total Output)' : 'Total Output'}</div>
                    <div className="text-xl font-bold text-amber-300 mt-1">{totalOutput} mL</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {lang === 'ar'
                        ? `بول: ${urineVal} mL (${uopRate} mL/hr)`
                        : `Urine: ${urineVal} mL (${uopRate} mL/hr)`}
                    </div>
                  </div>

                  <div className="bg-[#070c18] p-3.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'بروتوكول نقل الدم (MTP Transfusions)' : 'MTP Blood Transfusion'}</div>
                    <div className="text-sm font-bold text-red-300 mt-1">
                      PRBC: {prbcUnits} {lang === 'ar' ? 'أكياس' : 'Units'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      FFP: {ffpUnits} • Platelets: {plateletsUnits}
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="bg-[#0b1224] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              {lang === 'ar' ? 'لا توجد بيانات مسجلة لميزان السوائل اليوم.' : 'No fluid balance logs recorded for today.'}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: SBAR Handovers */}
      {(activeTab === 'sbar' || activeTab === 'all') && (
        <div className="space-y-4">
          <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'سجلات تسليم واستلام المناوبات السريرية (SBAR Archive)' : 'SBAR Shift Handover Reports'}
                </h3>
              </div>
              <button
                onClick={onOpenSbarSign}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                <span>{lang === 'ar' ? 'تسليم جديد' : 'New Handover'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {sbarList.map((sbar) => (
                <div 
                  key={sbar.id}
                  className="bg-[#070c18] border border-slate-800 p-4 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-300 px-2 py-0.5 rounded bg-teal-950 border border-teal-800">
                        {sbar.shiftType}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {sbar.shiftDate} ({sbar.shiftStartTime} - {sbar.shiftEndTime})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                      <Lock className="w-3 h-3" />
                      <span>{sbar.cryptographicHash ? sbar.cryptographicHash.slice(0, 16) : 'HASH'}...</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#0a101f] p-3 rounded-lg">
                      <span className="text-teal-400 font-bold font-mono">S - Situation:</span>
                      <p className="text-slate-200 mt-1">{sbar.situation}</p>
                    </div>

                    <div className="bg-[#0a101f] p-3 rounded-lg">
                      <span className="text-cyan-400 font-bold font-mono">B - Background:</span>
                      <p className="text-slate-200 mt-1">{sbar.background}</p>
                    </div>

                    <div className="bg-[#0a101f] p-3 rounded-lg">
                      <span className="text-amber-400 font-bold font-mono">A - Assessment:</span>
                      <div className="text-slate-200 mt-1 space-y-0.5">
                        <div>• {sbar.assessment.hemodynamics}</div>
                        <div>• {sbar.assessment.pulmonaryAndAirway}</div>
                        <div>• {sbar.assessment.metabolicAndRenal}</div>
                      </div>
                    </div>

                    <div className="bg-[#0a101f] p-3 rounded-lg">
                      <span className="text-emerald-400 font-bold font-mono">R - Recommendation:</span>
                      <ul className="text-slate-200 mt-1 list-disc list-inside space-y-0.5">
                        {sbar.recommendationAndOrders.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                    <span>{lang === 'ar' ? 'المُسَلِّم:' : 'Outgoing:'} <strong className="text-slate-200">{sbar.outgoingDoctor.name}</strong></span>
                    {sbar.incomingDoctor && (
                      <span>{lang === 'ar' ? 'المُستَلِم:' : 'Incoming:'} <strong className="text-slate-200">{sbar.incomingDoctor.name}</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Clinical Notes & SHA-256 Addendums */}
      {(activeTab === 'notes' || activeTab === 'all') && (
        <div className="space-y-4">
          <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'الملاحظات الطبية المشفرة وملحقاتها' : 'Clinical Progress Notes & Cryptographic Addendums'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' 
                      ? 'ملاحظات الأطباء محمية بتشفير SHA-256، لا يمكن حذفها، ويتم إلحاق التحديثات عبر Addendums فقط.'
                      : 'Medical notes are cryptographic SHA-256 protected and immutable. Modifications are appended as verified addendums.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {notesList.map((note) => (
                <div 
                  key={note.id}
                  className="bg-[#070c18] border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <span className="font-bold text-white text-sm">{note.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 mx-2">
                        {note.noteType} • {new Date(note.timestamp).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-teal-400 px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/60">
                        SHA-256: {note.cryptographicHash ? note.cryptographicHash.slice(0, 10) : 'HASH'}...
                      </span>
                      <button
                        onClick={() => onOpenAddAddendum(note.id, note.authorName)}
                        className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all"
                      >
                        + {lang === 'ar' ? 'إلحاق ملحق (Addendum)' : 'Add Addendum'}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                    {note.content}
                  </p>

                  <div className="text-[11px] text-slate-400">
                    {lang === 'ar' ? 'الكاتب:' : 'Author:'} <strong className="text-slate-200">{note.authorName}</strong> ({note.authorRole})
                  </div>

                  {/* Chained Addendums */}
                  {note.addendums && note.addendums.length > 0 && (
                    <div className="bg-[#0a101f] border-l-2 sm:border-r-2 border-purple-500 p-3 rounded-lg space-y-2 mt-2">
                      <div className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? `الملحقات المشفرة المربوطة بالسلسلة (${note.addendums.length}):` : `Chained Cryptographic Addendums (${note.addendums.length}):`}</span>
                      </div>

                      {note.addendums.map((addendum) => (
                        <div key={addendum.id} className="text-xs space-y-1 bg-[#070c17] p-2.5 rounded-lg border border-purple-900/30">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>{new Date(addendum.timestamp).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}</span>
                            <span className="text-purple-400">
                              PrevHash: {addendum.previousHash ? addendum.previousHash.slice(0, 8) : 'ROOT'}...
                            </span>
                          </div>
                          <p className="text-slate-200">{addendum.content}</p>
                          <div className="text-[10px] text-purple-300">
                            {lang === 'ar' 
                              ? `السبب: ${addendum.reasonForAddendum} • الطبيب: ${addendum.authorName}` 
                              : `Reason: ${addendum.reasonForAddendum} • Physician: ${addendum.authorName}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Disposition */}
      {(activeTab === 'disposition' || activeTab === 'all') && (
        <div className="space-y-4">
          <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'بروتوكول إنهاء الإقامة بالرعاية (ICU Disposition & Discharge)' : 'ICU Disposition & Discharge Protocol'}
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'ar' 
                    ? 'تحويل المريض للأقسام الداخلية، النقل لمستشفى آخر، أو تسجيل الوفاة القانونية.'
                    : 'Discharge to ward / HDU, external hospital transfer, or mortality registration.'}
                </p>
              </div>
            </div>

            <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-4 text-xs">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold">
                  {lang === 'ar' ? 'نوع الإجراء (Disposition Pathway)' : 'Disposition Pathway'}
                </label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDispType(DispositionType.TRANSFER_GENERAL_WARD)}
                    className={`p-3 rounded-xl border font-bold text-xs ${isRTL ? 'text-right' : 'text-left'} transition-all ${
                      dispType === DispositionType.TRANSFER_GENERAL_WARD
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>{lang === 'ar' ? 'تحويل / خروج تحسن (Stepdown / Ward)' : 'Stepdown Transfer / Ward'}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-1">
                      {lang === 'ar' ? 'نقل المريض لجناح الباطنة أو الرعاية المتوسطة HDU' : 'Transfer to inpatient ward or High Dependency Unit (HDU)'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDispType(DispositionType.CLINICAL_MORTALITY)}
                    className={`p-3 rounded-xl border font-bold text-xs ${isRTL ? 'text-right' : 'text-left'} transition-all ${
                      dispType === DispositionType.CLINICAL_MORTALITY
                        ? 'bg-red-950/60 text-red-300 border-red-500/50'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>{lang === 'ar' ? 'تسجيل وفاة سريرية (Clinical Mortality)' : 'Clinical Mortality Registration'}</div>
                    <div className="text-[10px] font-normal text-slate-400 mt-1">
                      {lang === 'ar' ? 'تفعيل بروتوكول حفظ الملف لمدة 10 أيام قبل الأرشفة النهائية' : '10-day active record retention prior to final archive'}
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold">
                  {lang === 'ar' ? 'ملخص الخروج / سبب الوفاة' : 'Clinical Summary & Reason'}
                </label>
                <textarea
                  rows={3}
                  value={dispSummary}
                  onChange={(e) => setDispSummary(e.target.value)}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold">
                  {lang === 'ar' ? 'الطبيب الاستشاري المعتمد' : 'Attending Physician Signature'}
                </label>
                <input
                  type="text"
                  value={physicianSign}
                  onChange={(e) => setPhysicianSign(e.target.value)}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div className={`pt-2 flex ${isRTL ? 'justify-end' : 'justify-end'}`}>
                <button
                  type="button"
                  onClick={handleExecuteDisposition}
                  className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                    dispType === DispositionType.CLINICAL_MORTALITY
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {lang === 'ar' 
                      ? `تأكيد الإجراء وإخلاء السرير ${bed.bedNumber}` 
                      : `Confirm & Vacate Bed ${bed.bedNumber}`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Daily Lab Flowsheet with Interactive Trend History (HG 5 > 7 > 8.5 > 8) */}
      {(activeTab === 'labs' || activeTab === 'all') && (
        <LabFlowsheetSection
          patientId={patient.id}
          bedNumber={bed.bedNumber}
          labResults={labResults}
          onLabAdded={() => {
            loadBedsideData();
            onDataUpdated();
          }}
        />
      )}

      {/* Tab: Investigations, Radiology & POCUS Studies */}
      {(activeTab === 'investigations' || activeTab === 'all') && (
        <InvestigationsSection
          patientId={patient.id}
          bedNumber={bed.bedNumber}
          investigations={investigations}
          onInvestigationAdded={() => {
            loadBedsideData();
            onDataUpdated();
          }}
        />
      )}

      {/* Patient Transfer to Vacant Bed Modal */}
      <PatientTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        currentBed={bed}
        patient={patient}
        allBeds={allBeds}
        onTransferSuccess={() => {
          setIsTransferModalOpen(false);
          loadBedsideData();
          onDataUpdated();
          onBack();
        }}
      />

      {/* Atomic Two-Patient Bed Swap Modal */}
      <BedSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => setIsSwapModalOpen(false)}
        sourceBed={bed}
        sourcePatient={patient}
        allBeds={allBeds}
        allPatients={allPatients}
        onSwapSuccess={() => {
          setIsSwapModalOpen(false);
          loadBedsideData();
          onDataUpdated();
          onBack();
        }}
      />

      {/* Bed Isolation & Availability Status Modal */}
      <BedIsolationModal
        isOpen={isIsolationModalOpen}
        onClose={() => setIsIsolationModalOpen(false)}
        bed={bed}
        patient={patient}
        onUpdated={() => {
          setIsIsolationModalOpen(false);
          loadBedsideData();
          onDataUpdated();
        }}
      />

      {/* AI Lab OCR Optical Scanner Modal */}
      {settings.enableAiLabScanner && (
        <AiLabScannerModal
          isOpen={isAiLabScannerOpen}
          onClose={() => setIsAiLabScannerOpen(false)}
          patientId={patient.id}
          patientName={patient.fullNameAr || patient.fullNameEn}
          bedNumber={bed.bedNumber}
          targetPreset={aiScannerPreset}
          onApplyToForm={handleApplyScannedToForm}
          onDirectSave={handleDirectSaveScannedLab}
        />
      )}

      {/* Ventilator Settings & Parameters Modal */}
      <VentilatorModal
        isOpen={isVentilatorModalOpen}
        onClose={() => setIsVentilatorModalOpen(false)}
        bedNumber={bed.bedNumber}
        patient={patient}
        initialVentilator={ventilator}
        onSaved={() => {
          setIsVentilatorModalOpen(false);
          loadBedsideData();
          onDataUpdated();
        }}
      />

      {/* Infusion Pump Line Modal (Add & Edit) */}
      <InfusionPumpModal
        isOpen={isPumpModalOpen}
        onClose={() => {
          setIsPumpModalOpen(false);
          setSelectedPumpForEdit(null);
        }}
        bedNumber={bed.bedNumber}
        patient={patient}
        editingPump={selectedPumpForEdit}
        onSaved={() => {
          setIsPumpModalOpen(false);
          setSelectedPumpForEdit(null);
          loadBedsideData();
          onDataUpdated();
        }}
      />

      {/* Fluid Balance 24h Tracker Modal */}
      <FluidBalanceModal
        isOpen={isFluidModalOpen}
        onClose={() => setIsFluidModalOpen(false)}
        bedNumber={bed.bedNumber}
        patient={patient}
        initialFluidBalance={fluidBalance}
        onSaved={() => {
          setIsFluidModalOpen(false);
          loadBedsideData();
          onDataUpdated();
        }}
      />

      {/* Bedside Cards Visibility & Customization Modal */}
      <BedsideCardsConfigModal
        isOpen={isCardsConfigModalOpen}
        onClose={() => setIsCardsConfigModalOpen(false)}
        bedNumber={bed.bedNumber}
        patientName={patient.fullNameAr || patient.fullNameEn}
        currentConfig={cardsConfig}
        onSaveConfig={handleSaveCardsConfig}
        onOpenAddVent={() => {
          setIsCardsConfigModalOpen(false);
          setIsVentilatorModalOpen(true);
        }}
        onOpenAddPump={() => {
          setIsCardsConfigModalOpen(false);
          setSelectedPumpForEdit(null);
          setIsPumpModalOpen(true);
        }}
        onOpenAddFluid={() => {
          setIsCardsConfigModalOpen(false);
          setIsFluidModalOpen(true);
        }}
        onOpenAddVitals={() => {
          setIsCardsConfigModalOpen(false);
          onOpenAddVitals();
        }}
        onOpenAddSbar={() => {
          setIsCardsConfigModalOpen(false);
          onOpenSbarSign();
        }}
        onOpenAddLab={() => {
          setIsCardsConfigModalOpen(false);
          setIsAddLabModalOpen(true);
        }}
      />
    </div>
  );
};
