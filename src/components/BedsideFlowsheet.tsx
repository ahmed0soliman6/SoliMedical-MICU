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
  History,
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
  ChevronUp,
  Scan,
  Minus,
  Play,
  Pause,
  PowerOff,
  Pill
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
  PatientAntibiotic,
  CodeStatus,
  StaffRole,
  DispositionType,
  StatLabPanel,
  LabResultItem,
  InvestigationItem,
  BedStatus,
  AcuityLevel,
  IntakePathway,
  BedNumber,
  PumpStatus
} from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { dischargeOrTransferPatient, getPatientForBed } from '../services/dataModel.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { syncStatLabsToCloud, syncPatientToCloud, syncPumpToCloud, firestore } from '../services/firebase.ts';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { FullPageAdmission } from './FullPageAdmission.tsx';
import { LabFlowsheetSection } from './LabFlowsheetSection.tsx';
import { AntibioticsSection } from './AntibioticsSection.tsx';
import { InvestigationsSection } from './InvestigationsSection.tsx';
import { PatientTransferModal } from './PatientTransferModal.tsx';
import { BedSwapModal } from './BedSwapModal.tsx';
import { BedIsolationModal } from './BedIsolationModal.tsx';
import { AiLabScannerModal } from './AiLabScannerModal.tsx';
import { VentilatorModal } from './VentilatorModal.tsx';
import { InfusionPumpModal } from './InfusionPumpModal.tsx';
import { FluidBalanceModal } from './FluidBalanceModal.tsx';
import { SbarSignModal } from './SbarSignModal.tsx';
import { AddVitalsModal } from './AddVitalsModal.tsx';
import { LabsTemplateManager } from './LabsTemplateManager.tsx';
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
  onOpenAddClinicalNote?: () => void;
  onOpenAddAddendum: (noteId: string, author: string) => void;
  onOpenSbarSign: () => void;
  onDataUpdated: () => void;
}

const formatNumericDate = (dateVal?: string | Date | number): string => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

