import React, { useState, useEffect } from 'react';
import { 
  BedRecord, 
  PatientDossier, 
  BedStatus, 
  BedNumber,
  IntakePathway
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

// Helper to validate and clean physician name
function getValidDoctorName(nameOrObj?: any): string | null {
  if (!nameOrObj) return null;
  const name = typeof nameOrObj === 'string'
    ? nameOrObj.trim()
    : (nameOrObj.name ? String(nameOrObj.name).trim() : null);
  if (!name) return null;
  const lower = name.toLowerCase();
  if (
    name === 'غير محدد' ||
    lower === 'unassigned' ||
    lower === 'not assigned' ||
    lower === 'unknown' ||
    lower === 'null' ||
    lower === 'undefined'
  ) {
    return null;
  }
  return name;
}

export const BedMatrixCard: React.FC<BedMatrixCardProps> = ({
  bed,
  patient,
  isSelected = false,
  onSelectBed,
  onAdmitToBed,
}) => {
  const { lang } = useTranslation();
  const { settings } = useSystemSettings();
  
  // Direct primary source from patient
  const directDoctor = getValidDoctorName(patient?.attendingPhysician);
  const [resolvedDoctor, setResolvedDoctor] = useState<string | null>(directDoctor);
  
  const hasPatient = !!patient;
  const hasPatientIsolation = !!(
    patient?.isolationPrecautions &&
    patient.isolationPrecautions.length > 0 &&
    !patient.isolationPrecautions.some(p => 
      p.toLowerCase().includes('standard') || 
      p === 'None' || 
      p === 'لا يوجد عزل' ||
      p === 'NONE'
    )
  );
  const isIsolation = hasPatient && (
    hasPatientIsolation ||
    (bed.status === BedStatus.ISOLATION && (bed.isolation?.isIsolated ?? false) && (bed.isolation?.precautions?.length ?? 0) > 0)
  );
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

  const getPathwayArLabel = (pathway?: IntakePathway) => {
    switch (pathway) {
      case IntakePathway.STAT_CRITICAL: return lang === 'ar' ? 'طوارئ' : 'ER / Stat';
      case IntakePathway.ELECTIVE_POST_OP: return lang === 'ar' ? 'عمليات' : 'OR / Post-Op';
      case IntakePathway.FLOOR_TRANSFER: return lang === 'ar' ? 'قسم داخلي' : 'Ward';
      case IntakePathway.ER_REFERRAL: return lang === 'ar' ? 'طوارئ' : 'ER Ref';
      default: return pathway || (lang === 'ar' ? 'طوارئ' : 'ER');
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchPhysician() {
      if (!patient?.id) {
        if (isMounted) setResolvedDoctor(null);
        return;
      }

      try {
        // 1. Primary Source: Latest SBAR Handover linked to patientId (Current Active Physician on Duty)
        const sbars = await db.sbarHandovers
          .where('patientId')
          .equals(patient.id)
          .toArray();
        
        if (sbars && sbars.length > 0) {
          sbars.sort((a, b) => 
            new Date(b.incomingDoctor?.signedAt || b.outgoingDoctor?.signedAt || b.shiftDate || 0).getTime() - 
            new Date(a.incomingDoctor?.signedAt || a.outgoingDoctor?.signedAt || a.shiftDate || 0).getTime()
          );
          const latest = sbars[0];
          // If the shift was acknowledged by the incoming doctor, they are the active physician on duty
          // Otherwise, if still pending receipt, show the outgoing doctor who handed over the shift
          const activeSbarDoctor = latest?.incomingDoctor?.signedAt
            ? getValidDoctorName(latest.incomingDoctor)
            : (getValidDoctorName(latest?.outgoingDoctor) || getValidDoctorName(latest?.incomingDoctor));
          
          if (activeSbarDoctor) {
            if (isMounted) setResolvedDoctor(activeSbarDoctor);
            return;
          }
        }

        // 2. Secondary Source: patient.attendingPhysician?.name
        const primaryDoc = getValidDoctorName(patient.attendingPhysician);
        if (primaryDoc) {
          if (isMounted) setResolvedDoctor(primaryDoc);
          return;
        }

        // 3. Fallback: Latest Clinical Note linked to patientId -> authorName
        const notes = await db.clinicalNotes
          .where('patientId')
          .equals(patient.id)
          .toArray();

        if (notes && notes.length > 0) {
          notes.sort((a, b) => 
            new Date(b.timestamp || (b as any).createdAt || 0).getTime() - 
            new Date(a.timestamp || (a as any).createdAt || 0).getTime()
          );
          const latestNote = notes[0];
          const noteDoctor = getValidDoctorName(latestNote?.authorName) || getValidDoctorName((latestNote as any)?.createdByName);
          if (noteDoctor) {
            if (isMounted) setResolvedDoctor(noteDoctor);
            return;
          }
        }

        // 4. Final Fallback
        const fallback = getValidDoctorName(patient.attendingPhysician);
        if (isMounted) setResolvedDoctor(fallback || null);
      } catch (err) {
        const fallback = getValidDoctorName(patient.attendingPhysician);
        if (isMounted) setResolvedDoctor(fallback || null);
      }
    }

    fetchPhysician();

    const handleSyncEvent = () => {
      fetchPhysician();
    };

    window.addEventListener('icu-data-updated', handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);

    return () => { 
      isMounted = false; 
      window.removeEventListener('icu-data-updated', handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
    };
  }, [patient?.id, patient?.attendingPhysician?.name, patient?.attendingPhysician, lang]);

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
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between p-5 sm:p-6 min-h-[170px] sm:min-h-[190px] md:min-h-[210px] shadow-sm cursor-pointer hover:scale-[1.01] hover:shadow-md icu-card-interactive ${
        isSelected
          ? isIsolation
            ? 'icu-card-active ring-2 ring-amber-500 border-amber-500 bg-amber-500/10 dark:bg-gradient-to-b dark:from-[#3a2007] dark:to-[#1a0e03] shadow-amber-950/40 text-amber-950 dark:text-amber-200'
            : isUnavailable
            ? 'icu-card-active ring-2 ring-red-500 border-red-500 bg-red-500/10 dark:bg-red-950/20 text-red-950 dark:text-red-300'
            : 'icu-card-active ring-2 ring-teal-500 shadow-xl border-teal-500 bg-slate-200/90 dark:bg-[#1e2e4e]'
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
      <div className="flex items-center justify-between gap-4 w-full">
        {/* Bed Number Badge/Pill */}
        <div className={`h-10 px-3.5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-1.5 shadow-sm border ${
          isUnavailable
            ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50'
            : isIsolation
            ? 'bg-amber-500 text-slate-950 border-amber-600 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400 font-extrabold animate-pulse'
            : isOccupied 
            ? 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30'
            : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
        }`}>
          <span>{lang === 'ar' ? 'سرير' : 'Bed'} {bed.bedNumber}</span>
          {isSelected && (
            <span className="text-[10px] uppercase font-black px-1.5 py-0.2 rounded bg-white/30 text-slate-950 dark:text-white">
              {lang === 'ar' ? 'مفتوح' : 'OPEN'}
            </span>
          )}
        </div>

        {/* Dynamic Status Label + Intake Pathway */}
        <div className="flex items-center gap-2">
          {/* Intake Pathway "مسار الدخول للقسم" (Only if patient is present) */}
          {hasPatient && patient.intakePathway && (
            <span className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-md text-[11px] font-bold">
              {getPathwayArLabel(patient.intakePathway)}
            </span>
          )}

          {/* Bed Status Badge (مشغول أو عزل أو صيانة أو شاغر) */}
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
            isIsolation
              ? 'bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-400 flex items-center gap-1'
              : isUnavailable
              ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-400 dark:border-red-900/40'
              : isDecontaminating
              ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-400'
              : isOccupied
              ? 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-400'
              : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {isIsolation ? (
              <>
                <ShieldAlert className="w-3 h-3 shrink-0 inline-block align-middle" />
                <span className="align-middle">{lang === 'ar' ? 'عزل' : 'Isolation'}</span>
              </>
            ) : isUnavailable ? (
              <span>{lang === 'ar' ? 'صيانة' : 'Maintenance'}</span>
            ) : isDecontaminating ? (
              <span>{lang === 'ar' ? 'تعقيم' : 'Cleaning'}</span>
            ) : isOccupied ? (
              <span>{lang === 'ar' ? 'مشغول' : 'Occupied'}</span>
            ) : (
              <span>{lang === 'ar' ? 'شاغر' : 'Vacant'}</span>
            )}
          </span>
        </div>
      </div>

      {/* Patient Name, Age Badge, Diagnosis & Handover Physician */}
      <div className="mt-4 pt-3.5 border-t border-slate-200/60 dark:border-slate-800/80">
        {isOccupied || isTransferPending ? (
          <div className="space-y-3.5">
            {/* Patient Name + Age Badge - Fully utilizing the entire horizontal space */}
            <div className="flex items-center justify-between w-full gap-4">
              <h2 className="text-lg xs:text-xl sm:text-2xl md:text-[22px] font-black text-slate-900 dark:text-white leading-snug truncate flex-1 tracking-tight">
                {patientName || (lang === 'ar' ? 'مريض بدون اسم' : 'Unnamed Patient')}
              </h2>
              {patient?.age !== undefined && patient?.age !== null && (
                <div 
                  className="inline-flex items-center justify-center min-w-[2.5rem] sm:min-w-[3.25rem] h-7 sm:h-8.5 px-3 rounded-xl font-mono text-xs xs:text-sm sm:text-base font-black bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-500/30 dark:border-teal-500/20 shadow-sm shrink-0"
                  title={lang === 'ar' ? `العمر: ${patient.age} سنة` : `Age: ${patient.age} years`}
                >
                  {patient.age}{lang === 'ar' ? ' س' : 'y'}
                </div>
              )}
            </div>

            {/* Diagnosis & Physician (Merged in a single spacious spaced-out row) */}
            <div className="flex items-center justify-between gap-4 w-full text-xs xs:text-sm sm:text-base pt-3 border-t border-slate-200/40 dark:border-slate-800/40">
              {/* Diagnosis */}
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold min-w-0 flex-1">
                <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate text-[13px] sm:text-sm md:text-[15px]" title={diagnosisText}>
                  {diagnosisText || (lang === 'ar' ? 'بدون تشخيص' : 'No diagnosis')}
                </span>
              </div>

              {/* Physician */}
              <div 
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold min-w-0 shrink-0" 
                title={lang === 'ar' ? `الطبيب: ${resolvedDoctor || 'غير محدد'}` : `Physician: ${resolvedDoctor || 'Unassigned'}`}
              >
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate text-[13px] sm:text-sm md:text-[15px]">
                  {resolvedDoctor || (lang === 'ar' ? 'غير محدد' : 'Unassigned')}
                </span>
              </div>
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
