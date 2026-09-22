import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Calendar,
  Lock,
  Check
} from 'lucide-react';
import { BedRecord, BedStatus, BedIsolationInfo, PatientDossier } from '../types/schema.ts';
import { db, ensureBedPatientSync } from '../db/icuSyncDb.ts';
import { syncBedToCloud, syncPatientToCloud } from '../services/firebase.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAppNotifications } from '../services/NotificationContext.tsx';

interface BedIsolationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bed?: BedRecord;
  patient?: PatientDossier | null;
  onSuccess?: () => void;
  onUpdated?: () => void;
}

const PRECAUTION_OPTIONS = [
  { id: 'n95', labelAr: 'كمامة N95 عالية الكفاءة', labelEn: 'N95 Respirator' },
  { id: 'gloves', labelAr: 'قفازات طبية معقمة', labelEn: 'Medical Gloves' },
  { id: 'gown', labelAr: 'مريول وقائي عازل', labelEn: 'Isolation Gown' },
  { id: 'eye', labelAr: 'واقي للعينين / قناع وجه', labelEn: 'Eye Protection / Face Shield' },
  { id: 'neg_pressure', labelAr: 'غرفة ضغط سلبي', labelEn: 'Negative Pressure Bay' },
  { id: 'dedicated_gear', labelAr: 'أدوات وفحوصات مخصصة فقط للسرير', labelEn: 'Dedicated Equipment Only' },
];

