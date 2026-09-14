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
  Check
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
  StatLabPanel
} from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { dischargeOrTransferPatient } from '../services/dataModel.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { syncStatLabsToCloud, syncPatientToCloud } from '../services/firebase.ts';

interface BedsideFlowsheetProps {
  bed: BedRecord;
  patient: PatientDossier;
  onBack: () => void;
  onOpenAddVitals: () => void;
  onOpenAddAddendum: (noteId: string, author: string) => void;
  onOpenSbarSign: () => void;
  onDataUpdated: () => void;
}

export const BedsideFlowsheet: React.FC<BedsideFlowsheetProps> = ({
  bed,
  patient,
  onBack,
  onOpenAddVitals,
  onOpenAddAddendum,
  onOpenSbarSign,
  onDataUpdated,
}) => {
  const { settings } = useSystemSettings();
  const { t, lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'paperFlowsheet' | 'vitals' | 'vent' | 'pumps' | 'fluids' | 'sbar' | 'notes' | 'disposition'>('paperFlowsheet');
  
  const [vitalsHistory, setVitalsHistory] = useState<TelemetryVitals[]>([]);
  const [ventilator, setVentilator] = useState<VentilatorParameters | null>(null);
  const [pumps, setPumps] = useState<InfusionPumpLine[]>([]);
  const [fluidBalance, setFluidBalance] = useState<FluidBalance24H | null>(null);
  const [sbarList, setSbarList] = useState<SbarHandoverReport[]>([]);
  const [notesList, setNotesList] = useState<ClinicalNote[]>([]);
  const [labsList, setLabsList] = useState<StatLabPanel[]>([]);

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
      {/* Top Dossier Header Card */}
      <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 shadow-xl">
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
                <span className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono font-black text-sm flex items-center justify-center">
                  {bed.bedNumber}
                </span>
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  {lang === 'ar' 
                    ? `${patient.fullNameAr} (${patient.fullNameEn})` 
                    : `${patient.fullNameEn} (${patient.fullNameAr})`}
                </h1>
                <span className="font-mono text-xs text-teal-400 font-semibold px-2 py-0.5 rounded bg-teal-950/80 border border-teal-800/80">
                  #{patient.mrn}
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
                <span className="font-semibold text-slate-200">{lang === 'ar' ? 'التشخيص:' : 'Diagnosis:'}</span>{' '}
                {lang === 'ar' 
                  ? `${patient.primaryDiagnosisAr} — ${patient.primaryDiagnosisEn}` 
                  : `${patient.primaryDiagnosisEn} — ${patient.primaryDiagnosisAr}`}
              </p>

              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5 flex-wrap">
                <span>{lang === 'ar' ? 'العمر:' : 'Age:'} <strong className="text-white">{patient.age}</strong> {lang === 'ar' ? 'سنة' : 'yo'}</span>
                <span>•</span>
                <span>{lang === 'ar' ? 'الوزن:' : 'Weight:'} <strong className="text-white">{patient.weightKg}</strong> {lang === 'ar' ? 'كجم' : 'kg'} (IBW: <strong className="text-teal-400">{patient.idealBodyWeightKg}</strong> {lang === 'ar' ? 'كجم' : 'kg'})</span>
                <span>•</span>
                <span>{lang === 'ar' ? 'الاستشاري:' : 'Attending:'} <strong className="text-slate-200">{patient.attendingPhysician.name}</strong></span>
                <span>•</span>
                <span>{lang === 'ar' ? 'التمريض:' : 'Primary RN:'} <strong className="text-slate-200">{patient.primaryNurse.name}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Header CTAs */}
          <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center">
            {settings.features.enableTelemetryVitals && (
              <button
                onClick={onOpenAddVitals}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Activity className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تسجيل علامات' : 'Record Vitals'}</span>
              </button>
            )}

            {settings.features.enableSbarHandover && (
              <button
                onClick={onOpenSbarSign}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-teal-500/20 active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تسليم SBAR' : 'SBAR Sign'}</span>
              </button>
            )}
          </div>
        </div>
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
              id: 'paperFlowsheet', 
              label: lang === 'ar' ? 'الورقة الطبية الموحدة (Paper Chart)' : 'Paper Flowsheet', 
              icon: FileText, 
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
      {activeTab === 'paperFlowsheet' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Top Row: History & Patient Data Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* History & Presenting Complaints Box */}
            <div className="lg:col-span-2 bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-400" />
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'التاريخ الطبي والشكوى الحالية' : 'Clinical History & Complaints'}
                  </h3>
                </div>
                {!isHistoryEditing && (
                  <button
                    onClick={() => setIsHistoryEditing(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold transition-all"
                  >
                    {lang === 'ar' ? 'تعديل البيانات الطبية' : 'Edit Medical Info'}
                  </button>
                )}
              </div>

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
            </div>

            {/* Demographics / Pt Data Box */}
            <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'بيانات المريض الأساسية' : 'Patient Demographics (Pt Data)'}
                  </h3>
                </div>
                <span className="font-mono text-[11px] text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800 font-bold">
                  {bed.bedNumber}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5 my-4 text-xs font-mono">
                <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'الاسم كاملاً' : 'Full Name'}</div>
                  <div className="text-white font-bold mt-0.5 text-xs truncate">
                    {lang === 'ar' ? patient.fullNameAr : patient.fullNameEn}
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
            </div>
          </div>

          {/* Interactive Labs Grid Table (التحاليل الطبية المتسلسلة التراكمية) */}
          <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'جدول التحاليل المتسلسلة التراكمية (الورقة الورقية الرقمية)' : 'Progressive Sequential Laboratories Grid'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {lang === 'ar'
                      ? 'يتم عرض التحاليل في أعمدة متسلسلة زمنياً من الأقدم للأحدث، مع توثيق اسم كل طبيب وحظر التعديل التبادلي.'
                      : 'Labs are ordered sequentially side-by-side chronologically with doctor-lock protection to ensure medical integrity.'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenAddLabColumn}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إضافة عمود تحاليل جديد' : 'Add New Lab Column'}</span>
              </button>
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
          </div>

          {/* Connected Support Equipment & Bedside Systems (الأجهزة الموصلة والمضخات وميزان السوائل) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Ventilator connectivity status */}
            <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Wind className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">{lang === 'ar' ? 'جهاز التنفس الصناعي الجاري' : 'Active Mechanical Ventilator'}</h3>
                </div>
                {ventilator && (
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[10px] font-bold">
                    {ventilator.mode}
                  </span>
                )}
              </div>

              {ventilator ? (
                <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
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
                <div className="p-6 text-center text-xs text-slate-500 bg-[#070c18] rounded-xl border border-slate-800/80">
                  {lang === 'ar' ? 'المريض يتنفس تلقائياً بدون أجهزة جائرة.' : 'Patient is breathing spontaneously (Room Air / HFNC).'}
                </div>
              )}
            </div>

            {/* Infusion lines connectivity status */}
            <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Droplet className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">{lang === 'ar' ? 'مضخات ومحاليل موصلة' : 'Connected Infusions & Pumps'}</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                  {pumps.length} active
                </span>
              </div>

              {pumps.length > 0 ? (
                <div className="space-y-2 max-h-[140px] overflow-y-auto">
                  {pumps.map(p => (
                    <div key={p.id} className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="font-bold text-white font-mono truncate max-w-[150px]">{p.drugNameEn}</div>
                        <div className="text-[9px] text-slate-500">{p.diluentFluid} (Conc: {p.concentrationMgPerMl}mg/mL)</div>
                      </div>
                      <div className="text-right font-mono">
                        <div className="text-amber-400 font-bold">{p.currentRate} {p.rateUnit}</div>
                        <div className="text-[9px] text-slate-500">Rem: {p.volumeRemainingMl}mL</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-[#070c18] rounded-xl border border-slate-800/80">
                  {lang === 'ar' ? 'لا توجد قنوات حقن وريدي نشطة حالياً.' : 'No active infusion pumps registered.'}
                </div>
              )}
            </div>

            {/* Daily Fluid balances */}
            <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-teal-400" />
                  <h3 className="text-sm font-bold text-white">{lang === 'ar' ? 'ميزان السوائل والبول 24 ساعة' : '24h Fluid Balance Tracker'}</h3>
                </div>
                {fluidBalance && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${fluidBalance.netBalance24HMl >= 0 ? 'bg-amber-950 text-amber-300' : 'bg-teal-950 text-teal-300'}`}>
                    Net: {fluidBalance.netBalance24HMl > 0 ? `+${fluidBalance.netBalance24HMl}` : fluidBalance.netBalance24HMl} mL
                  </span>
                )}
              </div>

              {fluidBalance ? (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500">Intake Total</div>
                    <div className="text-cyan-300 font-bold mt-0.5">{fluidBalance.totalIntakeMl} mL</div>
                  </div>
                  <div className="bg-[#070c18] p-2.5 rounded-xl border border-slate-800">
                    <div className="text-[10px] text-slate-500">Output Urine (UOP)</div>
                    <div className="text-amber-400 font-bold mt-0.5">{fluidBalance.outputBreakdown.urineMl} mL</div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 bg-[#070c18] rounded-xl border border-slate-800/80">
                  {lang === 'ar' ? 'لم يسجل ميزان السوائل لليوم.' : 'No fluid balance records for today.'}
                </div>
              )}
            </div>
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
                      <div className="text-xs font-bold text-teal-400 border-b border-slate-800 pb-1.5 uppercase font-mono">{lang === 'ar' ? 'صورة الدم (CBC)' : 'Complete Blood Count (CBC)'}</div>
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
                      <div className="text-xs font-bold text-violet-400 border-b border-slate-800 pb-1.5 uppercase font-mono">{lang === 'ar' ? 'غازات الدم والعلامات الحيوية' : 'ABGs & Cardiac / Coagulation'}</div>
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
      {activeTab === 'vitals' && (
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
      {activeTab === 'vent' && (
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
                    ({Math.round((ventilator.setTidalVolumeMl || 420) / patient.idealBodyWeightKg)} mL/kg IBW)
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
      {activeTab === 'pumps' && (
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
      {activeTab === 'fluids' && (
        <div className="space-y-4">
          {fluidBalance ? (
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
                  fluidBalance.netBalance24HMl >= 0 
                    ? 'bg-amber-950 text-amber-300 border border-amber-700' 
                    : 'bg-teal-950 text-teal-300 border border-teal-700'
                }`}>
                  NET 24H: {fluidBalance.netBalance24HMl > 0 ? `+${fluidBalance.netBalance24HMl}` : fluidBalance.netBalance24HMl} mL
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                <div className="bg-[#070c18] p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'إجمالي المدخلات (Total Intake)' : 'Total Intake'}</div>
                  <div className="text-xl font-bold text-cyan-300 mt-1">{fluidBalance.totalIntakeMl} mL</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {lang === 'ar'
                      ? `محاليل: ${fluidBalance.intakeBreakdown.crystalloidMl} mL • مضخات: ${fluidBalance.intakeBreakdown.infusionsMl} mL`
                      : `Crystalloid: ${fluidBalance.intakeBreakdown.crystalloidMl} mL • Infusions: ${fluidBalance.intakeBreakdown.infusionsMl} mL`}
                  </div>
                </div>

                <div className="bg-[#070c18] p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'إجمالي المخرجات (Total Output)' : 'Total Output'}</div>
                  <div className="text-xl font-bold text-amber-300 mt-1">{fluidBalance.totalOutputMl} mL</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {lang === 'ar'
                      ? `بول: ${fluidBalance.outputBreakdown.urineMl} mL (${fluidBalance.outputBreakdown.hourlyUrineRateMlPerHr} mL/hr)`
                      : `Urine: ${fluidBalance.outputBreakdown.urineMl} mL (${fluidBalance.outputBreakdown.hourlyUrineRateMlPerHr} mL/hr)`}
                  </div>
                </div>

                <div className="bg-[#070c18] p-3.5 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'بروتوكول نقل الدم (MTP Transfusions)' : 'MTP Blood Transfusion'}</div>
                  <div className="text-sm font-bold text-red-300 mt-1">
                    PRBC: {fluidBalance.transfusionProductsGiven.prbcUnits} {lang === 'ar' ? 'أكياس' : 'Units'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    FFP: {fluidBalance.transfusionProductsGiven.ffpUnits} • Platelets: {fluidBalance.transfusionProductsGiven.plateletsUnits}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0b1224] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              {lang === 'ar' ? 'لا توجد بيانات مسجلة لميزان السوائل اليوم.' : 'No fluid balance logs recorded for today.'}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: SBAR Handovers */}
      {activeTab === 'sbar' && (
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
      {activeTab === 'notes' && (
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
      {activeTab === 'disposition' && (
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
    </div>
  );
};
