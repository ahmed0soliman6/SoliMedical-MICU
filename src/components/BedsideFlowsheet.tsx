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
  Scale
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
  DispositionType
} from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { dischargeOrTransferPatient } from '../services/dataModel.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';

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
  const [activeTab, setActiveTab] = useState<'vitals' | 'vent' | 'pumps' | 'fluids' | 'sbar' | 'notes' | 'disposition'>('vitals');
  
  const [vitalsHistory, setVitalsHistory] = useState<TelemetryVitals[]>([]);
  const [ventilator, setVentilator] = useState<VentilatorParameters | null>(null);
  const [pumps, setPumps] = useState<InfusionPumpLine[]>([]);
  const [fluidBalance, setFluidBalance] = useState<FluidBalance24H | null>(null);
  const [sbarList, setSbarList] = useState<SbarHandoverReport[]>([]);
  const [notesList, setNotesList] = useState<ClinicalNote[]>([]);

  // Disposition form state
  const [dispType, setDispType] = useState<DispositionType>(DispositionType.TRANSFER_GENERAL_WARD);
  const [dispSummary, setDispSummary] = useState<string>('Patient stabilized and transferred to High Dependency Unit (HDU).');
  const [physicianSign, setPhysicianSign] = useState<string>('Dr. Hesham Talaat');

  useEffect(() => {
    loadBedsideData();
  }, [bed.bedNumber, patient.id]);

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
  };

  const latestVitals = vitalsHistory[0] || null;

  // Ventilator Driving Pressure & PF Ratio Calculations
  const drivingPressure = (ventilator?.plateauPressureCmH2O && ventilator?.peepCmH2O)
    ? ventilator.plateauPressureCmH2O - ventilator.peepCmH2O
    : null;

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

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto pb-1 text-xs font-semibold">
          {[
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
