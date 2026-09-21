import React, { useState, useEffect } from 'react';
import { 
  BedRecord, 
  PatientDossier, 
  BedStatus, 
  BedNumber 
} from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { Stethoscope, UserCheck, Activity, Wrench, ShieldAlert } from 'lucide-react';

interface BedMatrixCardProps {
  bed: BedRecord;
  patient?: PatientDossier | null;
  isSelected?: boolean;
  onSelectBed: (bedNumber: BedNumber) => void;
  onAdmitToBed: (bedNumber: BedNumber) => void;
}

export const BedMatrixCard: React.FC<BedMatrixCardProps> = ({
  bed,
  patient,
  isSelected = false,
  onSelectBed,
  onAdmitToBed,
}) => {
  const { lang } = useTranslation();
  const [lastHandoverDoctor, setLastHandoverDoctor] = useState<string | null>(null);
  
  const hasPatient = !!patient;
  const isIsolation = (bed.status === BedStatus.ISOLATION || (bed.isolation?.isIsolated ?? false)) && hasPatient;
  const isUnavailable = bed.status === BedStatus.UNAVAILABLE && !hasPatient;
  const isOccupied = hasPatient && !isUnavailable;
  const isTransferPending = bed.status === BedStatus.TRANSFER_PENDING && hasPatient;

  // Check decontamination timer (max 30 minutes = 1800000ms)
  const lastCleanedTime = bed.lastCleanedAt ? new Date(bed.lastCleanedAt).getTime() : 0;
  const elapsedMs = Date.now() - lastCleanedTime;
  const thirtyMinMs = 30 * 60 * 1000;
  const isDeconExpired = !bed.lastCleanedAt || elapsedMs >= thirtyMinMs;
  const remainingMinutes = Math.max(0, Math.ceil((thirtyMinMs - elapsedMs) / 60000));

  const isDecontaminating = !hasPatient && bed.status === BedStatus.DECONTAMINATING && !isDeconExpired;
  const isVacant = !hasPatient && !isUnavailable && !isDecontaminating && !isIsolation;

  useEffect(() => {
    let isMounted = true;
    async function fetchLastHandover() {
      if (!patient?.id) {
        setLastHandoverDoctor(null);
        return;
      }
      try {
        const sbars = await db.sbarHandovers
          .where('patientId')
          .equals(patient.id)
          .toArray();
        
        if (sbars && sbars.length > 0) {
          sbars.sort((a, b) => new Date(b.outgoingDoctor?.signedAt || b.shiftDate || 0).getTime() - new Date(a.outgoingDoctor?.signedAt || a.shiftDate || 0).getTime());
          const latest = sbars[0];
          if (latest?.outgoingDoctor?.name && isMounted) {
            setLastHandoverDoctor(latest.outgoingDoctor.name);
            return;
          }
        }

        if (isMounted) {
          const attName = patient?.attendingPhysician?.name || '';
          if (attName && !attName.includes('هشام طلعت')) {
            setLastHandoverDoctor(attName);
          } else {
            setLastHandoverDoctor(null);
          }
        }
      } catch (e) {
        if (isMounted) setLastHandoverDoctor(null);
      }
    }
    fetchLastHandover();
    return () => { isMounted = false; };
  }, [patient?.id, patient?.attendingPhysician?.name]);

  const handleClick = () => {
    if (isOccupied || isTransferPending || isUnavailable || isDecontaminating || isIsolation) {
      onSelectBed(bed.bedNumber);
    } else {
      onAdmitToBed(bed.bedNumber);
    }
  };

  const patientName = patient
    ? (lang === 'ar' ? (patient.fullNameAr || patient.fullNameEn) : (patient.fullNameEn || patient.fullNameAr))
    : '';

  const diagnosisText = patient
    ? (lang === 'ar' 
        ? (patient.primaryDiagnosisAr || patient.primaryDiagnosisEn) 
        : (patient.primaryDiagnosisEn || patient.primaryDiagnosisAr))
    : '';

  return (
    <div 
      onClick={handleClick}
      data-card-open={isSelected ? "true" : "false"}
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between p-4 min-h-[135px] shadow-sm cursor-pointer hover:scale-[1.01] hover:shadow-md icu-card-interactive ${
        isSelected
          ? 'icu-card-active ring-2 ring-teal-500 shadow-xl border-teal-500 bg-slate-200/90 dark:bg-[#202f50]'
          : isUnavailable
          ? 'bg-rose-50/80 border-rose-200 text-rose-950 dark:bg-[#100f1a] dark:border-red-900/50 dark:text-red-300 opacity-90'
          : isIsolation
          ? 'bg-amber-500/10 border-2 border-amber-500 text-amber-950 shadow-md shadow-amber-500/15 dark:bg-gradient-to-b dark:from-[#2a1705] dark:to-[#140b02] dark:border-amber-500 dark:text-amber-200 dark:shadow-amber-950/40 ring-1 ring-amber-500/50'
          : isTransferPending
          ? 'bg-amber-50/70 border-amber-300 text-amber-950 dark:bg-[#0f172a] dark:border-amber-500/40'
          : isDecontaminating
          ? 'bg-purple-50/80 border-purple-200 text-purple-950 dark:bg-[#0c1222] dark:border-purple-500/30'
          : isOccupied
          ? 'bg-slate-50 border-slate-300 hover:border-slate-400 dark:bg-gradient-to-b dark:from-[#0f172c] dark:to-[#090e1a] dark:border-slate-700/80 dark:hover:border-teal-500/50'
          : 'bg-slate-50/90 border-slate-300 hover:border-slate-400 dark:bg-[#0a0f1d] dark:border-slate-800/60 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Bed Number / Status */}
        <div className="flex items-center gap-2.5">
          <div className={`w-12 h-12 rounded-xl font-mono font-black text-xl flex items-center justify-center shadow-sm ${
            isUnavailable
              ? 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
              : isIsolation
              ? 'bg-amber-500 text-slate-950 border-2 border-amber-600 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400 font-black animate-pulse shadow-sm'
              : isOccupied 
              ? 'bg-teal-50 text-teal-700 border border-teal-300 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40'
              : 'bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
          }`}>
            {bed.bedNumber}
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-1.5">
              <span>{lang === 'ar' ? `سرير ${bed.bedNumber}` : `Bed ${bed.bedNumber}`}</span>
              {isSelected && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 dark:bg-teal-500/30 dark:text-teal-200 border border-teal-300 dark:border-teal-400">
                  {lang === 'ar' ? 'مفتوح' : 'OPEN'}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
              {bed.bayName}
            </div>
          </div>
        </div>

        {/* Dynamic Status Label */}
        <div className="flex items-center gap-1.5">
          <div className="text-xs font-bold px-2 py-0.5 rounded-md font-mono">
            {isIsolation && (
              <span className="bg-amber-500 text-slate-950 font-black border border-amber-600 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-300 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'ar' ? 'عزل سريري' : 'ISOLATION'}</span>
              </span>
            )}
            {isUnavailable && !isIsolation && (
              <span className="bg-red-100 text-red-800 border border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800 px-1.5 py-0.5 rounded">
                {lang === 'ar' ? 'غير متاح' : 'Unavailable'}
              </span>
            )}
            {isTransferPending && !isIsolation && (
              <span className="bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded">
                {lang === 'ar' ? 'نقل معلق' : 'Transfer Pending'}
              </span>
            )}
            {isDecontaminating && !isIsolation && (
              <span className="bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800 px-1.5 py-0.5 rounded">
                {lang === 'ar' ? 'تطهير' : 'Cleaning'}
              </span>
            )}
            {isVacant && (
              <span className="bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 px-1.5 py-0.5 rounded">
                {lang === 'ar' ? 'شاغر' : 'Vacant'}
              </span>
            )}
            {isOccupied && !isIsolation && (
              <span className="bg-teal-100 text-teal-800 border border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800 px-1.5 py-0.5 rounded">
                {lang === 'ar' ? 'مشغول' : 'Occupied'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Patient Name, Age Badge, Diagnosis & Handover Physician */}
      <div className="mt-3.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
        {isOccupied || isTransferPending ? (
          <div className="space-y-1.5">
            {/* Patient Name + Distinctive Age Badge directly next to name */}
            <div className="flex items-center justify-start gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug truncate">
                {patientName || (lang === 'ar' ? 'مريض بدون اسم' : 'Unnamed Patient')}
              </h2>
              {patient?.age !== undefined && patient?.age !== null && (
                <div 
                  className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full font-mono text-xs font-black bg-teal-100 text-teal-900 border border-teal-300 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-500/50 shadow-sm shrink-0"
                  title={lang === 'ar' ? `العمر: ${patient.age} سنة` : `Age: ${patient.age} years`}
                >
                  {patient.age}{lang === 'ar' ? 'س' : 'y'}
                </div>
              )}
            </div>

            {/* Diagnosis & Handover Doctor (Only if handover exists) */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs pt-0.5">
              {/* Diagnosis */}
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium min-w-0 max-w-full">
                <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate" title={diagnosisText}>
                  {diagnosisText || (lang === 'ar' ? 'بدون تشخيص' : 'No diagnosis')}
                </span>
              </div>

              {/* Handover Physician (Only shown if real handover signed) */}
              {lastHandoverDoctor && (
                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300 text-[11px] font-semibold shrink-0" title={lang === 'ar' ? `طبيب التسليم: ${lastHandoverDoctor}` : `Handover: ${lastHandoverDoctor}`}>
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="truncate max-w-[150px]">
                    {lastHandoverDoctor}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : isDecontaminating ? (
          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center justify-between gap-1">
            <span className="truncate">{lang === 'ar' ? 'قيد التعقيم والتطهير الشامل' : 'Decontamination in progress'}</span>
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 rounded border border-purple-300 dark:border-purple-800 shrink-0">
              {lang === 'ar' ? `متبقي ${remainingMinutes} دقيقة` : `${remainingMinutes}m left`}
            </span>
          </div>
        ) : isUnavailable ? (
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span>{lang === 'ar' ? 'خارج الخدمة حالياً (صيانة / تعقيم)' : 'Out of Service (Maintenance)'}</span>
          </div>
        ) : (
          <div className="text-xs font-semibold text-teal-600 dark:text-teal-500/80">
            {lang === 'ar' ? '+ اضغط لتسجيل مريض جديد' : '+ Click to Admit Patient'}
          </div>
        )}
      </div>
    </div>
  );
};
