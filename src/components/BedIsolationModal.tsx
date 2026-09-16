import React, { useState } from 'react';
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
import { db } from '../db/icuSyncDb.ts';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase.ts';
import { COLLECTIONS } from '../types/contracts.ts';
import { useTranslation } from '../services/i18n.ts';

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

  if (!isOpen || !bed) return null;

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
      let finalStatus = selectedStatus;
      if (isIsolated && selectedStatus !== BedStatus.UNAVAILABLE) {
        finalStatus = BedStatus.ISOLATION;
      } else if (!isIsolated && selectedStatus === BedStatus.ISOLATION) {
        finalStatus = bed.currentPatientId ? BedStatus.OCCUPIED : BedStatus.VACANT;
      }

      const isolationData: BedIsolationInfo = {
        isIsolated,
        type: isIsolated ? isolationType : undefined,
        reason: isIsolated ? reason.trim() : undefined,
        startDate: isIsolated ? startDate : undefined,
        endDate: isIsolated && endDate ? endDate : undefined,
        precautions: isIsolated ? precautions : [],
        notes: isIsolated ? notes.trim() : undefined,
      };

      // 1. Update local Dexie database
      await db.beds.update(bed.bedNumber, {
        status: finalStatus,
        isolation: isolationData,
      });

      // 2. Update Firestore SSOT
      try {
        const bedRef = doc(firestore, COLLECTIONS.BEDS, bed.bedNumber);
        await updateDoc(bedRef, {
          status: finalStatus,
          isolation: isolationData,
          updatedAt: Date.now()
        });
      } catch (cloudErr) {
        console.warn('Firestore bed status update (offline cache will sync):', cloudErr);
      }

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
                {lang === 'ar' ? `حالة السرير والتحكم بالعزل - سرير ${bed.bedNumber}` : `Bed Status & Isolation - Bed ${bed.bedNumber}`}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'عادي / عزل سريري / غير متاح' : 'Standard / Isolation / Unavailable'}
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

          {/* 3 Main Status Choices */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {lang === 'ar' ? 'حدد حالة السرير التشغيلية:' : 'Select Bed Operational Status:'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Normal / Standard */}
              <button
                type="button"
                onClick={() => {
                  setIsIsolated(false);
                  setSelectedStatus(bed.currentPatientId ? BedStatus.OCCUPIED : BedStatus.VACANT);
                }}
                className={`p-3 rounded-xl border text-center transition-all ${
                  !isIsolated && selectedStatus !== BedStatus.UNAVAILABLE
                    ? 'bg-teal-500/20 border-teal-500 text-white ring-2 ring-teal-500/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold">{lang === 'ar' ? 'عادي' : 'Standard'}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {bed.currentPatientId ? (lang === 'ar' ? 'مشغول' : 'Occupied') : (lang === 'ar' ? 'شاغر' : 'Vacant')}
                </div>
              </button>

              {/* Isolation */}
              <button
                type="button"
                onClick={() => {
                  setIsIsolated(true);
                  setSelectedStatus(BedStatus.ISOLATION);
                }}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isIsolated && selectedStatus !== BedStatus.UNAVAILABLE
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>{lang === 'ar' ? 'عزل' : 'Isolation'}</span>
                </div>
                <div className="text-[10px] text-amber-400/80 mt-0.5">
                  {lang === 'ar' ? 'احتياطات خاصة' : 'Special Precautions'}
                </div>
              </button>

              {/* Unavailable */}
              <button
                type="button"
                onClick={() => {
                  setIsIsolated(false);
                  setSelectedStatus(BedStatus.UNAVAILABLE);
                }}
                className={`p-3 rounded-xl border text-center transition-all ${
                  selectedStatus === BedStatus.UNAVAILABLE
                    ? 'bg-red-500/20 border-red-500 text-red-300 ring-2 ring-red-500/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                  <span>{lang === 'ar' ? 'غير متاح' : 'Unavailable'}</span>
                </div>
                <div className="text-[10px] text-red-400/80 mt-0.5">
                  {lang === 'ar' ? 'صيانة / تعقيم' : 'Decon / Tech'}
                </div>
              </button>
            </div>
          </div>

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
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حفظ حالة السرير' : 'Save Bed Status'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
