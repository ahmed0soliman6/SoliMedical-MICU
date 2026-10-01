import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  ArrowLeft, 
  Plus, 
  FileText, 
  ShieldCheck, 
  FlaskConical, 
  Camera, 
  Pill, 
  Droplet, 
  Eye, 
  Heart, 
  AlertCircle, 
  Check, 
  ChevronRight, 
  Mic, 
  Layers,
  Settings,
  Wind
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { db } from '../db/icuSyncDb.ts';
import { BedRecord, PatientDossier, TelemetryVitals, PatientAntibiotic, LabResultItem, InvestigationItem, ClinicalNote } from '../types/schema.ts';

// Import subcomponents
import { AntibioticsSection } from './AntibioticsSection.tsx';
import { LabFlowsheetSection } from './LabFlowsheetSection.tsx';
import { InvestigationsSection } from './InvestigationsSection.tsx';
import { ClinicalNotesView } from './ClinicalNotesView.tsx';
import { VoiceNoteRecorder } from './VoiceNoteRecorder.tsx';

interface BedsideFlowsheetProps {
  bed: BedRecord;
  patient: PatientDossier;
  allBeds: BedRecord[];
  allPatients: PatientDossier[];
  onSelectBed?: (bedNumber: string) => void;
  onBack: () => void;
  onOpenAddVitals: () => void;
  onOpenAddClinicalNote: () => void;
  onOpenAddAddendum: (noteId: string, author: string) => void;
  onOpenSbarSign: () => void;
  onDataUpdated?: () => void;
  readOnly?: boolean;
}

