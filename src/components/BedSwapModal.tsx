import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Bed, 
  User, 
  Loader2,
  ShieldAlert,
  Repeat
} from 'lucide-react';
import { BedRecord, PatientDossier } from '../types/schema.ts';
import { executeBedSwap } from '../services/operations.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface BedSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  beds?: BedRecord[];
  allBeds?: BedRecord[];
  patients?: PatientDossier[];
  allPatients?: PatientDossier[];
  sourceBed?: BedRecord;
  sourcePatient?: PatientDossier;
  initialBedNumber?: string;
  onSuccess?: () => void;
  onSwapSuccess?: () => void;
}

export const BedSwapModal: React.FC<BedSwapModalProps> = ({
  isOpen,
  onClose,
  beds,
  allBeds,
  patients,
  allPatients,
  sourceBed,
  sourcePatient,
  initialBedNumber,
  onSuccess,
  onSwapSuccess,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();

  const effectiveBeds = beds || allBeds || [];
  const effectivePatients = patients || allPatients || [];
  const effectiveInitialBedNumber = initialBedNumber || sourceBed?.bedNumber;

  // Filter beds that are occupied with a valid patient
  const occupiedBeds = effectiveBeds.filter(b => {
    if (!b) return false;
    const pId = b.currentPatientId || b.activePatientId;
    return !!pId && effectivePatients.some(p => p && p.id === pId) && b.status !== 'UNAVAILABLE';
  });

  const [bedAId, setBedAId] = useState<string>(effectiveInitialBedNumber || (occupiedBeds[0]?.bedNumber || ''));
  const [bedBId, setBedBId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (effectiveInitialBedNumber) {
      setBedAId(effectiveInitialBedNumber);
    }
    // Auto pick the other bed if possible
    const other = occupiedBeds.find(b => b.bedNumber !== (effectiveInitialBedNumber || bedAId));
    if (other && !bedBId) {
      setBedBId(other.bedNumber);
    }
  }, [effectiveInitialBedNumber, occupiedBeds]);

  if (!isOpen) return null;

  const bedA = occupiedBeds.find(b => b.bedNumber === bedAId);
  const bedB = occupiedBeds.find(b => b.bedNumber === bedBId);

  const patientA = bedA ? effectivePatients.find(p => p.id === (bedA.currentPatientId || bedA.activePatientId)) : null;
  const patientB = bedB ? effectivePatients.find(p => p.id === (bedB.currentPatientId || bedB.activePatientId)) : null;

  const handleStartConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!bedAId || !bedBId) {
      setErrorMessage(lang === 'ar' ? 'يرجى اختيار السريرين المراد تبديلهما' : 'Please select both beds to swap');
      return;
    }
    if (bedAId === bedBId) {
      setErrorMessage(lang === 'ar' ? 'لا يمكن تبديل السرير مع نفسه' : 'Cannot swap bed with itself');
      return;
    }
    if (!patientA || !patientB) {
      setErrorMessage(lang === 'ar' ? 'كلا السريرين يجب أن يكونا مشغولين بمرضى نشطين' : 'Both beds must be occupied by active patients');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage(lang === 'ar' ? 'يرجى كتابة سبب تبديل الأسرة' : 'Please provide clinical reason for bed swap');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage(lang === 'ar' ? 'لا يمكن التبديل أثناء انقطاع الاتصال (Offline)' : 'Cannot swap while offline');
      return;
    }

    setConfirmStep(true);
  };

  const handleExecuteSwap = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error(lang === 'ar' ? 'لا يمكن تنفيذ العملية بدون اتصال بالإنترنت.' : 'Offline mode: connection required.');
      }

      const doctorId = currentUser?.badgeId || currentUser?.uid || 'STAFF-AUTO';
      const doctorName = currentUser?.nameAr || currentUser?.nameEn || 'مناوب العناية المركزة';
      const unitId = bedA?.unitId || 'MICU-MAIN';

      await executeBedSwap(
        bedAId,
        bedBId,
        doctorId,
        doctorName,
        unitId,
        reason.trim()
      );

      (onSuccess || onSwapSuccess)?.();
      onClose();
    } catch (err: any) {
      console.error('Bed swap failed:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشلت عملية تبديل الأسرة' : 'Bed swap operation failed'));
      setConfirmStep(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {lang === 'ar' ? 'تبديل سريرين (Bed Swap)' : 'Swap Two Beds'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? 'معاملة ذرية واحدة تبادلية في Firestore (Single Atomic Swap Transaction)' 
                  : 'Single atomic swap transaction preserving all medical dossiers'}
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {occupiedBeds.length < 2 ? (
            <div className="p-6 text-center space-y-2 bg-slate-900/50 rounded-xl border border-slate-800">
              <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold text-white">
                {lang === 'ar' 
                  ? 'يجب توفر سريرين مشغولين على الأقل لتنفيذ عملية التبديل' 
                  : 'At least two occupied beds are required for bed swap'}
              </p>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? `الأسِرّة المشغولة حالياً: ${occupiedBeds.length}` : `Currently occupied beds: ${occupiedBeds.length}`}
              </p>
              <button
                onClick={onClose}
                className="mt-3 px-4 py-2 text-xs bg-slate-800 text-slate-300 rounded-lg"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          ) : !confirmStep ? (
            <form onSubmit={handleStartConfirmation} className="space-y-4">
              {/* Select Bed A & Bed B */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bed A */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    {lang === 'ar' ? 'السرير الأول (أ)' : 'First Bed (A)'}
                  </label>
                  <select
                    value={bedAId}
                    onChange={(e) => setBedAId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  >
                    {occupiedBeds.map(b => (
                      <option key={b.bedNumber} value={b.bedNumber}>
                        {lang === 'ar' ? `سرير ${b.bedNumber}` : `Bed ${b.bedNumber}`}
                      </option>
                    ))}
                  </select>

                  {/* Bed A Preview Card */}
                  {patientA && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <div className="text-xs font-bold text-white truncate">
                        {patientA.fullNameAr || patientA.fullNameEn}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        MRN: #{patientA.mrn} | {patientA.age}y {patientA.gender}
                      </div>
                      <div className="text-[10px] text-purple-300 truncate">
                        {patientA.primaryDiagnosisAr || patientA.primaryDiagnosisEn}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bed B */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    {lang === 'ar' ? 'السرير الثاني (ب)' : 'Second Bed (B)'}
                  </label>
                  <select
                    value={bedBId}
                    onChange={(e) => setBedBId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">{lang === 'ar' ? '-- اختر السرير المقابل --' : '-- Select Partner Bed --'}</option>
                    {occupiedBeds
                      .filter(b => b.bedNumber !== bedAId)
                      .map(b => (
                        <option key={b.bedNumber} value={b.bedNumber}>
                          {lang === 'ar' ? `سرير ${b.bedNumber}` : `Bed ${b.bedNumber}`}
                        </option>
                    ))}
                  </select>

                  {/* Bed B Preview Card */}
                  {patientB && (
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                      <div className="text-xs font-bold text-white truncate">
                        {patientB.fullNameAr || patientB.fullNameEn}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        MRN: #{patientB.mrn} | {patientB.age}y {patientB.gender}
                      </div>
                      <div className="text-[10px] text-purple-300 truncate">
                        {patientB.primaryDiagnosisAr || patientB.primaryDiagnosisEn}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Swap Visual Indicator */}
              {patientA && patientB && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/40 text-center flex items-center justify-center gap-3 text-xs text-purple-300">
                  <span className="font-bold font-mono text-white">{lang === 'ar' ? `سرير ${bedAId}` : `Bed ${bedAId}`}</span>
                  <ArrowRightLeft className="w-4 h-4 text-purple-400" />
                  <span className="font-bold font-mono text-white">{lang === 'ar' ? `سرير ${bedBId}` : `Bed ${bedBId}`}</span>
                  <span className="text-[11px] text-slate-400">
                    ({lang === 'ar' ? 'تبديل موقعي متزامن' : 'Mutual atomic exchange'})
                  </span>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'ar' ? 'سبب التبديل السريري (إلزامي)' : 'Clinical Reason for Bed Swap (Required)'}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: مواءمة الاحتياجات التنفسية، عزل، تنظيم التمريض...' : 'e.g. Ventilator line proximity, clinical isolation, nursing assignment balance...'}
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!bedAId || !bedBId || bedAId === bedBId || !reason.trim() || !patientA || !patientB}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-purple-400 hover:bg-purple-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {lang === 'ar' ? 'متابعة إلى التأكيد' : 'Proceed to Confirmation'}
                </button>
              </div>
            </form>
          ) : (
            /* Confirmation Step */
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <ShieldAlert className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تأكيد أمر تبديل الأسِرّة المزدوج' : 'Confirm Mutual Bed Swap Order'}</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400" />
                    <span>
                      {lang === 'ar' ? 'المريض ' : 'Patient '}
                      <strong className="text-white">{patientA?.fullNameAr || patientA?.fullNameEn}</strong>
                      {lang === 'ar' ? ` ينتقل من السرير (${bedAId}) إلى السرير (${bedBId})` : ` moves from Bed ${bedAId} to Bed ${bedBId}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>
                      {lang === 'ar' ? 'المريض ' : 'Patient '}
                      <strong className="text-white">{patientB?.fullNameAr || patientB?.fullNameEn}</strong>
                      {lang === 'ar' ? ` ينتقل من السرير (${bedBId}) إلى السرير (${bedAId})` : ` moves from Bed ${bedBId} to Bed ${bedAId}`}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-950/60 font-mono text-[11px] text-slate-300">
                  <span className="text-slate-400">{lang === 'ar' ? 'السبب: ' : 'Reason: '}</span>
                  {reason}
                </div>

                <div className="text-[11px] text-teal-300">
                  ✓ {lang === 'ar' 
                    ? 'ستُنفذ العملية كمعاملة ذرية واحدة Atomic في Firestore، وكل مريض يحتفظ بملفه وتحاليله دون أي اختلاط.' 
                    : 'Single atomic transaction in Firestore. Each patient retains their medical records independently.'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmStep(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors"
                >
                  {lang === 'ar' ? 'رجوع للتعديل' : 'Back'}
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSwap}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-purple-400 hover:bg-purple-300 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'ar' ? 'جارِ تنفيذ التبديل الذري...' : 'Executing Atomic Swap...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تأكيد وتنفيذ التبديل الآن' : 'Confirm & Execute Bed Swap'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