export const BedsideFlowsheet: React.FC<BedsideFlowsheetProps> = ({
  bed,
  patient,
  allBeds = [],
  allPatients = [],
  onSelectBed,
  onBack,
  onOpenAddVitals,
  onOpenAddClinicalNote,
  onOpenAddAddendum,
  onOpenSbarSign,
  onDataUpdated,
}) => {
  const { settings } = useSystemSettings();
  const { t, lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'all' | 'paperFlowsheet' | 'labs' | 'antibiotics' | 'investigations' | 'vitals' | 'vent' | 'pumps' | 'fluids' | 'sbar' | 'notes' | 'disposition' | 'labTemplates'>('all');
  const [isPatientCardCollapsed, setIsPatientCardCollapsed] = useState<boolean>(true);
  const [isDispositionCardCollapsed, setIsDispositionCardCollapsed] = useState<boolean>(true);
  const [isHistoryCardCollapsed, setIsHistoryCardCollapsed] = useState<boolean>(true);
  const [isDemographicsCardCollapsed, setIsDemographicsCardCollapsed] = useState<boolean>(true);
  const [isMicrobiologyCardCollapsed, setIsMicrobiologyCardCollapsed] = useState<boolean>(true);
  const [isPaperVitalsCardCollapsed, setIsPaperVitalsCardCollapsed] = useState<boolean>(true);
  const [isPaperVentCardCollapsed, setIsPaperVentCardCollapsed] = useState<boolean>(true);
  const [isVentHistoryExpanded, setIsVentHistoryExpanded] = useState<boolean>(false);
  const [isPaperPumpsCardCollapsed, setIsPaperPumpsCardCollapsed] = useState<boolean>(true);
  const [isPaperFluidsCardCollapsed, setIsPaperFluidsCardCollapsed] = useState<boolean>(true);
  const [isPaperLabsCardCollapsed, setIsPaperLabsCardCollapsed] = useState<boolean>(true);
  const [isPaperAntibioticsCardCollapsed, setIsPaperAntibioticsCardCollapsed] = useState<boolean>(true);
  const [isPaperInvestigationsCardCollapsed, setIsPaperInvestigationsCardCollapsed] = useState<boolean>(true);
  const [isPaperSbarCardCollapsed, setIsPaperSbarCardCollapsed] = useState<boolean>(true);
  const [isPaperNotesCardCollapsed, setIsPaperNotesCardCollapsed] = useState<boolean>(true);
  const [isPaperDispCardCollapsed, setIsPaperDispCardCollapsed] = useState<boolean>(true);
  
  const [vitalsHistory, setVitalsHistory] = useState<TelemetryVitals[]>([]);
  const [ventilator, setVentilator] = useState<VentilatorParameters | null>(null);
  const [pumps, setPumps] = useState<InfusionPumpLine[]>([]);
  const [fluidBalance, setFluidBalance] = useState<FluidBalance24H | null>(null);
  const [allFluidBalances, setAllFluidBalances] = useState<FluidBalance24H[]>([]);
  const [antibioticsList, setAntibioticsList] = useState<PatientAntibiotic[]>([]);
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
  const [selectedFluidBalanceForEdit, setSelectedFluidBalanceForEdit] = useState<FluidBalance24H | null>(null);
  const [isCardsConfigModalOpen, setIsCardsConfigModalOpen] = useState(false);
  const [isBedsideSbarModalOpen, setIsBedsideSbarModalOpen] = useState(false);
  const [selectedTemplateSbar, setSelectedTemplateSbar] = useState<SbarHandoverReport | null>(null);
  const [selectedSbarIdForView, setSelectedSbarIdForView] = useState<string | 'ALL'>('ALL');
  const [showMoreSbars, setShowMoreSbars] = useState(false);
  const [showMoreBedsideFluids, setShowMoreBedsideFluids] = useState(false);

  // Vitals pagination and edit states
  const [showAllVitals, setShowAllVitals] = useState(false);
  const [selectedVitalForEdit, setSelectedVitalForEdit] = useState<TelemetryVitals | null>(null);
  const [isEditVitalsModalOpen, setIsEditVitalsModalOpen] = useState(false);

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

  // Operation modals & Full Demographics Edit Modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isIsolationModalOpen, setIsIsolationModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);

  // Acuity & Pathway Helper Functions
  const getAcuityArLabel = (level?: AcuityLevel) => {
    switch (level) {
      case AcuityLevel.CRITICAL_STAT: return lang === 'ar' ? 'حالة حرجة جداً (STAT)' : 'Critical (STAT)';
      case AcuityLevel.HIGH_VIGILANCE: return lang === 'ar' ? 'حرجة مع يقظة عالية' : 'High Vigilance';
      case AcuityLevel.GUARDED_STABLE: return lang === 'ar' ? 'مستقر تحت الملاحظة' : 'Guarded Stable';
      case AcuityLevel.STEP_DOWN: return lang === 'ar' ? 'نقاهة / قسم داخلي' : 'Step-Down';
      default: return level || (lang === 'ar' ? 'حرجة / تحت التقييم' : 'Critical');
    }
  };

  const getAcuityStyle = (level?: AcuityLevel) => {
    switch (level) {
      case AcuityLevel.CRITICAL_STAT: return 'bg-red-950/80 text-red-300 border-red-800/80';
      case AcuityLevel.HIGH_VIGILANCE: return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
      case AcuityLevel.GUARDED_STABLE: return 'bg-teal-950/80 text-teal-300 border-teal-800/80';
      case AcuityLevel.STEP_DOWN: return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
      default: return 'bg-red-950/80 text-red-300 border-red-800/80';
    }
  };

  const getPathwayArLabel = (pathway?: IntakePathway) => {
    switch (pathway) {
      case IntakePathway.STAT_CRITICAL: return lang === 'ar' ? 'طوارئ / استقبال (ER)' : 'ER / Stat Critical';
      case IntakePathway.ELECTIVE_POST_OP: return lang === 'ar' ? 'عمليات / جراحة (OR)' : 'OR / Elective Post-Op';
      case IntakePathway.FLOOR_TRANSFER: return lang === 'ar' ? 'قسم داخلي (Ward)' : 'Floor Transfer';
      case IntakePathway.ER_REFERRAL: return lang === 'ar' ? 'استقبال حرج (ER)' : 'ER Referral';
      default: return pathway || (lang === 'ar' ? 'استقبال حرج (ER)' : 'ER Admission');
    }
  };

  // History & Diagnosis edit states
  const [isHistoryEditing, setIsHistoryEditing] = useState(false);
  const [historyInput, setHistoryInput] = useState(patient.history || '');
  const [presentingComplaintInput, setPresentingComplaintInput] = useState(patient.presentingComplaint || '');
  const [chronicDiseasesInput, setChronicDiseasesInput] = useState(patient.chronicDiseases || '');
  const [primaryDiagnosisEnInput, setPrimaryDiagnosisEnInput] = useState(patient.primaryDiagnosisEn || '');
  const [primaryDiagnosisArInput, setPrimaryDiagnosisArInput] = useState(patient.primaryDiagnosisAr || '');

  // Lab modal and form states
  const [isAddLabModalOpen, setIsAddLabModalOpen] = useState(false);
  const [selectedModalCatId, setSelectedModalCatId] = useState<string>('all');
  const [editingLabId, setEditingLabId] = useState<string | null>(null);
  const [isAiLabScannerOpen, setIsAiLabScannerOpen] = useState(false);
  const [aiScannerPreset, setAiScannerPreset] = useState<'ABG' | 'CBC' | 'CHEMISTRY' | 'ALL'>('ALL');
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
  const [dispType, setDispType] = useState<DispositionType | null>(null);
  const [dispSummary, setDispSummary] = useState<string>('');
  const [physicianSign, setPhysicianSign] = useState<string>('Dr. Hesham Talaat');
  const [useOtherConsultant, setUseOtherConsultant] = useState<boolean>(false);
  const [otherConsultantName, setOtherConsultantName] = useState<string>('');
  const [isDispPanelOpen, setIsDispPanelOpen] = useState<boolean>(false);

  useEffect(() => {
    loadBedsideData();
  }, [bed.bedNumber, patient.id]);

  useEffect(() => {
    // Reset edit states on patient change
    setHistoryInput(patient.history || '');
    setPresentingComplaintInput(patient.presentingComplaint || '');
    setChronicDiseasesInput(patient.chronicDiseases || '');
    setPrimaryDiagnosisEnInput(patient.primaryDiagnosisEn || patient.primaryDiagnosisAr || '');
    setPrimaryDiagnosisArInput(patient.primaryDiagnosisAr || '');
    setIsHistoryEditing(false);

    loadBedsideData();
    const interval = setInterval(() => {
      loadBedsideData();
    }, 2500);
    return () => clearInterval(interval);
  }, [bed.bedNumber, patient.id]);

  const loadBedsideData = async () => {
    let vitals = await db.vitals
      .where('patientId')
      .equals(patient.id)
      .reverse()
      .sortBy('timestamp');

    if (vitals.length === 0 && bed.bedNumber) {
      const bedVitals = await db.vitals
        .where('bedId')
        .equals(bed.bedNumber)
        .reverse()
        .sortBy('timestamp');
      if (bedVitals.length > 0) {
        vitals = bedVitals;
      }
    }

    if (vitals.length === 0) {
      const mapVal = Math.round(65 + (110 - 65) / 3);
      const seedVital: TelemetryVitals = {
        id: `vit-seed-${patient.id}`,
        bedId: bed.bedNumber,
        bedNumber: bed.bedNumber,
        patientId: patient.id,
        timestamp: new Date().toISOString(),
        heartRateBpm: 88,
        heartRhythm: 'Normal Sinus Rhythm',
        systolicBpMmHg: 110,
        diastolicBpMmHg: 65,
        meanArterialPressureMmHg: mapVal,
        isArterialLine: false,
        spo2Percent: 97,
        fio2SuppliedPercent: 40,
        respiratoryRateCpm: 18,
        coreTemperatureCelsius: 37.1,
        temperatureSite: 'FOLEY_CORE',
        gcsTotalScore: 15,
        gcsBreakdown: { eyeOpening: 4, verbalResponse: 5, motorResponse: 6 },
        sedationRassScore: 0,
        lactateMmolPerL: 1.4,
        bloodGlucoseMgDl: 120,
        recordedBy: {
          staffId: '1001',
          name: 'ICU Triage Staff',
          role: StaffRole.BEDSIDE_RN,
        },
        clinicalNotes: 'Initial admission baseline vitals',
      };
      await db.vitals.put(seedVital);
      vitals = [seedVital];
    }
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
      .toArray();
    fluids.sort((a, b) => new Date(b.periodEndTimestamp || (b as any).date || 0).getTime() - new Date(a.periodEndTimestamp || (a as any).date || 0).getTime());
    setAllFluidBalances(fluids);
    setFluidBalance(fluids[0] || null);

    const sbars = await db.sbarHandovers
      .where('patientId')
      .equals(patient.id)
      .toArray();
    sbars.sort((a, b) => new Date(b.outgoingDoctor?.signedAt || b.shiftDate || 0).getTime() - new Date(a.outgoingDoctor?.signedAt || a.shiftDate || 0).getTime());
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

    // Load Active & Past Antibiotics for patient
    const abxItems = await db.patientAntibiotics
      .where('patientId')
      .equals(patient.id)
      .reverse()
      .sortBy('createdAt');
    setAntibioticsList(abxItems);
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
        primaryDiagnosisAr: primaryDiagnosisEnInput,
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

  const getStepForUnit = (unit: string): number => {
    switch (unit) {
      case 'mcg/kg/min': return 0.02;
      case 'mcg/h': return 10;
      case 'mg/h': return 1;
      case 'Units/hr': return 0.5;
      case 'ml/h': return 5;
      default: return 1;
    }
  };

  const handleTitratePump = async (pump: InfusionPumpLine, direction: 'UP' | 'DOWN', customStep?: number) => {
    try {
      const step = customStep ?? getStepForUnit(pump.rateUnit);
      const delta = direction === 'UP' ? step : -step;
      const newRate = Math.max(0, Math.round((pump.currentRate + delta) * 100) / 100);

      let newFlowRate = pump.flowRateMlPerHour;
      if (pump.currentRate > 0 && pump.flowRateMlPerHour > 0) {
        newFlowRate = Math.max(0, Math.round((pump.flowRateMlPerHour * (newRate / pump.currentRate)) * 10) / 10);
      } else if (pump.rateUnit === 'ml/h') {
        newFlowRate = newRate;
      }

      const updated: InfusionPumpLine = {
        ...pump,
        currentRate: newRate,
        flowRateMlPerHour: newFlowRate,
        status: newRate === 0 ? PumpStatus.STOPPED : (pump.status === PumpStatus.STOPPED ? PumpStatus.RUNNING : pump.status),
      };

      await db.infusionPumps.put(updated);
      try {
        await syncPumpToCloud(updated);
      } catch (e) {
        console.warn('Firestore offline sync for pump titration:', e);
      }
      await loadBedsideData();
      onDataUpdated();
    } catch (err) {
      console.error('Error titrating infusion pump:', err);
    }
  };

  const handleTogglePumpStatus = async (pump: InfusionPumpLine) => {
    try {
      const nextStatus = pump.status === PumpStatus.RUNNING ? PumpStatus.STANDBY : PumpStatus.RUNNING;
      const updated: InfusionPumpLine = {
        ...pump,
        status: nextStatus,
      };
      await db.infusionPumps.put(updated);
      try {
        await syncPumpToCloud(updated);
      } catch (e) {
        console.warn('Firestore offline sync for pump status:', e);
      }
      await loadBedsideData();
      onDataUpdated();
    } catch (err) {
      console.error('Error toggling pump status:', err);
    }
  };

  const handleDeletePumpLine = async (pump: InfusionPumpLine) => {
    try {
      await db.infusionPumps.delete(pump.id);
      try {
        const pumpRef = doc(firestore, 'infusionPumps', pump.id);
        await deleteDoc(pumpRef);
      } catch (e) {
        console.warn('Firestore delete pump offline sync:', e);
      }
      await loadBedsideData();
      onDataUpdated();
    } catch (err) {
      console.error('Error deleting pump line:', err);
    }
  };

  const getLabParamValue = (lab: StatLabPanel, paramId: string): string => {
    if (lab.values && lab.values[paramId] !== undefined) {
      return lab.values[paramId];
    }
    const pid = (paramId || '').toLowerCase();
    switch (pid) {
      case 'wbc': return lab.cbc?.wbcCountKPerUl?.toString() || '';
      case 'hb': return lab.cbc?.hemoglobinGPerDl?.toString() || '';
      case 'hct': return lab.cbc?.hematocritPercent?.toString() || '';
      case 'plt': return lab.cbc?.plateletCountKPerUl?.toString() || '';
      case 'diff': return lab.cbc?.differential || '';
      case 'typeanemia': return lab.cbc?.typeAnemia || '';
      case 'inr': return lab.coagulation?.inr?.toString() || '';
      case 'pt': return lab.coagulation?.ptSeconds?.toString() || '';
      case 'ptt': return lab.coagulation?.pttSeconds?.toString() || '';
      case 'fib': return lab.coagulation?.fibrinogenMgPerDl?.toString() || '';
      case 'k': return lab.biochemistry?.potassiumMeqPerL?.toString() || '';
      case 'na': return lab.biochemistry?.sodiumMeqPerL?.toString() || '';
      case 'creat': return lab.biochemistry?.creatinineMgPerDl?.toString() || '';
      case 'bun': return lab.biochemistry?.bunMgPerDl?.toString() || '';
      case 'totalbili': return lab.biochemistry?.totalBilirubinMgPerDl?.toString() || '';
      case 'alb': return lab.biochemistry?.albuminGPerDl?.toString() || '';
      case 'procalc': return lab.biochemistry?.procalcitoninNgPerMl?.toString() || '';
      case 'crp': return lab.biochemistry?.crpMgPerL?.toString() || '';
      case 'ca': return lab.biochemistry?.calciumMeqPerL?.toString() || '';
      case 'phos': return lab.biochemistry?.phosphorusMeqPerL?.toString() || '';
      case 'mg': return lab.biochemistry?.magnesiumMeqPerL?.toString() || '';
      case 'alt': return lab.biochemistry?.altUPerL?.toString() || '';
      case 'ast': return lab.biochemistry?.astUPerL?.toString() || '';
      case 'alp': return lab.biochemistry?.alpUPerL?.toString() || '';
      case 'ggt': return lab.biochemistry?.ggtUPerL?.toString() || '';
      case 'amylase': return lab.biochemistry?.amylaseUPerL?.toString() || '';
      case 'lipase': return lab.biochemistry?.lipaseUPerL?.toString() || '';
      case 'troponin': return lab.biochemistry?.troponinNgPerMl?.toString() || '';
      case 'ck': return lab.biochemistry?.ckUPerL?.toString() || '';
      case 'ckmb': return lab.biochemistry?.ckMbUPerL?.toString() || '';
      case 'esr': return lab.biochemistry?.esrMmHr?.toString() || '';
      case 'urea': return lab.biochemistry?.ureaMgPerDl?.toString() || '';
      case 'uricacid': return lab.biochemistry?.uricAcidMgPerDl?.toString() || '';
      case 'ph': return lab.abg?.ph?.toString() || '';
      case 'pco2': return lab.abg?.pco2MmHg?.toString() || '';
      case 'po2': return lab.abg?.po2MmHg?.toString() || '';
      case 'hco3': return lab.abg?.hco3MmolPerL?.toString() || '';
      case 'be': return lab.abg?.baseExcessMmolPerL?.toString() || '';
      case 'lactate': return lab.abg?.lactateMmolPerL?.toString() || '';
      case 'pf': return lab.abg?.pao2Fio2Ratio?.toString() || '';
      default: return '';
    }
  };

  const handleOpenAddLabColumn = () => {
    setEditingLabId(null);
    const initialForm: Record<string, string> = {
      timestamp: new Date().toISOString().slice(0, 16)
    };
    settings.labCategories?.forEach((cat: any) => {
      cat.parameters?.forEach((p: any) => {
        initialForm[p.id] = '';
      });
    });
    setLabForm(initialForm as any);
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
    const editForm: Record<string, string> = {
      timestamp: lab.timestamp.slice(0, 16)
    };
    settings.labCategories?.forEach((cat: any) => {
      cat.parameters?.forEach((p: any) => {
        editForm[p.id] = getLabParamValue(lab, p.id);
      });
    });
    setLabForm(editForm as any);
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
        values: { ...labForm },
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
    if (!dispType) {
      alert(lang === 'ar' ? 'يرجى اختيار مسار إنهاء الإقامة أولاً.' : 'Please select a disposition pathway first.');
      return;
    }
    const currentUserName = currentUser ? (lang === 'ar' ? currentUser.nameAr || currentUser.nameEn : currentUser.nameEn || currentUser.nameAr) : 'Dr. Hesham Talaat';
    const finalPhysicianSign = useOtherConsultant ? otherConsultantName.trim() : currentUserName;
    if (useOtherConsultant && !otherConsultantName.trim()) {
      alert(lang === 'ar' ? 'يرجى إدخال اسم الطبيب الاستشاري المعتمد الآخر.' : 'Please enter the name of the other attending consultant.');
      return;
    }
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
          name: finalPhysicianSign,
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

      {/* Top Patient Header Banner Card (Clean minimal view, folded by default) */}
      <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-xl transition-all space-y-3">
        <div className="flex items-center justify-between gap-3">
          {/* Back Button, Bed Number, Patient Name & Age */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all flex-shrink-0 cursor-pointer"
              title={lang === 'ar' ? 'العودة لشبكة الأسِرّة' : 'Back to Bed Matrix'}
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Bed Number Indicator (Red if bed is isolated) */}
            <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center justify-center shadow-md flex-shrink-0 ${
              (bed.status === 'ISOLATION' || bed.isolation?.isIsolated)
                ? 'bg-red-950 text-red-500 border border-red-500/40 animate-pulse'
                : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
            }`}>
              {bed.bedNumber}
            </span>
 
            {/* Name, Age, Diagnosis Column */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-nowrap min-w-0">
                <h1 className="text-xs xs:text-sm sm:text-base md:text-lg font-black text-white truncate min-w-0 flex-shrink">
                  {patient.fullNameAr || patient.fullNameEn}
                </h1>
                {patient.age && (
                  <span className="text-[10px] sm:text-xs font-extrabold text-teal-300 font-mono bg-teal-950/90 px-1.5 py-0.5 rounded-lg border border-teal-800/80 shrink-0 whitespace-nowrap">
                    {patient.age} {lang === 'ar' ? 'سنة' : 'Y'}
                  </span>
                )}
              </div>
              {isPatientCardCollapsed && (
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1 leading-normal break-words">
                  <span className="text-slate-500">{lang === 'ar' ? 'التشخيص:' : 'Dx:'}</span>{' '}
                  <span className="text-teal-300 font-semibold">
                    {lang === 'ar' 
                      ? (patient.primaryDiagnosisAr || patient.primaryDiagnosisEn || '—') 
                      : (patient.primaryDiagnosisEn || patient.primaryDiagnosisAr || '—')}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Toggle Fold / Expand Button */}
          <button
            type="button"
            onClick={() => setIsPatientCardCollapsed(!isPatientCardCollapsed)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/60 transition-all cursor-pointer shrink-0"
            title={isPatientCardCollapsed ? (lang === 'ar' ? 'توسيع البطاقة' : 'Expand Card') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse Card')}
          >
            <span className="hidden sm:inline text-[11px] text-slate-400">
              {isPatientCardCollapsed ? (lang === 'ar' ? 'تفاصيل السرير' : 'Details') : (lang === 'ar' ? 'طي' : 'Collapse')}
            </span>
            {isPatientCardCollapsed ? (
              <ChevronDown className="w-4 h-4 text-teal-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-teal-400" />
            )}
          </button>
        </div>

        {/* Responsive Mobile-Friendly Shift Handover Buttons Row */}
        {settings.features.enableSbarHandover && (() => {
          const pendingSbar = sbarList.find(s => !s.incomingDoctor?.signedAt);
          return (
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap sm:flex-nowrap w-full">
              {/* Receive Shift Button */}
              {pendingSbar && (
                <button
                  onClick={() => {
                    setSelectedTemplateSbar(pendingSbar);
                    setIsBedsideSbarModalOpen(true);
                  }}
                  className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-lg shadow-amber-500/20 active:scale-98 cursor-pointer animate-pulse border border-amber-300"
                  title={lang === 'ar' ? 'استلام ومراجعة المناوبة الحالية' : 'Receive Pending Shift Handover'}
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-slate-950 shrink-0" />
                  <span className="truncate">
                    {lang === 'ar' 
                      ? `استلام مناوبة ${pendingSbar.shiftType === 'NIGHT' ? 'ليلية' : 'صباحية'}` 
                      : `Receive ${pendingSbar.shiftType === 'NIGHT' ? 'Night' : 'Day'} Shift`}
                  </span>
                </button>
              )}

              {/* Handover SBAR Sign Button */}
              <button
                onClick={onOpenSbarSign}
                className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-teal-500/20 active:scale-98 cursor-pointer"
                title={lang === 'ar' ? 'تسليم SBAR السريري' : 'SBAR Handover Sign'}
              >
                <ShieldCheck className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span>{lang === 'ar' ? 'تسليم SBAR' : 'SBAR Sign'}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black font-mono shadow-sm">
                  {sbarList.length}
                </span>
              </button>
            </div>
          );
        })()}

        {/* Expandable Details: Action Buttons (Hidden when collapsed) */}
        {!isPatientCardCollapsed && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 animate-in fade-in duration-200">
            {/* Action Buttons: Transfer, Swap, Isolation - Unified Row */}
            <div className="grid grid-cols-3 gap-1.5 w-full sm:flex sm:items-center sm:justify-end sm:gap-2">
              <button
                onClick={() => setIsTransferModalOpen(true)}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 px-1 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[10px] xs:text-[11px] sm:text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer text-center min-w-0"
                title={lang === 'ar' ? 'نقل المريض لسرير شاغر' : 'Transfer patient to vacant bed'}
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{lang === 'ar' ? 'نقل المريض' : 'Transfer'}</span>
              </button>

              <button
                onClick={() => setIsSwapModalOpen(true)}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 px-1 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] xs:text-[11px] sm:text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer text-center min-w-0"
                title={lang === 'ar' ? 'تبديل سريرين ومشغولين' : 'Swap beds'}
              >
                <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">{lang === 'ar' ? 'تبديل سريرين' : 'Swap Beds'}</span>
              </button>

              <button
                onClick={() => setIsIsolationModalOpen(true)}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 px-1 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] xs:text-[11px] sm:text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer text-center min-w-0"
                title={lang === 'ar' ? 'تدابير العزل وحالة السرير' : 'Manage bed status & isolation'}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{lang === 'ar' ? 'العزل والحالة' : 'Bed Status'}</span>
              </button>
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
              id: 'antibiotics', 
              label: lang === 'ar' ? `المضادات الحيوية (${antibioticsList.filter(a => a.status === 'ACTIVE').length})` : `Antibiotics & Regimens (${antibioticsList.filter(a => a.status === 'ACTIVE').length})`, 
              icon: Pill, 
              enabled: settings.features.enableAntibioticsCard !== false 
            },
            { 
              id: 'investigations', 
              label: lang === 'ar' ? `الفحوصات والأشعات (${investigations.length})` : `Radiology & Investigations (${investigations.length})`, 
              icon: Microscope, 
              enabled: true 
            },
            { 
              id: 'pumps', 
              label: lang === 'ar' ? 'مضخات المحاليل (Infusion Pumps)' : 'Infusion Pumps', 
              icon: Droplet, 
              enabled: settings.features.enableInfusionPumps 
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
          {/* Top Row: Patient Data Grid (Demographics first, then Clinical History/Diagnosis) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Demographics / Pt Data Box */}
            <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl flex flex-col justify-between lg:col-span-1">
              <div 
                onClick={() => setIsDemographicsCardCollapsed(!isDemographicsCardCollapsed)}
                className="border-b border-slate-800/80 pb-3 flex flex-col gap-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
              >
                {/* Header Row: Title & Action Controls */}
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-400 shrink-0" />
                    <h3 className="text-base font-bold text-white">
                      {lang === 'ar' ? 'بيانات المريض الأساسية' : 'Patient Demographics'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800 font-bold">
                      {bed.bedNumber}
                    </span>

                    {/* Edit Button - ONLY visible when expanded */}
                    {!isDemographicsCardCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditPatientModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                        title={lang === 'ar' ? 'تعديل كافة بيانات المريض' : 'Edit Demographics'}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-teal-400" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDemographicsCardCollapsed(!isDemographicsCardCollapsed);
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                      title={isDemographicsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
                    >
                      {isDemographicsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Sub-row: Risk Level & Admission Pathway - ALWAYS VISIBLE EVEN WHEN COLLAPSED ON A SINGLE ROW */}
                <div className="grid grid-cols-2 gap-1.5 w-full pt-0.5">
                  <span className={`px-2 py-1.5 rounded-lg font-bold border shadow-sm flex items-center justify-center gap-1 text-[9px] xs:text-[10px] sm:text-[11px] truncate ${getAcuityStyle(patient.acuityLevel)}`}>
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{lang === 'ar' ? `${getAcuityArLabel(patient.acuityLevel)}` : `${patient.acuityLevel}`}</span>
                  </span>

                  <span className="px-2 py-1.5 rounded-lg font-bold border shadow-sm flex items-center justify-center gap-1 text-[9px] xs:text-[10px] sm:text-[11px] bg-slate-900 text-cyan-300 border-cyan-800/80 truncate">
                    <ArrowRightLeft className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                    <span className="truncate">{lang === 'ar' ? `${getPathwayArLabel(patient.intakePathway)}` : `${patient.intakePathway}`}</span>
                  </span>
                </div>
              </div>

              {!isDemographicsCardCollapsed && (
                <>
                  <div className="grid grid-cols-2 gap-3 my-4 text-xs font-mono">
                    {/* Full Name */}
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800 col-span-2">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'الاسم كاملاً' : 'Full Name'}</div>
                      <div className="text-white font-bold mt-0.5 text-xs truncate">
                        {patient.fullNameAr || patient.fullNameEn}
                      </div>
                    </div>

                    {/* Medical Record Number (MRN) */}
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'رقم الملف الطبي (MRN)' : 'MRN / File No.'}</div>
                      <div className="text-teal-400 font-bold mt-0.5 font-mono text-xs">
                        {patient.mrn || '—'}
                      </div>
                    </div>

                    {/* Card ID / National ID */}
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'رقم البطاقة (الهوية)' : 'Card ID / National ID'}</div>
                      <div className="text-cyan-300 font-bold mt-0.5 font-mono text-xs">
                        {patient.nationalId || '—'}
                      </div>
                    </div>

                    {/* Age & Gender */}
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'السن والجنس' : 'Age & Gender'}</div>
                      <div className="text-white font-bold mt-0.5">
                        {patient.age} {lang === 'ar' ? 'سنة' : 'yo'} / {patient.gender === 'MALE' ? (lang === 'ar' ? 'ذكر' : 'Male') : patient.gender === 'FEMALE' ? (lang === 'ar' ? 'أنثى' : 'Female') : patient.gender}
                      </div>
                    </div>

                    {/* Blood Group */}
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'فصيلة الدم' : 'Blood Group'}</div>
                      <div className="text-amber-400 font-bold mt-0.5">
                        {patient.bloodType || (lang === 'ar' ? 'غير محدد' : 'N/A')}
                      </div>
                    </div>

                    {/* Height & Weight (without Ideal Weight) */}
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'الطول والوزن' : 'Height & Weight'}</div>
                      <div className="text-white font-bold mt-1 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">{lang === 'ar' ? 'الطول:' : 'H:'}</span>
                          <span className="text-cyan-300 font-mono">{patient.heightCm ? `${patient.heightCm}cm` : '170cm'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400">{lang === 'ar' ? 'الوزن:' : 'W:'}</span>
                          <span className="text-amber-300 font-mono">{patient.weightKg}kg</span>
                        </div>
                      </div>
                    </div>

                    {/* ICU Admission Date - side-by-side with H&W, numeric-formatted */}
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                      <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'تاريخ دخول العناية' : 'ICU Admission Date'}</div>
                      <div className="text-teal-400 font-bold mt-1 text-xs">
                        {formatNumericDate(patient.admissionDate)}
                      </div>
                    </div>
                  </div>

                  {/* Removed the synchronization warning alert block as requested */}
                </>
              )}
            </div>

            {/* History & Presenting Complaints Box (Diagnosis / Shakwa) */}
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsHistoryCardCollapsed(!isHistoryCardCollapsed);
                    }}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                    title={isHistoryCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
                  >
                    {isHistoryCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isHistoryCardCollapsed && (
                <>
                  {!isHistoryEditing && (
                    <div className="flex justify-end pb-1">
                      <button
                        type="button"
                        onClick={() => setIsHistoryEditing(true)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-slate-700"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تعديل البيانات' : 'Edit Info'}</span>
                      </button>
                    </div>
                  )}
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

                  <div className="pt-2 border-t border-slate-800/80">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">
                        {lang === 'ar' ? 'التشخيص الطبي الأساسي (Primary Diagnosis ICD-10)' : 'Primary Admitting Diagnosis (ICD-10)'}
                      </label>
                      <input
                        type="text"
                        value={primaryDiagnosisEnInput}
                        onChange={(e) => {
                          setPrimaryDiagnosisEnInput(e.target.value);
                          setPrimaryDiagnosisArInput(e.target.value);
                        }}
                        placeholder="e.g. Acute Respiratory Failure"
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
          </div>
        </div>
      )}

      {/* Tab 1: Continuous Vitals & Telemetry (Top Section after Patient Data) */}
      {(activeTab === 'vitals' || activeTab === 'all' || activeTab === 'paperFlowsheet') && (
        <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperVitalsCardCollapsed(!isPaperVitalsCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <Activity className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'العلامات الحيوية' : 'Vital Signs'}
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {vitalsHistory.length}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperVitalsCardCollapsed(!isPaperVitalsCardCollapsed);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs"
                title={isPaperVitalsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {isPaperVitalsCardCollapsed ? (lang === 'ar' ? 'عرض السجل' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}
                </span>
                {isPaperVitalsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperVitalsCardCollapsed && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {latestVitals && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {/* Blood Pressure (BP) replacing MAP */}
                  <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">BP</span>
                    <span className={`text-sm font-extrabold font-mono ${
                      latestVitals.meanArterialPressureMmHg < 65 ? 'text-red-400 animate-pulse font-black' : 'text-cyan-300'
                    }`}>
                      {latestVitals.systolicBpMmHg}/{latestVitals.diastolicBpMmHg}
                    </span>
                  </div>

                  {/* Heart Rate (HR) */}
                  <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">HR</span>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-400 font-mono">
                      {latestVitals.heartRateBpm} <span className="text-[10px] text-slate-500 font-bold">bpm</span>
                    </span>
                  </div>

                  {/* SpO2 */}
                  <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">SpO₂</span>
                    <span className="text-sm font-extrabold text-teal-300 font-mono flex items-center gap-1">
                      <span>{latestVitals.spo2Percent}%</span>
                      <span className="text-[10px] text-slate-500 font-normal">({latestVitals.fio2SuppliedPercent}% Fi)</span>
                    </span>
                  </div>

                  {/* Core Temp */}
                  <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Temp</span>
                    <span className="text-sm font-extrabold text-amber-300 font-mono flex items-center gap-1">
                      <span>{latestVitals.coreTemperatureCelsius}°C</span>
                      <span className="text-[10px] text-slate-500 font-normal">({latestVitals.temperatureSite})</span>
                    </span>
                  </div>

                  {/* GCS & RASS */}
                  <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">GCS</span>
                    <span className="text-sm font-extrabold text-indigo-300 font-mono flex items-center gap-1">
                      <span>{latestVitals.gcsTotalScore}/15</span>
                      <span className="text-[10px] text-slate-500 font-normal">({latestVitals.sedationRassScore ?? 'N/A'} R)</span>
                    </span>
                  </div>

                  {/* CVP & Glucose */}
                  <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors animate-in fade-in">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">CVP</span>
                    <span className="text-sm font-extrabold text-blue-400 font-mono flex items-center gap-1">
                      <span>{latestVitals.cvpMmHg !== undefined && latestVitals.cvpMmHg !== null ? `${latestVitals.cvpMmHg} mmHg` : '—'}</span>
                      <span className="text-[10px] text-slate-500 font-normal">({latestVitals.bloodGlucoseMgDl ?? '—'} G)</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Historical Feed Table (Flattened - No nested cards) */}
              <div className="pt-4 border-t border-slate-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-400" />
                    <span>{lang === 'ar' ? 'سجل العلامات الحيوية التاريخية (Telemetry Trajectory)' : 'Telemetry History Trajectory'}</span>
                  </h3>
                  <button
                    onClick={onOpenAddVitals}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 text-xs font-bold cursor-pointer hover:bg-teal-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة قراءة جديدة' : 'Add Reading'}</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className={`w-full text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono">
                        <th className="py-2 px-3">{lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}</th>
                        <th className="py-2 px-3">BP (Sys/Dia)</th>
                        <th className="py-2 px-3">HR (bpm)</th>
                        <th className="py-2 px-3">SpO₂ (%)</th>
                        <th className="py-2 px-3">RR (cpm)</th>
                        <th className="py-2 px-3">{lang === 'ar' ? 'الضغط الوريدي CVP' : 'CVP'}</th>
                        <th className="py-2 px-3">{lang === 'ar' ? 'المسجل والتعديل' : 'Staff / Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {(showAllVitals ? vitalsHistory : vitalsHistory.slice(0, 4)).map((v) => {
                        const d = new Date(v.timestamp);
                        const dateStr = formatNumericDate(d);
                        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                        return (
                          <tr key={v.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-200">{dateStr}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{timeStr}</span>
                              </div>
                            </td>
                            <td className={`py-2.5 px-3 text-white font-bold ${v.meanArterialPressureMmHg < 65 ? 'text-red-400 animate-pulse font-black' : ''}`}>
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
                            <td className="py-2.5 px-3 text-blue-400">
                              {v.cvpMmHg !== undefined && v.cvpMmHg !== null ? `${v.cvpMmHg} mmHg` : '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400 text-[11px] font-sans truncate max-w-[110px]">
                                  {v.recordedBy?.name || (lang === 'ar' ? 'الكادر الطبي' : 'Staff')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedVitalForEdit(v);
                                    setIsEditVitalsModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                                  title={lang === 'ar' ? 'تعديل القراءة الحيوية' : 'Edit vital reading'}
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {vitalsHistory.length > 4 && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAllVitals(!showAllVitals)}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-teal-300 font-bold text-xs border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <span>
                        {showAllVitals 
                          ? (lang === 'ar' ? 'عرض أقل' : 'Show Less') 
                          : (lang === 'ar' ? `عرض المزيد (${vitalsHistory.length - 4} سجلات إضافية)` : `Show More (${vitalsHistory.length - 4} more records)`)}
                      </span>
                      {showAllVitals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'paperFlowsheet' && (
        <div className="space-y-4 animate-in fade-in duration-300">
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaperLabsCardCollapsed(!isPaperLabsCardCollapsed);
                  }}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                  title={isPaperLabsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
                >
                  {isPaperLabsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isPaperLabsCardCollapsed && (
              <>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">
                      {labsList.length} {lang === 'ar' ? 'أعمدة مسجلة' : 'Recorded Columns'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {settings.features.enableAiLabScanner && (
                      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setAiScannerPreset('ALL');
                            setIsAiLabScannerOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0 cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span className="hidden sm:inline">{lang === 'ar' ? 'تصوير تحليل' : 'AI Scan'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAiScannerPreset('ABG');
                            setIsAiLabScannerOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[11px] font-bold transition-all border border-emerald-500/30 cursor-pointer"
                        >
                          🫁 {lang === 'ar' ? 'غازات ABG' : 'ABG'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAiScannerPreset('CBC');
                            setIsAiLabScannerOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 text-[11px] font-bold transition-all border border-teal-500/30 cursor-pointer"
                        >
                          🩸 {lang === 'ar' ? 'صورة CBC' : 'CBC'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAiScannerPreset('CHEMISTRY');
                            setIsAiLabScannerOpen(true);
                          }}
                          className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[11px] font-bold transition-all border border-cyan-500/30 cursor-pointer"
                        >
                          🧪 {lang === 'ar' ? 'كيمياء وأملاح' : 'Chemistry'}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleOpenAddLabColumn}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'إضافة عمود تحاليل' : 'Add Column'}</span>
                    </button>
                  </div>
                </div>

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
                              {new Date(lab.timestamp).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(lab.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
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
                      <div>
                        <h3 className="text-sm font-bold text-white">{lang === 'ar' ? 'جهاز التنفس الصناعي' : 'Ventilator'}</h3>
                        {isPaperVentCardCollapsed && ventilator && (
                          <div className="text-[10px] text-cyan-400 font-bold font-mono mt-0.5">
                            {lang === 'ar' ? `النمط: ${ventilator.mode}` : `Mode: ${ventilator.mode}`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {ventilator && (
                        <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[10px] font-bold">
                          {ventilator.mode}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPaperVentCardCollapsed(!isPaperVentCardCollapsed);
                        }}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                        title={isPaperVentCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
                      >
                        {isPaperVentCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {!isPaperVentCardCollapsed && (
                    <>
                      {ventilator ? (
                        <div className="mt-3 space-y-2.5">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setIsVentilatorModalOpen(true)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{lang === 'ar' ? 'تعديل إعدادات التنفس' : 'Edit Parameters'}</span>
                            </button>
                          </div>
                          
                          {/* Compact High-Contrast Parameter Boxes */}
                          <div 
                            onClick={() => setIsVentilatorModalOpen(true)}
                            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono cursor-pointer hover:opacity-90 transition-opacity"
                          >
                            <div className="bg-[#070c18] px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-bold">FiO₂</span>
                              <span className="text-xs text-teal-300 font-bold">{ventilator.fio2Percent}%</span>
                            </div>
                            <div className="bg-[#070c18] px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-bold">PEEP</span>
                              <span className="text-xs text-cyan-300 font-bold">{ventilator.peepCmH2O}</span>
                            </div>
                            <div className="bg-[#070c18] px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-bold">(VT)</span>
                              <span className="text-xs text-white font-bold">{ventilator.tidalVolumeMl || ventilator.setTidalVolumeMl}</span>
                            </div>
                            <div className="bg-[#070c18] px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between">
                              <span className="text-[10px] text-slate-500 font-bold">(RR)</span>
                              <span className="text-xs text-slate-200 font-bold">{ventilator.setRespiratoryRateCpm}</span>
                            </div>
                          </div>

                          {/* Ventilator Modification Log (سجل تعديلات جهاز التنفس) */}
                          <div className="mt-3 border-t border-slate-800/80 pt-2.5">
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold mb-1.5">
                              <span>{lang === 'ar' ? 'سجل التعديلات والأنماط' : 'Modifications Log'}</span>
                              <span className="text-[9px] bg-slate-900 px-1 rounded text-cyan-400">
                                {ventilator.history ? ventilator.history.length : 1} {lang === 'ar' ? 'تعديل' : 'edits'}
                              </span>
                            </div>

                            <div className="space-y-1 font-mono text-[10px]">
                              {ventilator.history && ventilator.history.length > 0 ? (
                                ventilator.history
                                  .slice()
                                  .reverse()
                                  .slice(0, isVentHistoryExpanded ? undefined : 4)
                                  .map((entry, idx) => (
                                    <div 
                                      key={entry.id || idx}
                                      className="flex items-center justify-between gap-1.5 py-1 px-2 rounded bg-[#070c18] border border-slate-800/60 hover:bg-slate-900 transition-colors"
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-cyan-400 font-bold bg-cyan-950/40 px-1 rounded">
                                          {entry.mode}
                                        </span>
                                        <span className="text-slate-400 truncate max-w-[80px]" title={entry.recordedByStaffName}>
                                          {entry.recordedByStaffName}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 text-slate-500 text-[9px]">
                                        <span>FIO₂:{entry.fio2Percent}%</span>
                                        <span>PEEP:{entry.peepCmH2O}</span>
                                        <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                      </div>
                                    </div>
                                  ))
                              ) : (
                                <div className="flex items-center justify-between gap-1.5 py-1 px-2 rounded bg-[#070c18] border border-slate-800/60">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-cyan-400 font-bold bg-cyan-950/40 px-1 rounded">
                                      {ventilator.mode}
                                    </span>
                                    <span className="text-slate-400 truncate max-w-[80px]">
                                      {ventilator.recordedByStaffName}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 text-slate-500 text-[9px]">
                                    <span>FIO₂:{ventilator.fio2Percent}%</span>
                                    <span>PEEP:{ventilator.peepCmH2O}</span>
                                    <span>{new Date(ventilator.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {ventilator.history && ventilator.history.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setIsVentHistoryExpanded(!isVentHistoryExpanded)}
                                className="mt-2 w-full text-center py-1 rounded bg-slate-900 hover:bg-slate-800 text-[9px] text-slate-400 font-bold hover:text-white transition-all cursor-pointer"
                              >
                                {isVentHistoryExpanded 
                                  ? (lang === 'ar' ? 'إظهار أقل' : 'Show Less') 
                                  : (lang === 'ar' ? 'إظهار المزيد من السجلات' : 'Show More Logs')}
                              </button>
                            )}
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
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800 font-bold">
                        {pumps.length} {lang === 'ar' ? 'نشط' : 'active'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPaperPumpsCardCollapsed(!isPaperPumpsCardCollapsed);
                        }}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                        title={isPaperPumpsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
                      >
                        {isPaperPumpsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {!isPaperPumpsCardCollapsed && (
                    <>
                      <div className="flex items-center justify-between mt-2.5 mb-2 pb-1 border-b border-slate-800/60">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {pumps.length} {lang === 'ar' ? 'مضخات مضافة' : 'Infusion lines'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPumpForEdit(null);
                            setIsPumpModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                          title={lang === 'ar' ? 'إضافة مضخة أو خط تنقيط وريدي جديد' : 'Add Infusion Pump Line'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'إضافة مضخة' : 'Add Pump'}</span>
                        </button>
                      </div>

                      {pumps.length > 0 ? (
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto">
                          {pumps.map(p => (
                            <div 
                              key={p.id} 
                              className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800 space-y-2 hover:border-amber-500/40 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-white text-xs font-mono truncate">{p.drugNameEn}</span>
                                  </div>
                                  <div className="text-[9px] text-slate-400 mt-0.5">
                                    {p.diluentFluid || p.solutionCarrier} {p.concentrationMgPerMl ? `(${p.concentrationMgPerMl}mg/mL)` : ''}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePumpStatus(p)}
                                    className={`p-1 rounded text-xs transition-colors cursor-pointer ${
                                      p.status === PumpStatus.RUNNING 
                                        ? 'text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/60' 
                                        : 'text-amber-400 bg-amber-950/60 hover:bg-amber-900/60'
                                    }`}
                                    title={p.status === PumpStatus.RUNNING ? (lang === 'ar' ? 'إيقاف مؤقت' : 'Pause') : (lang === 'ar' ? 'استئناف' : 'Resume')}
                                  >
                                    {p.status === PumpStatus.RUNNING ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedPumpForEdit(p);
                                      setIsPumpModalOpen(true);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                    title={lang === 'ar' ? 'تعديل كامل البيانات' : 'Edit Details'}
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeletePumpLine(p)}
                                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                                    title={lang === 'ar' ? 'إيقاف وحذف المحلول' : 'Discontinue & Delete'}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Rate titration row */}
                              <div className="bg-[#0a101f] p-2 rounded-lg flex items-center justify-between font-mono text-xs">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleTitratePump(p, 'DOWN')}
                                    className="p-1 rounded bg-slate-800 hover:bg-red-950 text-slate-300 hover:text-red-300 border border-slate-700 cursor-pointer active:scale-95"
                                    title={lang === 'ar' ? 'إنقاص الجرعة' : 'Decrease rate'}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>

                                  <div className="text-center min-w-[65px]">
                                    <span className="text-amber-300 font-black text-sm">{p.currentRate}</span>
                                    <span className="text-[9px] text-slate-400 ml-1">{p.rateUnit}</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleTitratePump(p, 'UP')}
                                    className="p-1 rounded bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-700 cursor-pointer active:scale-95"
                                    title={lang === 'ar' ? 'زيادة الجرعة' : 'Increase rate'}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="text-right text-[10px] text-slate-400">
                                  <span>{p.flowRateMlPerHour} mL/h</span>
                                </div>
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
                          setIsPaperFluidsCardCollapsed(!isPaperFluidsCardCollapsed);
                        }}
                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                        title={isPaperFluidsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
                      >
                        {isPaperFluidsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {!isPaperFluidsCardCollapsed && (
                    <>
                      {fluidBalance ? (() => {
                        const netVal = fluidBalance.netCumulativeBalanceMl ?? (fluidBalance as any).netBalance24HMl ?? 0;
                        const totalIntake = fluidBalance.intakeBreakdown?.totalIntakeMl ?? (fluidBalance as any).totalIntakeMl ?? 0;
                        const totalOutput = fluidBalance.outputBreakdown?.totalOutputMl ?? (fluidBalance as any).totalOutputMl ?? 0;
                        const urineVal = fluidBalance.outputBreakdown?.urineOutputMl ?? (fluidBalance as any).outputBreakdown?.urineMl ?? 0;
                        return (
                          <div className="mt-3 space-y-2.5">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFluidBalanceForEdit(fluidBalance);
                                  setIsFluidModalOpen(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all cursor-pointer"
                                title={lang === 'ar' ? 'تعديل ميزان السوائل الحالي' : 'Edit Current 24H Balance'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'تعديل ميزان السوائل' : 'Edit Balance'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFluidBalanceForEdit(null);
                                  setIsFluidModalOpen(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-sm"
                                title={lang === 'ar' ? 'إضافة ميزان سوائل ليوم جديد أو لاحق' : 'Add Fluid Balance for Next / New Day'}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'إضافة يوم' : 'Add Day'}</span>
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                              <div className="bg-[#070c18] p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                                <div className="text-[9px] text-cyan-400 font-bold truncate">{lang === 'ar' ? 'الوارد (IN)' : 'Intake (IN)'}</div>
                                <div className="text-cyan-300 font-bold mt-0.5 truncate">{totalIntake} <span className="text-[8px] text-slate-400">mL</span></div>
                              </div>
                              <div className="bg-[#070c18] p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                                <div className="text-[9px] text-amber-400 font-bold truncate">{lang === 'ar' ? 'الصادر (OUT)' : 'Output (OUT)'}</div>
                                <div className="text-amber-400 font-bold mt-0.5 truncate">{totalOutput} <span className="text-[8px] text-slate-400">mL</span></div>
                              </div>
                              <div className="bg-[#070c18] p-2 rounded-xl border border-slate-800 flex flex-col justify-between">
                                <div className="text-[9px] text-indigo-400 font-bold truncate">{lang === 'ar' ? 'الصافي (NET)' : 'Net (NET)'}</div>
                                <div className={`font-bold mt-0.5 truncate ${netVal >= 0 ? 'text-indigo-300' : 'text-emerald-300'}`}>
                                  {netVal > 0 ? `+${netVal}` : netVal} <span className="text-[8px] text-slate-400">mL</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="p-6 text-center text-xs text-slate-400 bg-[#070c18] rounded-xl border border-slate-800/80 mt-3 space-y-2">
                          <p>{lang === 'ar' ? 'لم يسجل ميزان السوائل لليوم.' : 'No fluid balance records for today.'}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFluidBalanceForEdit(null);
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
                    {settings.features.enableAiLabScanner && (
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

                  {/* Panel Selection Filter Tabs */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedModalCatId('all')}
                        className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                          selectedModalCatId === 'all'
                            ? 'bg-teal-500 text-slate-950 shadow-md'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {lang === 'ar' ? 'الكل (جميع الصناديق)' : 'All Panels'}
                      </button>
                      {settings.labCategories?.map((cat: any) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedModalCatId(cat.id)}
                          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                            selectedModalCatId === cat.id
                              ? 'bg-teal-500 text-slate-950 shadow-md'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {lang === 'ar' ? cat.nameAr : cat.nameEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`grid gap-4 overflow-y-auto max-h-[420px] pr-2 ${
                    selectedModalCatId === 'all' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'
                  }`}>
                    {settings.labCategories
                      ?.filter((cat: any) => selectedModalCatId === 'all' || cat.id === selectedModalCatId)
                      ?.map((cat: any) => (
                      <div key={cat.id} className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="text-xs font-extrabold text-teal-400 uppercase font-mono flex items-center gap-1.5">
                            <FlaskConical className="w-3.5 h-3.5 text-teal-400" />
                            <span>{lang === 'ar' ? cat.nameAr : cat.nameEn}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({lang === 'ar' ? cat.nameEn : cat.nameAr})
                            </span>
                          </div>
                          {settings.features.enableAiLabScanner && (cat.id === 'cbc' || cat.id === 'abg') && (
                            <button
                              type="button"
                              onClick={() => {
                                setAiScannerPreset(cat.id === 'cbc' ? 'CBC' : 'ABG');
                                setIsAiLabScannerOpen(true);
                              }}
                              className="px-2 py-0.5 rounded-md bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Camera className="w-3 h-3 text-teal-400" />
                              <span>{lang === 'ar' ? `تصوير ${cat.id.toUpperCase()}` : `Scan ${cat.id.toUpperCase()}`}</span>
                            </button>
                          )}
                        </div>
                        <div className="space-y-2.5">
                          {cat.parameters?.map((p: any) => {
                            const isText = p.id === 'diff' || p.id === 'typeanemia' || p.id.includes('type') || p.id.includes('diff');
                            return (
                              <div key={p.id}>
                                <label className="text-slate-400 mb-1 block font-semibold flex justify-between items-center text-[10px] sm:text-[11px]">
                                  <span>{p.name} {p.unit ? `(${p.unit})` : ''}</span>
                                  <span className="text-[9px] text-slate-500 font-mono font-normal">Normal: {p.normalRange}</span>
                                </label>
                                <input
                                  type="text"
                                  inputMode={isText ? undefined : "decimal"}
                                  value={(labForm as any)[p.id] || ''}
                                  onChange={e => setLabForm({ ...labForm, [p.id]: e.target.value })}
                                  className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-2 text-white text-xs font-mono focus:border-teal-500 focus:outline-none"
                                />
                              </div>
                            );
                          })}
                          {cat.parameters?.length === 0 && (
                            <div className="text-center py-4 text-slate-500 text-xs italic">
                              {lang === 'ar' ? 'لا توجد تحاليل مضافة في هذا الصندوق.' : 'No tests added to this panel.'}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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

      {/* Tab: Daily Lab Flowsheet with Interactive Trend History (HG 5 > 7 > 8.5 > 8) */}
      {(activeTab === 'labs' || activeTab === 'all') && (
        <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperLabsCardCollapsed(!isPaperLabsCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'سجل التحاليل' : 'Labs Record'}
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {new Set(labResults.map(l => (l.testName || '').trim().toLowerCase())).size}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperLabsCardCollapsed(!isPaperLabsCardCollapsed);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs"
                title={isPaperLabsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {isPaperLabsCardCollapsed ? (lang === 'ar' ? 'عرض السجل' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}
                </span>
                {isPaperLabsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperLabsCardCollapsed && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <LabFlowsheetSection
                patientId={patient.id}
                bedNumber={bed.bedNumber}
                labResults={labResults}
                onLabAdded={() => {
                  loadBedsideData();
                  onDataUpdated();
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab: Patient Antibiotics & Antimicrobial Therapy (Rendered right after Labs card) */}
      {(activeTab === 'antibiotics' || activeTab === 'all') && (cardsConfig.showAntibioticsCard !== false) && (settings.features.enableAntibioticsCard !== false) && (
        <AntibioticsSection
          patient={patient}
          bed={bed}
          settings={settings}
          antibiotics={antibioticsList}
          currentUser={currentUser}
          onDataUpdated={() => {
            loadBedsideData();
            onDataUpdated();
          }}
        />
      )}

      {/* Tab: Investigations, Radiology & POCUS Studies */}
      {(activeTab === 'investigations' || activeTab === 'all') && (
        <div id="patient-investigations-card" className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperInvestigationsCardCollapsed(!isPaperInvestigationsCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <Scan className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'الفحوصات والأشعة' : 'Investigations & Radiology'}
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {investigations.filter(i => i.patientId === patient.id).length}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperInvestigationsCardCollapsed(!isPaperInvestigationsCardCollapsed);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs"
                title={isPaperInvestigationsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {isPaperInvestigationsCardCollapsed ? (lang === 'ar' ? 'عرض السجل' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}
                </span>
                {isPaperInvestigationsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperInvestigationsCardCollapsed && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <InvestigationsSection
                patientId={patient.id}
                bedNumber={bed.bedNumber}
                investigations={investigations}
                onInvestigationAdded={() => {
                  loadBedsideData();
                  onDataUpdated();
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Infusion Pumps */}
      {(activeTab === 'pumps' || activeTab === 'all') && (
        <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperPumpsCardCollapsed(!isPaperPumpsCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2">
              <Droplet className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">
                {lang === 'ar' ? 'مضخات الحقن الوريدي المتواصل (Alaris Smart Pumps)' : 'Vasoactive Continuous Infusion Lines'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                {pumps.length} {lang === 'ar' ? 'قنوات نشطة' : 'Active Channels'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperPumpsCardCollapsed(!isPaperPumpsCardCollapsed);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                title={isPaperPumpsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                {isPaperPumpsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperPumpsCardCollapsed && (
            <div className="space-y-3 animate-in fade-in duration-300">
              {/* Top Action Toolbar inside expanded card */}
              <div className="flex items-center justify-between bg-[#070c18] p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-300 font-mono">
                  {pumps.length} {lang === 'ar' ? 'مضخات مسجلة' : 'Registered Infusion Pump Lines'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPumpForEdit(null);
                    setIsPumpModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 cursor-pointer"
                  title={lang === 'ar' ? 'إضافة مضخة أو خط تنقيط وريدي جديد' : 'Add Infusion Pump Line'}
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'إضافة مضخة وريدية جديدة' : 'Add Infusion Pump Channel'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pumps.length > 0 ? pumps.map((pump) => (
                  <div 
                    key={pump.id}
                    className="bg-[#070c18] border border-slate-800 p-4 rounded-xl space-y-3 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white mt-1">
                          {pump.drugNameEn}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {lang === 'ar' 
                            ? `التركيز: ${pump.concentrationMgPerMl} mg/mL • المحلول: ${pump.diluentFluid || pump.solutionCarrier}` 
                            : `Concentration: ${pump.concentrationMgPerMl} mg/mL • Diluent: ${pump.diluentFluid || pump.solutionCarrier}`}
                        </p>
                      </div>
                    </div>

                    {/* Rate & Volume display */}
                    <div className="bg-[#0a101f] p-3 rounded-lg flex items-center justify-between font-mono">
                      <div>
                        <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'معدل التدفق (Current Rate)' : 'Current Rate'}</div>
                        <div className="text-lg font-black text-amber-300">
                          {pump.currentRate} <span className="text-xs text-slate-400">{pump.rateUnit}</span>
                        </div>
                      </div>

                      <div className={isRTL ? 'text-right' : 'text-left'}>
                        <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'معدل الضخ (Flow Rate)' : 'Flow Rate'}</div>
                        <div className="text-sm font-bold text-slate-200">
                          {pump.flowRateMlPerHour} mL/h
                        </div>
                      </div>
                    </div>

                    {/* Rate Titration Controls: Increase / Decrease */}
                    <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-300">
                        {lang === 'ar' ? 'معايرة الجرعة السريعة:' : 'Quick Titration:'}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTitratePump(pump, 'DOWN')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-red-950 text-slate-200 hover:text-red-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
                          title={lang === 'ar' ? 'إنقاص معدل الضخ' : 'Titrate Down'}
                        >
                          <Minus className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'إنقاص' : 'Down'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTitratePump(pump, 'UP')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-950 text-slate-200 hover:text-emerald-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
                          title={lang === 'ar' ? 'زيادة معدل الضخ' : 'Titrate Up'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'رفع الجرعة' : 'Up'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Target Parameter */}
                    <div className="text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">{lang === 'ar' ? 'هدف المعايرة:' : 'Titration Target:'}</span> {pump.targetParameter || 'Maintain MAP ≥ 65 mmHg'}
                    </div>

                    {/* Action Bar for Pump: Pause/Resume, Full Edit, Discontinue & Delete */}
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePumpStatus(pump)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            pump.status === PumpStatus.RUNNING 
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40' 
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {pump.status === PumpStatus.RUNNING ? (
                            <>
                              <Pause className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" />
                              <span>{lang === 'ar' ? 'استئناف' : 'Resume'}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPumpForEdit(pump);
                            setIsPumpModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{lang === 'ar' ? 'تعديل المعايير' : 'Edit Rate'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePumpLine(pump)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-colors cursor-pointer"
                        title={lang === 'ar' ? 'إيقاف وحذف المحلول الوريدي' : 'Discontinue and remove line'}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'إيقاف واستغناء' : 'Discontinue'}</span>
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-2 p-6 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800 space-y-3">
                    <div>{lang === 'ar' ? 'لا توجد قنوات حقن وريدي نشطة حالياً.' : 'No active continuous infusion channels currently.'}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPumpForEdit(null);
                        setIsPumpModalOpen(true);
                        setIsPaperPumpsCardCollapsed(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'إضافة مضخة وريدية جديدة' : 'Add New Infusion Pump Channel'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Ventilator & ABG */}
      {(activeTab === 'vent' || activeTab === 'all') && (
        <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperVentCardCollapsed(!isPaperVentCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/44 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'إعدادات جهاز التنفس الصناعي والغازات (Ventilator & ABG)' : 'Mechanical Ventilator & ABG Settings'}
                </h3>
                {ventilator && (
                  <div className="text-xs text-cyan-400 font-bold font-mono mt-0.5">
                    {lang === 'ar' ? `النمط الحالي: ${ventilator.mode}` : `Current Mode: ${ventilator.mode}`}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperVentCardCollapsed(!isPaperVentCardCollapsed);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                title={isPaperVentCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                {isPaperVentCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperVentCardCollapsed && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {ventilator ? (
                <div className="space-y-4">
                  {/* Action Toolbar inside expanded card */}
                  <div className="flex items-center justify-between bg-[#070c18] p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-xs text-cyan-300 font-mono font-bold">
                      MODE: {ventilator.mode}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsVentilatorModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 cursor-pointer"
                      title={lang === 'ar' ? 'تعديل أو ضبط إعدادات جهاز التنفس' : 'Adjust Ventilator Settings'}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تعديل إعدادات التنفس' : 'Edit Ventilator Settings'}</span>
                    </button>
                  </div>

                  {/* Compact High-Contrast Parameter Boxes */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                    <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">FiO₂</span>
                      <span className="text-sm font-extrabold text-teal-300">{ventilator.fio2Percent}%</span>
                    </div>

                    <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">PEEP</span>
                      <span className="text-sm font-extrabold text-cyan-300">
                        {ventilator.peepCmH2O} <span className="text-[10px] text-slate-500 font-bold">cmH₂O</span>
                      </span>
                    </div>

                    <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">(VT)</span>
                      <span className="text-sm font-extrabold text-white flex items-center gap-1">
                        <span>{ventilator.tidalVolumeMl || ventilator.setTidalVolumeMl}</span>
                        <span className="text-[10px] text-slate-500 font-bold">mL</span>
                        <span className="text-[10px] text-teal-400 font-sans font-bold">
                          ({Math.round((ventilator.setTidalVolumeMl || ventilator.tidalVolumeMl || 420) / (patient.idealBodyWeightKg || (patient.gender === 'MALE' ? 70 : 60) || 70))}/kg)
                        </span>
                      </span>
                    </div>

                    <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">(RR)</span>
                      <span className="text-sm font-extrabold text-slate-200">
                        {ventilator.setRespiratoryRateCpm} <span className="text-[10px] text-slate-500 font-bold">bpm</span>
                      </span>
                    </div>

                    <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">(PIP)</span>
                      <span className="text-sm font-extrabold text-amber-300">
                        {ventilator.peakInspiratoryPressureCmH2O ?? '—'} <span className="text-[10px] text-slate-500 font-bold">cmH₂O</span>
                      </span>
                    </div>

                    <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">(Pplat)</span>
                      <span className="text-sm font-extrabold text-indigo-300">
                        {ventilator.plateauPressureCmH2O ?? '—'} <span className="text-[10px] text-slate-500 font-bold">cmH₂O</span>
                      </span>
                    </div>

                    <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">(DP)</span>
                      <span className={`text-sm font-extrabold ${
                        drivingPressure && drivingPressure > 14 ? 'text-red-400 font-black' : 'text-emerald-400'
                      }`}>
                        {drivingPressure ?? '—'} <span className="text-[10px] text-slate-500 font-bold">cmH₂O</span>
                      </span>
                    </div>

                    <div className="bg-[#070c18] px-3 py-2 rounded-xl border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">(P/F)</span>
                      <span className={`text-sm font-extrabold ${
                        ventilator.pao2Fio2Ratio && ventilator.pao2Fio2Ratio < 200 ? 'text-red-400 font-black' : 'text-emerald-400'
                      }`}>
                        {ventilator.pao2Fio2Ratio ?? '—'}
                      </span>
                    </div>
                  </div>

                  {/* Ventilator Modification Log (سجل تعديلات جهاز التنفس) */}
                  <div className="mt-4 border-t border-slate-800/80 pt-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                      <span>{lang === 'ar' ? 'سجل تعديلات جهاز التنفس ومودات التشغيل' : 'Ventilator Modifications & History Log'}</span>
                      <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-cyan-400">
                        {ventilator.history ? ventilator.history.length : 1} {lang === 'ar' ? 'تعديل' : 'edits'}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-xs">
                      {ventilator.history && ventilator.history.length > 0 ? (
                        ventilator.history
                          .slice()
                          .reverse()
                          .slice(0, isVentHistoryExpanded ? undefined : 4)
                          .map((entry, idx) => (
                            <div 
                              key={entry.id || idx}
                              className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-lg bg-[#070c18] border border-slate-800 hover:bg-slate-900 transition-colors text-[11px]"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-cyan-400 font-bold bg-cyan-950/40 px-1.5 py-0.5 rounded text-[10px]">
                                  {entry.mode}
                                </span>
                                <span className="text-slate-300 truncate max-w-[120px]" title={entry.recordedByStaffName}>
                                  {entry.recordedByStaffName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-slate-400 text-[10px]">
                                <span className="text-teal-300">FiO₂ {entry.fio2Percent}%</span>
                                <span className="text-cyan-300">PEEP {entry.peepCmH2O}</span>
                                <span className="text-white">(VT) {entry.tidalVolumeMl}</span>
                                <span className="text-slate-500 font-sans">{new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-lg bg-[#070c18] border border-slate-800 text-[11px]">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-cyan-400 font-bold bg-cyan-950/40 px-1.5 py-0.5 rounded text-[10px]">
                              {ventilator.mode}
                            </span>
                            <span className="text-slate-300 truncate max-w-[120px]">
                              {ventilator.recordedByStaffName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-slate-400 text-[10px]">
                            <span className="text-teal-300">FiO₂ {ventilator.fio2Percent}%</span>
                            <span className="text-cyan-300">PEEP {ventilator.peepCmH2O}</span>
                            <span className="text-white">(VT) {ventilator.tidalVolumeMl || ventilator.setTidalVolumeMl}</span>
                            <span className="text-slate-500 font-sans">{new Date(ventilator.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {ventilator.history && ventilator.history.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setIsVentHistoryExpanded(!isVentHistoryExpanded)}
                        className="mt-2.5 w-full text-center py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-400 font-bold hover:text-white transition-all cursor-pointer border border-slate-800"
                      >
                        {isVentHistoryExpanded 
                          ? (lang === 'ar' ? 'إظهار أقل' : 'Show Less') 
                          : (lang === 'ar' ? 'إظهار المزيد من السجلات' : 'Show More Logs')}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800 space-y-3">
                  <div>
                    {lang === 'ar' 
                      ? 'المريض يتنفس تلقائياً بدون جهاز تنفس صناعي جائر (Spontaneous Breathing).'
                      : 'Patient is spontaneously breathing (Room Air / High-Flow Nasal Cannula / Mask).'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVentilatorModalOpen(true);
                      setIsPaperVentCardCollapsed(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'ربط / تسجيل جهاز تنفس صناعي' : 'Connect / Record Ventilator Settings'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Fluids & MTP */}
      {(activeTab === 'fluids' || activeTab === 'all') && (
        <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperFluidsCardCollapsed(!isPaperFluidsCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-teal-400" />
              <h3 className="text-base font-bold text-white">
                {lang === 'ar' 
                  ? 'ميزان السوائل 12 ساعة ونقل مشتقات الدم (Fluid Balance & MTP)' 
                  : '12-Hour Fluid Balance & Massive Transfusion (MTP)'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {fluidBalance && (
                (() => {
                  const netVal = fluidBalance.netCumulativeBalanceMl ?? (fluidBalance as any).netBalance24HMl ?? 0;
                  return (
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold hidden sm:inline ${
                      netVal >= 0 
                        ? 'bg-amber-950 text-amber-300 border border-amber-700' 
                        : 'bg-teal-950 text-teal-300 border border-teal-700'
                    }`}>
                      NET 12H: {netVal > 0 ? `+${netVal}` : netVal} mL
                    </span>
                  );
                })()
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperFluidsCardCollapsed(!isPaperFluidsCardCollapsed);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                title={isPaperFluidsCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                {isPaperFluidsCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperFluidsCardCollapsed && (
            <div className="space-y-3 animate-in fade-in duration-300">
              {/* Action Toolbar inside expanded card */}
              <div className="flex items-center justify-between bg-[#070c18] p-2.5 rounded-xl border border-slate-800/80 gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-teal-300 font-mono">
                    {fluidBalance ? (lang === 'ar' ? 'ميزان السوائل 12 ساعة مسجل' : '12H Fluid Balance Logged') : (lang === 'ar' ? 'لا يوجد ميزان مسجل للنوبتجية الحالية' : 'No balance logged for shift')}
                  </span>
                  {allFluidBalances.length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto max-w-[300px] sm:max-w-xs scrollbar-none">
                      {(showMoreBedsideFluids ? allFluidBalances : allFluidBalances.slice(0, 4)).map((fRec, idx) => {
                        const recDateStr = fRec.periodEndTimestamp ? fRec.periodEndTimestamp.split('T')[0] : (fRec as any).date;
                        const isSelected = fluidBalance?.id === fRec.id;
                        const sLabel = fRec.shiftType === 'NIGHT' ? (lang === 'ar' ? 'ليل' : 'N') : (lang === 'ar' ? 'صباح' : 'D');
                        return (
                          <button
                            key={fRec.id || idx}
                            type="button"
                            onClick={() => setFluidBalance(fRec)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1 ${
                              isSelected
                                ? 'bg-teal-950 text-teal-300 border-teal-600 font-bold shadow'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            <span>{recDateStr || `Record ${idx + 1}`}</span>
                            <span className="text-[9px] opacity-75">({sLabel})</span>
                          </button>
                        );
                      })}

                      {allFluidBalances.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setShowMoreBedsideFluids(!showMoreBedsideFluids)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 whitespace-nowrap shrink-0 transition-all cursor-pointer"
                        >
                          {showMoreBedsideFluids 
                            ? (lang === 'ar' ? 'عرض أقل' : 'Less') 
                            : (lang === 'ar' ? `إظهار المزيد (+${allFluidBalances.length - 4})` : `More (+${allFluidBalances.length - 4})`)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {fluidBalance && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFluidBalanceForEdit(fluidBalance);
                        setIsFluidModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 font-bold text-xs shadow-md active:scale-95 cursor-pointer transition-colors"
                      title={lang === 'ar' ? 'تعديل ميزان السوائل الحالي' : 'Edit Current 12H Balance'}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تعديل ميزان السوائل' : 'Edit Balance'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFluidBalanceForEdit(null);
                      setIsFluidModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 cursor-pointer transition-colors"
                    title={lang === 'ar' ? 'إضافة ميزان 12 ساعة للنوبتجية الحالية' : 'Add 12-Hour Fluid Balance'}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة ميزان 12 ساعة' : 'Add 12H Balance'}</span>
                  </button>
                </div>
              </div>

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
                  <div className="space-y-2.5 font-mono">
                    {/* Compact 3-Column Row: Intake (IN), Output (OUT), Net (NET) side-by-side on mobile */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                      {/* 1. Total Intake */}
                      <div className="bg-[#070c18] p-2.5 sm:p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                        <div className="text-[9px] sm:text-[11px] font-bold text-cyan-400 truncate">
                          {lang === 'ar' ? 'الوارد الكلي (IN)' : 'Total Intake (IN)'}
                        </div>
                        <div className="text-sm sm:text-base md:text-lg font-black text-cyan-300 mt-1 truncate">
                          {totalIntake} <span className="text-[8px] sm:text-[10px] font-normal text-slate-400">mL</span>
                        </div>
                        <div className="text-[8px] sm:text-[10px] text-slate-400 mt-1 truncate">
                          {lang === 'ar'
                            ? `محاليل: ${ivMaint} | مضخات: ${ivMeds}`
                            : `IV: ${ivMaint} | Pumps: ${ivMeds}`}
                        </div>
                      </div>

                      {/* 2. Total Output */}
                      <div className="bg-[#070c18] p-2.5 sm:p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                        <div className="text-[9px] sm:text-[11px] font-bold text-amber-400 truncate">
                          {lang === 'ar' ? 'الصادر الكلي (OUT)' : 'Total Output (OUT)'}
                        </div>
                        <div className="text-sm sm:text-base md:text-lg font-black text-amber-300 mt-1 truncate">
                          {totalOutput} <span className="text-[8px] sm:text-[10px] font-normal text-slate-400">mL</span>
                        </div>
                        <div className="text-[8px] sm:text-[10px] text-slate-400 mt-1 truncate">
                          {lang === 'ar'
                            ? `بول: ${urineVal} mL`
                            : `Urine: ${urineVal} mL`}
                        </div>
                      </div>

                      {/* 3. Net Balance */}
                      <div className="bg-[#070c18] p-2.5 sm:p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                        <div className="text-[9px] sm:text-[11px] font-bold text-indigo-400 truncate">
                          {lang === 'ar' ? 'صافي الميزان (NET)' : 'Net Balance (NET)'}
                        </div>
                        <div className={`text-sm sm:text-base md:text-lg font-black mt-1 truncate ${
                          netVal >= 0 ? 'text-indigo-300' : 'text-emerald-300'
                        }`}>
                          {netVal > 0 ? `+${netVal}` : netVal} <span className="text-[8px] sm:text-[10px] font-normal text-slate-400">mL</span>
                        </div>
                        <div className="text-[8px] sm:text-[10px] text-slate-400 mt-1 truncate">
                          {lang === 'ar' ? 'ميزان 24 ساعة' : '24h Balance'}
                        </div>
                      </div>
                    </div>

                    {/* Secondary Row: MTP & Urine Hourly Rate */}
                    <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-[10px] sm:text-xs text-slate-300 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-bold">{lang === 'ar' ? 'نقل الدم (MTP):' : 'MTP Blood:'}</span>
                        <span className="text-red-300 font-mono font-bold">PRBC: {prbcUnits} {lang === 'ar' ? 'أكياس' : 'U'}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400 font-mono">FFP: {ffpUnits}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400 font-mono">PLT: {plateletsUnits}</span>
                      </div>

                      <div className="text-slate-400 font-mono">
                        <span className="text-amber-400 font-semibold">{lang === 'ar' ? 'معدل البول (UOP):' : 'UOP Rate:'} </span>
                        <span className="text-slate-200 font-bold">{uopRate} mL/hr</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className="p-6 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800 space-y-3">
                  <div>{lang === 'ar' ? 'لا توجد بيانات مسجلة لميزان السوائل اليوم.' : 'No fluid balance logs recorded for today.'}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFluidBalanceForEdit(null);
                      setIsFluidModalOpen(true);
                      setIsPaperFluidsCardCollapsed(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تسجيل ميزان سوائل اليوم' : 'Log Today Fluid Balance'}</span>
                  </button>
                </div>
              )}

              {/* 📜 Previous Fluid Records Archive at the bottom of the card */}
              {allFluidBalances.length > 0 && (
                <div className="p-3 rounded-xl bg-[#060d1d] border border-slate-800 space-y-2 mt-3 font-mono">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <div className="flex items-center gap-1.5 text-teal-400">
                      <History className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'سجلات ميزان السوائل السابقة:' : 'Previous Fluid Records Archive:'}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      ({allFluidBalances.length} {lang === 'ar' ? 'سجلات' : 'records'})
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {(showMoreBedsideFluids ? allFluidBalances : allFluidBalances.slice(0, 4)).map((rec, idx) => {
                      const recDateStr = rec.periodEndTimestamp ? rec.periodEndTimestamp.split('T')[0] : (rec as any).date || `Record ${idx + 1}`;
                      const isCurrent = fluidBalance?.id === rec.id;
                      const netVal = rec.netCumulativeBalanceMl ?? (rec as any).netBalance24HMl ?? 0;
                      const totalIn = rec.intakeBreakdown?.totalIntakeMl ?? (rec as any).totalIntakeMl ?? 0;
                      const totalOut = rec.outputBreakdown?.totalOutputMl ?? (rec as any).outputBreakdown?.totalOutputMl ?? 0;
                      const shiftLabel = rec.shiftType === 'NIGHT' 
                        ? (lang === 'ar' ? 'مناوبة ليلية' : 'NIGHT') 
                        : (lang === 'ar' ? 'مناوبة صباحية' : 'DAY');

                      return (
                        <button
                          key={rec.id || idx}
                          type="button"
                          onClick={() => setFluidBalance(rec)}
                          className={`w-full p-2.5 rounded-xl text-xs transition-all cursor-pointer border flex items-center justify-between gap-2.5 flex-wrap sm:flex-nowrap ${
                            isCurrent
                              ? 'bg-teal-950/90 text-teal-200 border-teal-500 font-bold shadow-md shadow-teal-500/10'
                              : 'bg-[#050a17] text-slate-300 border-slate-800 hover:bg-slate-800/80'
                          }`}
                        >
                          {/* Date & Shift */}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-[11px] sm:text-xs">{recDateStr}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                              rec.shiftType === 'NIGHT' 
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' 
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {shiftLabel}
                            </span>
                          </div>

                          {/* Intake and Output */}
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="text-cyan-400 font-semibold">IN: {totalIn} mL</span>
                            <span className="text-amber-400 font-semibold">OUT: {totalOut} mL</span>
                          </div>

                          {/* Net Balance Badge */}
                          <div className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                            netVal >= 0 ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80' : 'bg-teal-950/80 text-teal-300 border border-teal-800/80'
                          }`}>
                            NET: {netVal > 0 ? `+${netVal}` : netVal} mL
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {allFluidBalances.length > 4 && (
                    <div className="pt-1 text-center">
                      <button
                        type="button"
                        onClick={() => setShowMoreBedsideFluids(!showMoreBedsideFluids)}
                        className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {showMoreBedsideFluids
                          ? (lang === 'ar' ? 'عرض أقل' : 'Show Less')
                          : (lang === 'ar' ? `إظهار المزيد (+${allFluidBalances.length - 4} سجلات أخرى)` : `Show More (+${allFluidBalances.length - 4} more)`)}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: SBAR Handovers */}
      {(activeTab === 'sbar' || activeTab === 'all') && (
        <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperSbarCardCollapsed(!isPaperSbarCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'سجلات تسليم واستلام المناوبات السريرية (SBAR Shift Handover)' : 'SBAR Shift Handover Reports'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs font-mono shadow-md">
                    {sbarList.length}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperSbarCardCollapsed(!isPaperSbarCardCollapsed);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                title={isPaperSbarCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                {isPaperSbarCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperSbarCardCollapsed && (
            <div className="space-y-3 animate-in fade-in duration-300">
              {/* Action Toolbar inside expanded card: New Handover + Quick status */}
              <div className="flex items-center justify-between bg-[#070c18] p-3 rounded-xl border border-slate-800/80 flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black font-mono shadow flex items-center gap-1.5">
                    <span>{sbarList.length}</span>
                    <span>{lang === 'ar' ? 'تقارير تسليم مسجلة' : 'Logged SBAR Reports'}</span>
                  </span>
                  {sbarList.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      • {lang === 'ar' ? `آخر تسليم: ${sbarList[0].shiftDate} (${sbarList[0].outgoingDoctor.name})` : `Latest: ${sbarList[0].shiftDate} (${sbarList[0].outgoingDoctor.name})`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  {(() => {
                    const pendingSbar = sbarList.find(s => !s.incomingDoctor?.signedAt);
                    return (
                      <>
                        {pendingSbar && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTemplateSbar(pendingSbar);
                              setIsBedsideSbarModalOpen(true);
                            }}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer transition-all animate-pulse border border-amber-300"
                          >
                            <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />
                            <span>
                              {lang === 'ar' 
                                ? `استلام مناوبة ${pendingSbar.shiftType === 'NIGHT' ? 'ليلية' : 'صباحية'}` 
                                : `Receive ${pendingSbar.shiftType === 'NIGHT' ? 'Night' : 'Day'} Shift`}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTemplateSbar(null);
                            setIsBedsideSbarModalOpen(true);
                          }}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs shadow-md shadow-teal-500/20 active:scale-95 cursor-pointer transition-all"
                        >
                          <Plus className="w-4 h-4 text-slate-950 shrink-0" />
                          <span>{lang === 'ar' ? 'تسليم مناوبة جديد SBAR' : 'New SBAR Handover'}</span>
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Handover Cards Display */}
              {sbarList.length > 0 ? (
                <>
                  {(showMoreSbars ? sbarList : sbarList.slice(0, 2)).map((sbar) => (
                  <div 
                    key={sbar.id}
                    className="bg-[#070c18] border border-slate-800 p-4 rounded-xl space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                          sbar.shiftType === 'NIGHT' 
                            ? 'bg-indigo-950 text-indigo-300 border-indigo-800' 
                            : 'bg-amber-950 text-amber-300 border-amber-800'
                        }`}>
                          {sbar.shiftType} SHIFT
                        </span>
                        <span className="text-xs text-slate-300 font-mono font-bold">
                          {sbar.shiftDate} ({sbar.shiftStartTime} - {sbar.shiftEndTime})
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-teal-300">
                          {lang === 'ar' ? 'المُسلِّم: ' : 'Outgoing: '}
                          <strong className="text-white">{sbar.outgoingDoctor.name}</strong> ({sbar.outgoingDoctor.role})
                        </span>
                        {sbar.incomingDoctor && (
                          <span className="text-xs text-slate-400">
                            → {lang === 'ar' ? 'المُستلِم: ' : 'Incoming: '}
                            <strong className="text-slate-200">{sbar.incomingDoctor.name}</strong>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Clone/Template Action */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTemplateSbar(sbar);
                            setIsBedsideSbarModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-teal-950 hover:bg-teal-900 border border-teal-700/80 text-teal-300 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                          title={lang === 'ar' ? 'استخدام هذا التقرير كمسوّدة لتسليم جديد' : 'Use this report as a template for new handover'}
                        >
                          <Sparkles className="w-3 h-3 text-teal-400" />
                          <span>{lang === 'ar' ? 'استخدام كقالب لمناوبة جديدة' : 'Use as Template'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* S - Situation */}
                      <div className="bg-[#0a101f] p-3 rounded-lg border border-teal-900/40">
                        <div className="flex items-center gap-1.5 text-teal-400 font-bold font-mono">
                          <span className="w-4 h-4 rounded-full bg-teal-500/20 flex items-center justify-center text-[10px]">S</span>
                          <span>Situation (الموقف الحالي):</span>
                        </div>
                        <p className="text-slate-200 mt-1.5 leading-relaxed">{sbar.situation}</p>
                      </div>

                      {/* B - Background */}
                      <div className="bg-[#0a101f] p-3 rounded-lg border border-cyan-900/40">
                        <div className="flex items-center gap-1.5 text-cyan-400 font-bold font-mono">
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">B</span>
                          <span>Background (الخلفية المرضية):</span>
                        </div>
                        <p className="text-slate-200 mt-1.5 leading-relaxed">{sbar.background}</p>
                      </div>

                      {/* A - Assessment */}
                      <div className="bg-[#0a101f] p-3 rounded-lg border border-amber-900/40">
                        <div className="flex items-center gap-1.5 text-amber-400 font-bold font-mono">
                          <span className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">A</span>
                          <span>Assessment (التقييم السريري):</span>
                        </div>
                        <div className="text-slate-200 mt-1.5 space-y-1">
                          <div className="text-[11px]"><strong className="text-red-300">• الدورة والضغط:</strong> {sbar.assessment?.hemodynamics || '—'}</div>
                          <div className="text-[11px]"><strong className="text-cyan-300">• الرئة والتنفس:</strong> {sbar.assessment?.pulmonaryAndAirway || '—'}</div>
                          <div className="text-[11px]"><strong className="text-amber-300">• الكلى والسوائل:</strong> {sbar.assessment?.metabolicAndRenal || '—'}</div>
                          {sbar.assessment?.neurologyAndSedation && (
                            <div className="text-[11px]"><strong className="text-indigo-300">• الأعصاب والمهدئات:</strong> {sbar.assessment.neurologyAndSedation}</div>
                          )}
                          {sbar.assessment?.infectiousDiseaseAndAntibiotics && (
                            <div className="text-[11px]"><strong className="text-emerald-300">• الحرارة والمضادات:</strong> {sbar.assessment.infectiousDiseaseAndAntibiotics}</div>
                          )}
                        </div>
                      </div>

                      {/* R - Recommendation */}
                      <div className="bg-[#0a101f] p-3 rounded-lg border border-emerald-900/40">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono">
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">R</span>
                          <span>Recommendation (الخطة والأوامر):</span>
                        </div>
                        <ul className="text-slate-200 mt-1.5 space-y-1">
                          {(sbar.recommendationAndOrders || []).map((rec, idx) => (
                            <li key={idx} className="text-[11px] flex items-start gap-1.5">
                              <span className="text-emerald-400 font-bold">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  ))}

                  {/* Show More Button after 2nd record */}
                  {sbarList.length > 2 && (
                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={() => setShowMoreSbars(!showMoreSbars)}
                        className="px-5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto active:scale-95 shadow-md"
                      >
                        <span>
                          {showMoreSbars
                            ? (lang === 'ar' ? 'عرض أقل' : 'Show Less')
                            : (lang === 'ar' ? `إظهار المزيد (${sbarList.length - 2} تقارير متبقية)` : `Show More (${sbarList.length - 2} remaining)`)}
                        </span>
                        {showMoreSbars ? <ChevronUp className="w-4 h-4 text-teal-400" /> : <ChevronDown className="w-4 h-4 text-teal-400" />}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800 space-y-3">
                  <div>{lang === 'ar' ? 'لا توجد تقارير تسليم مناوبة مسجلة لهذا المريض بعد.' : 'No shift handover reports recorded yet for this patient.'}</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateSbar(null);
                      setIsBedsideSbarModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تسليم مناوبة جديد وتوثيق SBAR' : 'Create First SBAR Handover'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Clinical Notes & SHA-256 Addendums */}
      {(activeTab === 'notes' || activeTab === 'all') && (
        <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperNotesCardCollapsed(!isPaperNotesCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'الملاحظات الطبية وملحقاتها' : 'Clinical Progress Notes & Cryptographic Addendums'}
                </h3>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  {lang === 'ar' 
                    ? 'ملاحظات الأطباء محمية بتشفير SHA-256، لا يمكن حذفها، ويتم إلحاق التحديثات عبر Addendums فقط.'
                    : 'Medical notes are cryptographic SHA-256 protected and immutable. Modifications are appended as verified addendums.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenAddClinicalNote && !isPaperNotesCardCollapsed && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAddClinicalNote();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'توقيع ملاحظة جديدة' : 'Sign New Note'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperNotesCardCollapsed(!isPaperNotesCardCollapsed);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                title={isPaperNotesCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                {isPaperNotesCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperNotesCardCollapsed && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {notesList.length > 0 ? notesList.map((note) => (
                <div 
                   key={note.id}
                   className="bg-[#070c18] border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2 gap-2">
                    <div>
                      <span className="font-bold text-white text-sm">{note.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 mx-2">
                        {note.noteType} • {new Date(note.timestamp).toLocaleString('en-US')}
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

                  <div className="text-[11px] text-slate-400 font-sans">
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
                            <span>{new Date(addendum.timestamp).toLocaleString('en-US')}</span>
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
              )) : (
                <div className="p-6 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
                  {lang === 'ar' ? 'لا توجد ملاحظات سريرية مسجلة اليوم.' : 'No clinical progress notes recorded today.'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Disposition */}
      {(activeTab === 'disposition' || activeTab === 'all') && (
        <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl space-y-4">
          <div 
            onClick={() => setIsPaperDispCardCollapsed(!isPaperDispCardCollapsed)}
            className="flex items-center justify-between border-b border-slate-800 pb-2.5 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'إنهاء الاقامة' : 'ICU Disposition & Discharge'}
                </h3>
                <p className="text-[10px] text-slate-400 hidden sm:block">
                  {lang === 'ar' 
                    ? 'تحويل المريض للأقسام الداخلية، الخروج للمنزل، أو تسجيل الوفاة القانونية.'
                    : 'Discharge home, inpatient ward transfer, or mortality registration.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaperDispCardCollapsed(!isPaperDispCardCollapsed);
                }}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
                title={isPaperDispCardCollapsed ? (lang === 'ar' ? 'فتح البطاقة' : 'Expand') : (lang === 'ar' ? 'طي البطاقة' : 'Collapse')}
              >
                {isPaperDispCardCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isPaperDispCardCollapsed && (
            <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-4 text-xs animate-in fade-in duration-300">
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-2">
                  {lang === 'ar' ? 'اختر الإجراء المطلوبة (Select Disposition Type)' : 'Select Disposition Type'}
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDispType(DispositionType.TRANSFER_GENERAL_WARD);
                      setDispSummary(lang === 'ar' ? 'تم تحويل المريض لجناح الباطنة / الرعاية المتوسطة بعد استقرار حالته.' : 'Patient stabilized and transferred to general ward.');
                    }}
                    className={`p-3 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                      dispType === DispositionType.TRANSFER_GENERAL_WARD
                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-md'
                        : 'bg-[#0b1224] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block text-sm mb-0.5">🔄</span>
                    <span>{lang === 'ar' ? 'تحويل' : 'Transfer'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDispType(DispositionType.DISCHARGE_HOME);
                      setDispSummary(lang === 'ar' ? 'خروج المريض للمنزل بحالة مستقرة مع التوصية بالمتابعة في العيادة.' : 'Patient fully recovered and discharged home.');
                    }}
                    className={`p-3 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                      dispType === DispositionType.DISCHARGE_HOME
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-md'
                        : 'bg-[#0b1224] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block text-sm mb-0.5">🏠</span>
                    <span>{lang === 'ar' ? 'خروج' : 'Discharge'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDispType(DispositionType.CLINICAL_MORTALITY);
                      setDispSummary(lang === 'ar' ? 'تم إعلان الوفاة السريرية بعد توقف القلب والتنفس وفشل محاولات الإنعاش.' : 'Clinical mortality declared after cardiopulmonary arrest.');
                    }}
                    className={`p-3 rounded-xl border font-bold text-xs text-center transition-all cursor-pointer ${
                      dispType === DispositionType.CLINICAL_MORTALITY
                        ? 'bg-red-950/50 text-red-300 border-red-500/50 shadow-md'
                        : 'bg-[#0b1224] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="block text-sm mb-0.5">🕯️</span>
                    <span>{lang === 'ar' ? 'وفاة' : 'Mortality'}</span>
                  </button>
                </div>
              </div>

              {dispType !== null && (
                <div className="space-y-4 pt-1 animate-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                      {dispType === DispositionType.TRANSFER_GENERAL_WARD
                        ? (lang === 'ar' ? 'ملخص التحويل' : 'Transfer Summary')
                        : dispType === DispositionType.DISCHARGE_HOME
                        ? (lang === 'ar' ? 'ملخص الخروج' : 'Discharge Summary')
                        : (lang === 'ar' ? 'ملخص الوفاة' : 'Mortality Summary')}
                    </label>
                    <textarea
                      rows={3}
                      value={dispSummary}
                      onChange={(e) => setDispSummary(e.target.value)}
                      placeholder={lang === 'ar' ? 'اكتب الملخص الطبي السريري والتشخيص النهائي هنا...' : 'Enter clinical summary...'}
                      className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-300 font-semibold block">
                      {lang === 'ar' ? 'الطبيب الاستشاري المعتمد' : 'Attending Consultant Signature'}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2 bg-[#090f1d] p-3 rounded-xl border border-slate-800/80">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none flex-1">
                        <input
                          type="radio"
                          name="consultantType"
                          checked={!useOtherConsultant}
                          onChange={() => setUseOtherConsultant(false)}
                          className="accent-teal-500 text-teal-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-xs">
                          {lang === 'ar' 
                            ? `الاستشاري المسجل الحالي: ${currentUser ? (currentUser.nameAr || currentUser.nameEn) : 'Dr. Hesham Talaat'}` 
                            : `Current Attending: ${currentUser ? (currentUser.nameEn || currentUser.nameAr) : 'Dr. Hesham Talaat'}`}
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none flex-1">
                        <input
                          type="radio"
                          name="consultantType"
                          checked={useOtherConsultant}
                          onChange={() => setUseOtherConsultant(true)}
                          className="accent-teal-500 text-teal-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-xs">
                          {lang === 'ar' ? 'تسجيل استشاري آخر' : 'Sign as Another Consultant'}
                        </span>
                      </label>
                    </div>

                    {useOtherConsultant && (
                      <input
                        type="text"
                        value={otherConsultantName}
                        onChange={(e) => setOtherConsultantName(e.target.value)}
                        placeholder={lang === 'ar' ? 'أدخل اسم الاستشاري المعتمد...' : 'Enter attending consultant name...'}
                        className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none animate-in fade-in duration-200"
                        required
                      />
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleExecuteDisposition}
                      className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer ${
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
              )}
            </div>
          )}
        </div>
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
      {settings.features.enableAiLabScanner && (
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
        onClose={() => {
          setIsFluidModalOpen(false);
          setSelectedFluidBalanceForEdit(null);
        }}
        bedNumber={bed.bedNumber}
        patient={patient}
        initialFluidBalance={selectedFluidBalanceForEdit}
        allFluidBalances={allFluidBalances}
        onSaved={() => {
          setIsFluidModalOpen(false);
          setSelectedFluidBalanceForEdit(null);
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
          setSelectedTemplateSbar(null);
          setIsBedsideSbarModalOpen(true);
        }}
        onOpenAddLab={() => {
          setIsCardsConfigModalOpen(false);
          setIsAddLabModalOpen(true);
        }}
      />

      {/* SBAR Shift Handover Modal for Bedside */}
      {isBedsideSbarModalOpen && (
        <SbarSignModal
          isOpen={isBedsideSbarModalOpen}
          onClose={() => {
            setIsBedsideSbarModalOpen(false);
            setSelectedTemplateSbar(null);
          }}
          bedNumber={bed.bedNumber}
          patientId={patient.id}
          patientName={patient.fullNameAr || patient.fullNameEn}
          primaryDiagnosis={patient.primaryDiagnosisAr || patient.primaryDiagnosisEn}
          codeStatus={patient.codeStatus}
          patient={patient}
          currentVitals={vitalsHistory[0] || null}
          currentVentilator={ventilator}
          currentPumps={pumps}
          currentFluidBalance={fluidBalance}
          currentLabs={labsList}
          previousHandovers={sbarList}
          templateSbar={selectedTemplateSbar}
          onHandoverSigned={() => {
            loadBedsideData();
            onDataUpdated();
            setIsBedsideSbarModalOpen(false);
            setSelectedTemplateSbar(null);
          }}
        />
      )}

      {/* Edit Vitals Reading Modal */}
      <AddVitalsModal
        isOpen={isEditVitalsModalOpen}
        onClose={() => {
          setIsEditVitalsModalOpen(false);
          setSelectedVitalForEdit(null);
        }}
        bedNumber={bed.bedNumber}
        patientId={patient.id}
        patientName={patient.fullNameAr || patient.fullNameEn}
        vitalsToEdit={selectedVitalForEdit}
        onVitalsAdded={() => {
          setIsEditVitalsModalOpen(false);
          setSelectedVitalForEdit(null);
          loadBedsideData();
          onDataUpdated();
        }}
      />

      {/* Full Patient Demographics & Admission Edit Modal */}
      {isEditPatientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto p-4 md:p-6 flex flex-col justify-start">
          <div className="max-w-5xl mx-auto w-full space-y-4 my-auto">
            <div className="flex items-center justify-between bg-[#0b1224] p-4 rounded-2xl border border-slate-700/80 shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">
                    {lang === 'ar' ? 'تعديل كافة بيانات الملف الطبي والمريض' : 'Edit Full Patient Demographics & Profile'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' ? `السرير ${bed.bedNumber} - الملف: ${patient.mrn || patient.nationalId}` : `Bed ${bed.bedNumber} - MRN: ${patient.mrn}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPatientModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-slate-700 active:scale-95"
              >
                {lang === 'ar' ? 'إغلاق (X)' : 'Close (X)'}
              </button>
            </div>

            <FullPageAdmission
              bedNumber={bed.bedNumber}
              allBeds={allBeds}
              allPatients={allPatients}
              initialPatient={patient}
              onCancel={() => setIsEditPatientModalOpen(false)}
              onAdmissionSuccess={() => {
                setIsEditPatientModalOpen(false);
                loadBedsideData();
                onDataUpdated();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
