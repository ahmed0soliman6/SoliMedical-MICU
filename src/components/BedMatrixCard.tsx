import React from 'react';
import { 
  Heart, 
  Wind, 
  Droplet, 
  AlertTriangle, 
  ShieldAlert, 
  Plus, 
  Activity,
  ArrowUpRight,
  Sparkles,
  Lock,
  Phone,
  Calendar,
  UserCheck,
  Fingerprint
} from 'lucide-react';
import { 
  BedRecord, 
  PatientDossier, 
  TelemetryVitals, 
  VentilatorParameters, 
  InfusionPumpLine,
  BedStatus,
  AcuityLevel,
  CodeStatus,
  BedNumber
} from '../types/schema.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface BedMatrixCardProps {
  bed: BedRecord;
  patient?: PatientDossier | null;
  latestVitals?: TelemetryVitals | null;
  ventilator?: VentilatorParameters | null;
  pumps?: InfusionPumpLine[];
  onSelectBed: (bedNumber: BedNumber) => void;
  onOpenQuickVitals: (bedNumber: BedNumber, patientId: string) => void;
  onAdmitToBed: (bedNumber: BedNumber) => void;
}

export const BedMatrixCard: React.FC<BedMatrixCardProps> = ({
  bed,
  patient,
  latestVitals,
  ventilator,
  pumps = [],
  onSelectBed,
  onOpenQuickVitals,
  onAdmitToBed,
}) => {
  const { settings } = useSystemSettings();
  const { t, lang, isRTL } = useTranslation();
  
  const isIsolation = bed.status === BedStatus.ISOLATION || (bed.isolation?.isIsolated ?? false);
  const isUnavailable = bed.status === BedStatus.UNAVAILABLE;
  const isOccupied = (bed.status === BedStatus.OCCUPIED || isIsolation) && !!patient;
  const isTransferPending = bed.status === BedStatus.TRANSFER_PENDING && !!patient;
  const isDecontaminating = bed.status === BedStatus.DECONTAMINATING;
  const isVacant = (bed.status === BedStatus.VACANT || (!patient && !isDecontaminating && !isUnavailable && !isIsolation));

  // Acuity Styling
  const isCriticalStat = settings.features.enableAcuityLevels && patient?.acuityLevel === AcuityLevel.CRITICAL_STAT;
  const isDnr = settings.features.enableCodeStatus && patient?.codeStatus === CodeStatus.DNR;

  // MAP calculation & warning
  const map = latestVitals?.meanArterialPressureMmHg ?? 
    (latestVitals ? Math.round(latestVitals.diastolicBpMmHg + (latestVitals.systolicBpMmHg - latestVitals.diastolicBpMmHg) / 3) : 0);
  const isLowMap = isOccupied && latestVitals && map < 65;

  // Active running pumps
  const activePumps = (pumps || []).filter(p => p && (p.status === 'RUNNING' || p.status === 'TITRATING'));

  return (
    <div 
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xl ${
        isCriticalStat
          ? 'bg-gradient-to-b from-[#11192e] to-[#0a101f] border-red-500/40 shadow-red-950/20 ring-1 ring-red-500/30'
          : isUnavailable
          ? 'bg-[#100f1a] border-red-900/50 opacity-90'
          : isIsolation
          ? 'bg-gradient-to-b from-[#1c1409] to-[#0f0c08] border-amber-600/60 shadow-amber-950/20'
          : isTransferPending
          ? 'bg-[#0f172a] border-amber-500/40'
          : isDecontaminating
          ? 'bg-[#0c1222] border-purple-500/30'
          : isOccupied
          ? 'bg-gradient-to-b from-[#0f172c] to-[#090e1a] border-slate-700/80 hover:border-teal-500/50'
          : 'bg-[#0a0f1d] border-slate-800/60'
      }`}
    >
      {/* Top Card Header */}
      <div className="p-3.5 pb-2.5 border-b border-slate-800/60">
        <div className="flex items-center justify-between gap-2">
          {/* Bed Number & Bay Label */}
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl font-mono font-black text-sm flex items-center justify-center shadow-md ${
              isCriticalStat 
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : isUnavailable
                ? 'bg-red-950 text-red-400 border border-red-800'
                : isIsolation
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : isOccupied 
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {bed.bedNumber}
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>{lang === 'ar' ? `سرير ${bed.bedNumber}` : `Bed ${bed.bedNumber}`}</span>
                {isIsolation && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    {lang === 'ar' ? 'عزل' : 'ISOLATION'}
                  </span>
                )}
                {isUnavailable && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/40 font-bold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    {lang === 'ar' ? 'غير متاح' : 'UNAVAILABLE'}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[130px] sm:max-w-[170px]">
                {bed.bayName}
              </div>
            </div>
          </div>

          {/* Status & Code Badges */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {isOccupied && settings.features.enableCodeStatus && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono uppercase tracking-wider ${
                isDnr 
                  ? 'bg-purple-950 text-purple-300 border border-purple-700'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
              }`}>
                {patient?.codeStatus}
              </span>
            )}

            {isCriticalStat && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-950 text-red-400 border border-red-700/80 flex items-center gap-1 animate-pulse">
                <ShieldAlert className="w-3 h-3" />
                <span>STAT</span>
              </span>
            )}

            {isIsolation && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-600/70 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>{lang === 'ar' ? 'عزل طبي' : 'Isolation'}</span>
              </span>
            )}

            {isUnavailable && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-950/80 text-red-300 border border-red-800 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>{lang === 'ar' ? 'غير متاح' : 'Unavailable'}</span>
              </span>
            )}

            {isTransferPending && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-700">
                {lang === 'ar' ? 'جاهز للنقل' : 'Transfer Pending'}
              </span>
            )}

            {isDecontaminating && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800">
                {lang === 'ar' ? 'قيد التطهير' : 'Decontaminating'}
              </span>
            )}

            {isVacant && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                {lang === 'ar' ? 'شاغر' : 'Vacant'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Body: Patient Information, Unavailable notice, or Vacant Prompt */}
      <div className="p-3.5 space-y-3 flex-1">
        {isOccupied || isTransferPending ? (
          <>
            {/* Patient Name & Primary Diagnosis */}
            <div>
              <div className="flex items-baseline justify-between gap-1">
                <h2 className="text-sm sm:text-base font-bold text-white truncate hover:text-teal-300 transition-colors">
                  {patient?.fullNameAr || patient?.fullNameEn}
                </h2>
                <span className="text-[11px] font-mono text-slate-400 font-semibold flex-shrink-0">
                  #{patient?.mrn}
                </span>
              </div>
              
              <div className="text-[11px] text-slate-300 line-clamp-1 mt-0.5" title={patient?.primaryDiagnosisEn}>
                {lang === 'ar' ? (patient?.primaryDiagnosisAr || patient?.primaryDiagnosisEn) : (patient?.primaryDiagnosisEn || patient?.primaryDiagnosisAr)}
              </div>

              {/* Patient Core Metadata Required by CBAHI / Specs */}
              <div className="text-[10px] text-slate-400 mt-1.5 space-y-1 bg-slate-900/40 p-2 rounded-xl border border-slate-800/60 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Fingerprint className="w-3 h-3 text-teal-400" />
                    <span>ID:</span>
                  </span>
                  <span className="text-teal-300 font-semibold truncate max-w-[170px]" title={patient?.id}>
                    {patient?.id}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span>{patient?.age} {lang === 'ar' ? 'سنة' : 'yo'} • {patient?.gender === 'MALE' ? (lang === 'ar' ? 'ذكر' : 'Male') : (lang === 'ar' ? 'أنثى' : 'Female')}</span>
                  </span>
                  <span className="text-slate-300 flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5 text-slate-400" />
                    <span>{patient?.phoneNumber || patient?.nationalId || '—'}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-[9px] pt-0.5 border-t border-slate-800/60">
                  <span className="text-slate-400 truncate max-w-[130px]" title={patient?.attendingPhysician?.name}>
                    {lang === 'ar' ? 'الطبيب: ' : 'MD: '}{patient?.attendingPhysician?.name || '—'}
                  </span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5 text-slate-400" />
                    <span>{patient?.admissionDate ? new Date(patient.admissionDate).toLocaleDateString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Vital Signs Barometer Grid */}
            {settings.features.enableTelemetryVitals && (
              latestVitals ? (
                <div className="grid grid-cols-4 gap-1.5 bg-[#070c17] p-2 rounded-xl border border-slate-800/80 font-mono text-center">
                  {/* MAP & BP */}
                  <div className={`p-1 rounded-lg ${isLowMap ? 'bg-red-950/60 border border-red-500/50' : 'bg-slate-900/60'}`}>
                    <div className="text-[9px] text-slate-400">MAP / BP</div>
                    <div className={`text-xs font-bold ${isLowMap ? 'text-red-400 font-black' : 'text-cyan-300'}`}>
                      {map}
                    </div>
                    <div className="text-[8px] text-slate-400 truncate">
                      {latestVitals.systolicBpMmHg}/{latestVitals.diastolicBpMmHg}
                    </div>
                  </div>

                  {/* Heart Rate */}
                  <div className="p-1 rounded-lg bg-slate-900/60">
                    <div className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                      <Heart className="w-2.5 h-2.5 text-red-400" />
                      <span>HR</span>
                    </div>
                    <div className="text-xs font-bold text-emerald-400">
                      {latestVitals.heartRateBpm}
                    </div>
                    <div className="text-[8px] text-slate-400 truncate">
                      {latestVitals.heartRhythm.split(' ')[0]}
                    </div>
                  </div>

                  {/* SpO2 & FiO2 */}
                  <div className="p-1 rounded-lg bg-slate-900/60">
                    <div className="text-[9px] text-slate-400">SpO₂/FiO₂</div>
                    <div className="text-xs font-bold text-teal-300">
                      {latestVitals.spo2Percent}%
                    </div>
                    <div className="text-[8px] text-slate-400">
                      {latestVitals.fio2SuppliedPercent}% Fi
                    </div>
                  </div>

                  {/* GCS / RASS */}
                  <div className="p-1 rounded-lg bg-slate-900/60">
                    <div className="text-[9px] text-slate-400">GCS/RASS</div>
                    <div className="text-xs font-bold text-indigo-300">
                      {latestVitals.gcsTotalScore}/15
                    </div>
                    <div className="text-[8px] text-slate-400">
                      {latestVitals.sedationRassScore !== undefined ? `RASS ${latestVitals.sedationRassScore}` : 'Alert'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#070c17] p-2.5 rounded-xl border border-slate-800 text-center text-xs text-slate-500 font-mono">
                  {lang === 'ar' ? 'في انتظار أول قراءة للعلامات الحيوية...' : 'Awaiting initial telemetry stream...'}
                </div>
              )
            )}

            {/* Inotropes & Mechanical Ventilation Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {settings.features.enableVentilatorParameters && ventilator && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-700/60 text-[10px] text-cyan-300 font-mono">
                  <Wind className="w-3 h-3 text-cyan-400" />
                  <span>{ventilator.mode}</span>
                  <span className="text-slate-400">| PEEP {ventilator.peepCmH2O}</span>
                </div>
              )}

              {settings.features.enableInfusionPumps && activePumps.map((pump) => (
                <div 
                  key={pump.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-700/60 text-[10px] text-amber-300 font-mono"
                  title={`${pump.drugNameEn} @ ${pump.currentRate} ${pump.rateUnit}`}
                >
                  <Droplet className="w-2.5 h-2.5 text-amber-400" />
                  <span className="font-semibold">{pump.drugNameEn.split(' ')[0]}</span>
                  <span className="text-slate-400">({pump.currentRate})</span>
                </div>
              ))}

              {patient?.isolationPrecautions && patient.isolationPrecautions.length > 0 && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-950/50 border border-red-800/40 text-[9px] text-red-300">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                  <span>{lang === 'ar' ? `عزل: ${patient.isolationPrecautions[0]}` : `Isolation: ${patient.isolationPrecautions[0]}`}</span>
                </div>
              )}
            </div>
          </>
        ) : isDecontaminating ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 animate-pulse">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-purple-300">
              {lang === 'ar' ? 'السرير قيد التعقيم والتطهير الشامل' : 'Decontamination in progress'}
            </div>
            <p className="text-[10px] text-slate-400 max-w-[200px]">
              {lang === 'ar' 
                ? 'تجهيز الفلتر المركزي، أنابيب الشفط ومضخات الحقن لاستقبال مريض جديد'
                : 'Terminal cleaning, central HEPA filter & suction prep in progress'}
            </p>
          </div>
        ) : isUnavailable ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <Lock className="w-5 h-5" />
            </div>
            <div className="text-xs font-bold text-red-300">
              {lang === 'ar' ? 'السرير غير متاح حالياً (خارج الخدمة)' : 'Bed Currently Unavailable'}
            </div>
            <p className="text-[10px] text-slate-400 max-w-[210px]">
              {lang === 'ar' 
                ? 'السرير مغلق للصيانة أو لإجراءات التطهير/العزل الطبي.'
                : 'Bed taken out of rotation for maintenance or biocontainment.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-300">
                {lang === 'ar' ? 'السرير شاغر وجاهز للاستقبال' : 'Bed Available for Admission'}
              </div>
              <p className="text-[10px] text-slate-500">
                {lang === 'ar' ? 'جهاز التنفس والمونيتور تمت معايرتهما' : 'Ventilator & bedside telemetry calibrated'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="p-2.5 bg-[#080d19] border-t border-slate-800/60 flex items-center gap-1.5">
        {isOccupied || isTransferPending ? (
          <>
            {/* Open Full Bedside Flowsheet */}
            <button
              onClick={() => onSelectBed(bed.bedNumber)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <span>{lang === 'ar' ? 'ملف السرير' : 'Flowsheet'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            {/* Quick Vitals Ingestion */}
            {settings.features.enableTelemetryVitals && (
              <button
                onClick={() => onOpenQuickVitals(bed.bedNumber, patient?.id || '')}
                className="flex items-center justify-center p-2 rounded-xl bg-[#0e172a] hover:bg-[#1e293b] text-slate-300 border border-slate-700 text-xs transition-all active:scale-95 cursor-pointer"
                title={lang === 'ar' ? 'تسجيل علامات حيوية سريعة' : 'Record quick vitals'}
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            )}
          </>
        ) : isUnavailable ? (
          <button
            onClick={() => onSelectBed(bed.bedNumber)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-red-400" />
            <span>{lang === 'ar' ? 'عرض السرير / إدارة الحالة' : 'Manage Bed Status'}</span>
          </button>
        ) : (
          settings.features.enableAdmissions && (
            <button
              onClick={() => onAdmitToBed(bed.bedNumber)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>{lang === 'ar' ? 'إدخال مريض لهذا السرير' : 'Admit Patient'}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
};