export const BedIsolationModal: React.FC<BedIsolationModalProps> = ({
  isOpen,
  onClose,
  bed,
  patient,
  onSuccess,
  onUpdated,
}) => {
  const { lang, isRTL } = useTranslation();
  const { triggerNotification } = useAppNotifications();

  const activeBedSessionRef = useRef<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<BedStatus>(bed?.status || BedStatus.VACANT);
  const [isIsolated, setIsIsolated] = useState<boolean>(
    bed ? (bed.status === BedStatus.ISOLATION || bed.isolation?.isIsolated || false) : false
  );
  const [isolationType, setIsolationType] = useState<string>(bed?.isolation?.type || 'Airborne');
  const [reason, setReason] = useState<string>(bed?.isolation?.reason || '');
  const [startDate, setStartDate] = useState<string>(
    bed?.isolation?.startDate || new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(bed?.isolation?.endDate || '');
  const [precautions, setPrecautions] = useState<string[]>(
    bed?.isolation?.precautions || ['n95', 'gloves', 'gown']
  );
  const [notes, setNotes] = useState<string>(bed?.isolation?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state cleanly whenever the modal opens
  useEffect(() => {
    if (isOpen && bed) {
      const hasPatientPrecautions = !!(
        patient?.isolationPrecautions &&
        patient.isolationPrecautions.length > 0 &&
        !patient.isolationPrecautions.some(p => p.toLowerCase().includes('standard') || p === 'None' || p === 'لا يوجد عزل' || p === 'NONE')
      );
      const wasCurrentlyIsolated = bed.status === BedStatus.ISOLATION || !!(bed.isolation && bed.isolation.isIsolated) || hasPatientPrecautions;
      
      // Fast Action Workflow:
      // - If bed was isolated, user clicked "إنهاء العزل" -> initialize in End Isolation mode (isIsolated = false)
      // - If bed was not isolated, user clicked "عزل" -> initialize in Isolation mode (isIsolated = true)
      const targetIsolateAction = !wasCurrentlyIsolated;
      
      setSelectedStatus(targetIsolateAction ? BedStatus.ISOLATION : (patient ? BedStatus.OCCUPIED : BedStatus.VACANT));
      setIsIsolated(targetIsolateAction);
      setIsolationType(bed.isolation?.type || (hasPatientPrecautions && patient?.isolationPrecautions ? patient.isolationPrecautions[0] : 'Airborne'));
      setReason(bed.isolation?.reason || (patient?.diagnosis ? `عزل طبي: ${patient.diagnosis}` : 'عزل طبي سريري'));
      setStartDate(bed.isolation?.startDate || new Date().toISOString().split('T')[0]);
      setEndDate(bed.isolation?.endDate || '');
      setPrecautions(
        (bed.isolation?.precautions && bed.isolation.precautions.length > 0)
          ? bed.isolation.precautions
          : (hasPatientPrecautions && patient?.isolationPrecautions ? patient.isolationPrecautions : ['n95', 'gloves', 'gown'])
      );
      setNotes(bed.isolation?.notes || '');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen || !bed) return null;

  const handleSelectIsolation = () => {
    setIsIsolated(true);
    setSelectedStatus(BedStatus.ISOLATION);
    if (!reason || reason.trim() === '') {
      setReason(patient?.diagnosis ? `عزل طبي: ${patient.diagnosis}` : 'عزل سريري وقائي');
    }
    if (precautions.length === 0) {
      setPrecautions(['n95', 'gloves', 'gown']);
    }
  };

  const handleSelectEndIsolation = () => {
    setIsIsolated(false);
    setSelectedStatus(BedStatus.OCCUPIED);
  };

  const togglePrecaution = (id: string) => {
    setPrecautions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const targetPatientId = patient?.id || bed.currentPatientId || bed.activePatientId;
      
      const activePrecautions = isIsolated 
        ? (precautions.length > 0 ? precautions : ['Contact Precautions']) 
        : [];

      const patientIsolationList = isIsolated 
        ? [isolationType || 'Airborne', ...activePrecautions.filter(p => p !== isolationType)]
        : [];

      // 1. If patient exists in local Dexie, update all matching patient instances
      const allPatients = await db.patients.toArray();
      const matchingPatients = allPatients.filter(p => 
        (targetPatientId && p.id === targetPatientId) ||
        (p.currentBedId === bed.bedNumber && p.patientStatus === 'ACTIVE_ICU') ||
        (p.currentBedId === bed.bedNumber)
      );

      for (const pat of matchingPatients) {
        pat.isolationPrecautions = patientIsolationList;
        pat.updatedAt = new Date().toISOString();
        await db.patients.put(pat);
        try {
          await syncPatientToCloud(pat);
        } catch (patErr) {
          console.warn('Patient cloud sync warning:', patErr);
        }
      }

      // 2. Update local Dexie database for Bed
      const existingBed = await db.beds.get(bed.bedNumber);
      const hasAssignedPatient = matchingPatients.length > 0 || !!targetPatientId;
      const finalStatus: BedStatus = isIsolated 
        ? BedStatus.ISOLATION 
        : (hasAssignedPatient ? BedStatus.OCCUPIED : BedStatus.VACANT);

      const isolationData: BedIsolationInfo = {
        isIsolated,
        type: isIsolated ? (isolationType || 'Airborne') : undefined,
        reason: isIsolated ? (reason.trim() || 'عزل طبي سريري') : undefined,
        startDate: isIsolated ? startDate : undefined,
        endDate: isIsolated && endDate ? endDate : undefined,
        precautions: activePrecautions,
        notes: isIsolated ? notes.trim() : undefined,
      };

      const updatedBed: BedRecord = {
        ...(existingBed || bed),
        status: finalStatus,
        isolation: isolationData,
        updatedAt: new Date().toISOString(),
      };
      await db.beds.put(updatedBed);

      // 3. Sync Bed to Cloud Firestore SSOT
      try {
        await syncBedToCloud(updatedBed);
      } catch (cloudErr) {
        console.warn('Firestore bed status update (offline cache will sync):', cloudErr);
      }

      // 4. Trigger Notification (broadcasts to other clinicians in real time)
      if (isIsolated) {
        triggerNotification({
          type: 'ISOLATION_CHANGE',
          titleEn: `Isolation Precautions - Bed ${bed.bedNumber}`,
          titleAr: `تدابير العزل السريري - سرير ${bed.bedNumber}`,
          messageEn: `Bed ${bed.bedNumber} (${patient?.fullNameEn || 'Patient'}) flagged for Isolation (${isolationType}).`,
          messageAr: `تم تفعيل تدابير العزل بالسرير رقم ${bed.bedNumber} (${patient?.fullNameAr || 'المريض'}) نوع (${isolationType}).`,
          target: {
            action: 'OPEN_ISOLATION',
            bedNumber: bed.bedNumber,
            patientName: patient?.fullNameAr || patient?.fullNameEn,
          }
        });
      } else {
        triggerNotification({
          type: 'ISOLATION_CHANGE',
          titleEn: `Isolation Lifted - Bed ${bed.bedNumber}`,
          titleAr: `إنهاء تدابير العزل - سرير ${bed.bedNumber}`,
          messageEn: `Isolation precautions removed for Bed ${bed.bedNumber}.`,
          messageAr: `تم إنهاء وإلغاء تدابير العزل بالسرير رقم ${bed.bedNumber}.`,
          target: {
            action: 'OPEN_BED',
            bedNumber: bed.bedNumber,
            patientName: patient?.fullNameAr || patient?.fullNameEn,
          }
        });
      }

      // 5. Ensure immediate local synchronization and dispatch events
      await ensureBedPatientSync();
      window.dispatchEvent(new Event('icu-data-updated'));
      (onSuccess || onUpdated)?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to update bed isolation status:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل تحديث حالة السرير' : 'Failed to update bed status'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {lang === 'ar' ? `تدابير العزل - سرير ${bed.bedNumber}` : `Isolation Precautions - Bed ${bed.bedNumber}`}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'عزل وقائي / إنهاء تدابير العزل' : 'Clinical Isolation / End Isolation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 2 Main Status Choices: Isolation vs End Isolation */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {lang === 'ar' ? 'حدد الإجراء المطلوب للسرير:' : 'Select Isolation Action:'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Option 1: عزل (Isolation) */}
              <button
                type="button"
                onClick={handleSelectIsolation}
                className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isIsolated
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/40 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="text-sm font-bold flex items-center justify-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'ar' ? 'عزل' : 'Isolation'}</span>
                </div>
                <div className="text-[11px] text-amber-400/80 mt-1 font-medium">
                  {lang === 'ar' ? 'تفعيل تدابير واحتياطات العزل' : 'Activate Isolation Precautions'}
                </div>
              </button>

              {/* Option 2: إنهاء العزل (End Isolation) */}
              <button
                type="button"
                onClick={handleSelectEndIsolation}
                className={`p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                  !isIsolated
                    ? 'bg-teal-500/20 border-teal-500 text-teal-300 ring-2 ring-teal-500/40 shadow-lg shadow-teal-500/10'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <div className="text-sm font-bold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  <span>{lang === 'ar' ? 'إنهاء العزل' : 'End Isolation'}</span>
                </div>
                <div className="text-[11px] text-teal-400/80 mt-1 font-medium">
                  {lang === 'ar' ? 'إلغاء العزل والعودة للوضع العادي' : 'Lift Precautions & Standard Care'}
                </div>
              </button>
            </div>
          </div>

          {/* If End Isolation is selected, show reassuring clinical info card */}
          {!isIsolated && (
            <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-800/50 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-teal-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{lang === 'ar' ? 'إنهاء تدابير العزل والعودة للرعاية الاعتيادية' : 'End Isolation & Resume Standard ICU Care'}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {lang === 'ar' 
                  ? 'عند الحفظ، سيتم إلغاء حالة العزل بالكامل عن السرير والمريض، وتفريغ تدابير الوقاية الخاصة، واستعادة وضع الرعاية الاعتيادي للسرير (مشغول عادي).'
                  : 'Upon saving, isolation precautions will be cleared from this bed and patient dossier, returning to standard occupied bed status.'}
              </p>
            </div>
          )}

          {/* Isolation Details Section (Shown when Isolation is active) */}
          {isIsolated && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-3.5 animate-in fade-in duration-150">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 border-b border-amber-800/40 pb-2">
                <ShieldAlert className="w-4 h-4" />
                <span>{lang === 'ar' ? 'بيانات واحتياطات العزل الطبي' : 'Clinical Isolation Protocol'}</span>
              </div>

              {/* Isolation Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'نوع العزل' : 'Isolation Category'}
                  </label>
                  <select
                    value={isolationType}
                    onChange={(e) => setIsolationType(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Airborne">{lang === 'ar' ? 'عزل هوائي (Airborne)' : 'Airborne'}</option>
                    <option value="Contact">{lang === 'ar' ? 'عزل تلامس (Contact / MDRO)' : 'Contact'}</option>
                    <option value="Droplet">{lang === 'ar' ? 'عزل رذاذ (Droplet)' : 'Droplet'}</option>
                    <option value="Protective">{lang === 'ar' ? 'عزل وقائي / مناعة منخفضة (Protective)' : 'Protective / Neutropenic'}</option>
                    <option value="MRSA">{lang === 'ar' ? 'بكتيريا مقاومة (MRSA / VRE / CRE)' : 'MRSA / Resistant Organism'}</option>
                    <option value="COVID-19">{lang === 'ar' ? 'كوفيد-19 / تنفسي حاد' : 'COVID-19 / ARDS'}</option>
                    <option value="Other">{lang === 'ar' ? 'نوع آخر' : 'Other'}</option>
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'تاريخ بدء العزل' : 'Isolation Start Date'}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              {/* End Date (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'تاريخ نهاية العزل المتوقع (اختياري)' : 'Expected Isolation End Date (Optional)'}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'سبب العزل الطبي (إلزامي)' : 'Clinical Reason for Isolation (Required)'}
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: اشتباه بكتيريا معوية مقاومة، كوفيد إيجابي، درن...' : 'e.g., Confirmed MRSA sputum, suspect TB, severe immunosuppression...'}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* Precautions checklist */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  {lang === 'ar' ? 'احتياطات الوقاية المطلوبة:' : 'Mandatory Precautions:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRECAUTION_OPTIONS.map((opt) => {
                    const isChecked = precautions.includes(opt.id);
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => togglePrecaution(opt.id)}
                        className={`p-2 rounded-lg border text-left text-xs flex items-center gap-2 transition-colors ${
                          isChecked
                            ? 'bg-amber-500/10 border-amber-500/60 text-amber-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isChecked ? 'bg-amber-500 border-amber-400 text-slate-950' : 'border-slate-600'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-[11px]">
                          {lang === 'ar' ? opt.labelAr : opt.labelEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'ملاحظات إضافية وتوجيهات للتمريض' : 'Additional Directives for Nursing & Staff'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'تعليمات تطهير السرير، توقيت المسحات...' : 'Instructions for swabs, visitor restrictions...'}
                  rows={2}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (isIsolated && !reason.trim())}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer ${
                isIsolated 
                  ? 'bg-amber-400 hover:bg-amber-300' 
                  : 'bg-teal-400 hover:bg-teal-300'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...'}</span>
                </>
              ) : isIsolated ? (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حفظ تدابير العزل' : 'Save Isolation Precautions'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تأكيد إنهاء العزل' : 'Confirm End Isolation'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