export const BedsideFlowsheet: React.FC<BedsideFlowsheetProps> = ({
  bed,
  patient,
  allBeds,
  allPatients,
  onSelectBed,
  onBack,
  onOpenAddVitals,
  onOpenAddClinicalNote,
  onOpenAddAddendum,
  onOpenSbarSign,
  onDataUpdated,
  readOnly = false
}) => {
  const { lang, isRTL } = useTranslation();
  const { settings } = useSystemSettings();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'vitals' | 'notes' | 'antibiotics' | 'labs' | 'investigations' | 'sbar'>('vitals');
  const [latestVitals, setLatestVitals] = useState<TelemetryVitals | null>(null);
  const [antibiotics, setAntibiotics] = useState<PatientAntibiotic[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationItem[]>([]);
  const [labResults, setLabResults] = useState<LabResultItem[]>([]);

  // Load telemetry data from local database
  const loadPatientData = async () => {
    try {
      // 1. Get latest vitals
      const vitalsList = await db.vitals.where('patientId').equals(patient.id).reverse().sortBy('timestamp');
      if (vitalsList && vitalsList.length > 0) {
        setLatestVitals(vitalsList[0]);
      } else {
        setLatestVitals(null);
      }

      // 2. Get antibiotics
      const abxList = await db.patientAntibiotics.where('patientId').equals(patient.id).toArray();
      setAntibiotics(abxList || []);

      // 3. Get investigations
      const invList = await db.investigations.where('patientId').equals(patient.id).toArray();
      setInvestigations(invList || []);

      // 4. Get lab results
      const labsList = await db.labResults.where('patientId').equals(patient.id).toArray();
      setLabResults(labsList || []);
    } catch (err) {
      console.warn('Error loading patient data for Flowshet profunda:', err);
    }
  };

  useEffect(() => {
    loadPatientData();
    // Auto-reload data when event is triggered or when patient changes
    const handleDataUpdated = () => loadPatientData();
    window.addEventListener('icu-data-updated', handleDataUpdated);
    return () => {
      window.removeEventListener('icu-data-updated', handleDataUpdated);
    };
  }, [patient.id]);

  const handleSubDataUpdated = () => {
    loadPatientData();
    if (onDataUpdated) onDataUpdated();
  };

  // Determine critical states
  const isHypotensive = latestVitals && latestVitals.meanArterialPressure !== undefined && latestVitals.meanArterialPressure < 65;
  const isHypoxemic = latestVitals && latestVitals.spo2 !== undefined && latestVitals.spo2 < 88;

  return (
    <div className="space-y-5" id="bedside-deep-dive-flowsheet">
      {/* Bedside flow sheet header bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-[#0a1122]/90 border border-slate-800 rounded-3xl backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
            title={lang === 'ar' ? 'عودة للرئيسية' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold font-mono">
                {lang === 'ar' ? `سرير ${bed.bedNumber}` : `Bed ${bed.bedNumber}`}
              </span>
              <h2 className="text-base font-bold text-white leading-none">
                {lang === 'ar' ? patient.fullNameAr || patient.fullNameEn : patient.fullNameEn || patient.fullNameAr}
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {lang === 'ar' ? `رقم الملف: ${patient.mrn}` : `MRN: ${patient.mrn}`}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
              <span>{lang === 'ar' ? `العمر: ${patient.age || '—'}` : `Age: ${patient.age || '—'}`}</span>
              <span>•</span>
              <span>{lang === 'ar' ? `الجنس: ${patient.gender}` : `Gender: ${patient.gender}`}</span>
              <span>•</span>
              <span>{lang === 'ar' ? `فصيلة الدم: ${patient.bloodGroup || 'غير مسجلة'}` : `Blood: ${patient.bloodGroup || 'N/A'}`}</span>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={onOpenAddVitals}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <Activity className="w-4 h-4 text-teal-400" />
                <span>{lang === 'ar' ? 'تسجيل علامات حيوية' : 'Record Vitals'}</span>
              </button>
              
              <button
                type="button"
                onClick={onOpenAddClinicalNote}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'ar' ? 'إضافة ملاحظة' : 'Add Clinical Note'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenSbarSign}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/10 cursor-pointer active:scale-95 transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>{lang === 'ar' ? 'تسليم SBAR ومصادقة' : 'Sign & Submit SBAR'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Critical Warnings Banner */}
      {(isHypotensive || isHypoxemic) && (
        <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-pulse shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                {lang === 'ar' ? 'تنبيهات حرجة للعلامات الحيوية للخلية' : 'CRITICAL TELEMETRY PATIENT ALERT'}
              </p>
              <div className="text-[11px] text-red-300 mt-0.5 space-y-0.5">
                {isHypotensive && (
                  <p>{lang === 'ar' ? `هبوط الضغط الشرياني الوسطي MAP < 65 (${latestVitals?.meanArterialPressure} mmHg)` : `Hypotension Alert: MAP < 65 mmHg (${latestVitals?.meanArterialPressure} mmHg)`}</p>
                )}
                {isHypoxemic && (
                  <p>{lang === 'ar' ? `هبوط الأكسجة SpO2 < 88% (${latestVitals?.spo2} %)` : `Hypoxemia Alert: SpO2 < 88% (${latestVitals?.spo2}%)`}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Nav Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-900 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('vitals')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'vitals'
              ? 'bg-[#0c1325] text-teal-400 border border-teal-500/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'العلامات الحيوية' : 'Vitals Flowsheet'}</span>
        </button>

        {settings.features?.enableClinicalNotesCard !== false && (
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'notes'
                ? 'bg-[#0c1325] text-teal-400 border border-teal-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'الملاحظات السريرية' : 'Clinical Notes'}</span>
          </button>
        )}

        {settings.features?.enableAntibioticsCard !== false && (
          <button
            type="button"
            onClick={() => setActiveTab('antibiotics')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'antibiotics'
                ? 'bg-[#0c1325] text-teal-400 border border-teal-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'المضادات وجرعات الكلى' : 'Antibiotics Matrix'}</span>
          </button>
        )}

        {settings.features?.enableLabFlowsheet !== false && (
          <button
            type="button"
            onClick={() => setActiveTab('labs')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'labs'
                ? 'bg-[#0c1325] text-teal-400 border border-teal-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'نتائج المختبر' : 'Stat Labs'}</span>
          </button>
        )}

        {settings.features?.enableInvestigations !== false && (
          <button
            type="button"
            onClick={() => setActiveTab('investigations')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'investigations'
                ? 'bg-[#0c1325] text-teal-400 border border-teal-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'الفحوصات والأشعة' : 'Investigations'}</span>
          </button>
        )}
      </div>

      {/* Main Tab Panels */}
      <div id="flowsheet-panels-wrapper">
        {activeTab === 'vitals' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Real-time telemetry monitor */}
            <div className="md:col-span-2 bg-[#091020]/90 border border-slate-800 rounded-3xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" />
                <span>{lang === 'ar' ? 'علامات القياس والتلغراف عن بعد' : 'Live Telemetry Stream'}</span>
              </h3>

              {latestVitals ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-900/60 text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{lang === 'ar' ? 'النبض HR' : 'HR'}</span>
                    <span className="text-xl font-bold font-mono text-emerald-400 block mt-1">
                      {latestVitals.heartRate || '—'} <span className="text-[11px] font-normal text-slate-500">bpm</span>
                    </span>
                  </div>
                  
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-900/60 text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{lang === 'ar' ? 'الضغط BP' : 'BP'}</span>
                    <span className="text-xl font-bold font-mono text-teal-400 block mt-1">
                      {latestVitals.systolicBp && latestVitals.diastolicBp ? `${latestVitals.systolicBp}/${latestVitals.diastolicBp}` : '—'}
                    </span>
                    <span className="text-[9px] text-slate-500 block font-mono mt-0.5">
                      MAP: <span className={isHypotensive ? 'text-red-400 font-bold' : 'text-slate-400'}>{latestVitals.meanArterialPressure || '—'}</span> mmHg
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-900/60 text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{lang === 'ar' ? 'الأكسجة SpO2' : 'SpO₂'}</span>
                    <span className="text-xl font-bold font-mono text-cyan-400 block mt-1">
                      {latestVitals.spo2 || '—'} <span className="text-[11px] font-normal text-slate-500">%</span>
                    </span>
                    {latestVitals.fio2 && (
                      <span className="text-[9px] text-slate-500 block font-mono mt-0.5">FiO₂: {latestVitals.fio2}%</span>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-900/60 text-center">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{lang === 'ar' ? 'الحرارة Temp' : 'Temp'}</span>
                    <span className="text-xl font-bold font-mono text-orange-400 block mt-1">
                      {latestVitals.temperature || '—'} <span className="text-[11px] font-normal text-slate-500">°C</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-900/60 space-y-2">
                  <Activity className="w-8 h-8 text-slate-650 mx-auto animate-pulse" />
                  <p className="text-xs text-slate-500">
                    {lang === 'ar' ? 'بانتظار قنوات الاتصال والقياس السريري...' : 'Awaiting telemetry connection stream...'}
                  </p>
                </div>
              )}

              {/* Dictation fallback dict box */}
              {settings.features?.enableVoiceNoteDictation !== false && (
                <div className="border-t border-slate-900 pt-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-350">{lang === 'ar' ? 'الإملاء الطبي الفوري والذكاء الاصطناعي' : 'ICU AI Dictation & Transcription'}</h4>
                  <VoiceNoteRecorder 
                    patientId={patient.id} 
                    bedNumber={bed.bedNumber} 
                    onTranscriptionSaved={handleSubDataUpdated} 
                  />
                </div>
              )}
            </div>

            {/* Sidebar quick parameters Card */}
            <div className="bg-[#091020]/90 border border-slate-800 rounded-3xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'ar' ? 'المعلمات والنطاقات الطبية' : 'Status & Guidelines'}</span>
              </h3>

              <div className="space-y-3 text-xs leading-normal">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="font-semibold text-slate-400">{lang === 'ar' ? 'حالة الإنعاش (Code Status)' : 'Code Status'}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    patient.codeStatus === 'DNR' 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {patient.codeStatus || 'FULL CODE'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="font-semibold text-slate-400">{lang === 'ar' ? 'مستوى الخطورة (Acuity)' : 'Acuity Level'}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-orange-400 border border-slate-800">
                    {patient.acuityLevel || 'STABLE'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-900">
                  <span className="font-semibold text-slate-400">{lang === 'ar' ? 'الوزن المثالي (IBW)' : 'Ideal Body Weight'}</span>
                  <span className="font-mono text-white font-bold">{patient.idealBodyWeightKg || '—'} kg</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && settings.features?.enableClinicalNotesCard !== false && (
          <ClinicalNotesView 
            beds={allBeds} 
            patients={allPatients} 
            onOpenAddAddendum={onOpenAddAddendum} 
          />
        )}

        {activeTab === 'antibiotics' && settings.features?.enableAntibioticsCard !== false && (
          <AntibioticsSection 
            patient={patient} 
            bed={bed} 
            settings={settings} 
            antibiotics={antibiotics} 
            labResults={labResults} 
            onDataUpdated={handleSubDataUpdated} 
            currentUser={currentUser as any} 
            readOnly={readOnly} 
          />
        )}

        {activeTab === 'labs' && settings.features?.enableLabFlowsheet !== false && (
          <LabFlowsheetSection 
            patientId={patient.id} 
            bedNumber={bed.bedNumber} 
            readOnly={readOnly} 
            onDataUpdated={handleSubDataUpdated} 
          />
        )}

        {activeTab === 'investigations' && settings.features?.enableInvestigations !== false && (
          <InvestigationsSection 
            patientId={patient.id} 
            patientName={patient.fullNameAr || patient.fullNameEn} 
            bedNumber={bed.bedNumber} 
            investigations={investigations} 
            onInvestigationAdded={handleSubDataUpdated} 
            readOnly={readOnly} 
          />
        )}
      </div>
    </div>
  );
};
