import React, { useState } from 'react';
import { 
  ArrowRightLeft, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Bed, 
  User, 
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { BedRecord, PatientDossier, BedNumber } from '../types/schema.ts';
import { executeTransfer } from '../services/operations.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface PatientTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceBed?: BedRecord;
  currentBed?: BedRecord;
  patient: PatientDossier;
  availableBeds?: BedRecord[];
  allBeds?: BedRecord[];
  onSuccess?: () => void;
  onTransferSuccess?: () => void;
}

export const PatientTransferModal: React.FC<PatientTransferModalProps> = ({
  isOpen,
  onClose,
  sourceBed,
  currentBed,
  patient,
  availableBeds,
  allBeds,
  onSuccess,
  onTransferSuccess,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();

  const [targetBedId, setTargetBedId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const effectiveSourceBed = sourceBed || currentBed;
  const rawBedsList = availableBeds || allBeds || [];

  if (!isOpen || !effectiveSourceBed || !patient) return null;

  // Filter only vacant beds (exclude source bed)
  const selectableBeds = rawBedsList.filter(
    b => b && b.bedNumber !== effectiveSourceBed.bedNumber && (b.status === 'VACANT' || !b.currentPatientId)
  );

  const handleStartConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!targetBedId) {
      setErrorMessage(lang === 'ar' ? 'يرجى اختيار السرير المستهدف' : 'Please select a destination bed');
      return;
    }
    if (!reason.trim()) {
      setErrorMessage(lang === 'ar' ? 'يرجى كتابة سبب النقل الطبي' : 'Please provide clinical reason for transfer');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage(lang === 'ar' ? 'لا يمكن النقل أثناء انقطاع الاتصال (Offline)' : 'Cannot transfer while offline');
      return;
    }

    setConfirmStep(true);
  };

  const handleExecuteTransfer = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error(lang === 'ar' ? 'لا يمكن تنفيذ العملية بدون اتصال بالإنترنت.' : 'Offline mode: connection required.');
      }

      const doctorId = currentUser?.badgeId || currentUser?.uid || 'STAFF-AUTO';
      const doctorName = currentUser?.nameAr || currentUser?.nameEn || 'مناوب العناية المركزة';
      const unitId = effectiveSourceBed.unitId || 'MICU-MAIN';

      await executeTransfer(
        patient.id,
        effectiveSourceBed.bedNumber,
        targetBedId,
        doctorId,
        unitId,
        reason.trim(),
        doctorName
      );

      (onSuccess || onTransferSuccess)?.();
      onClose();
    } catch (err: any) {
      console.error('Transfer failed:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشلت عملية النقل' : 'Transfer operation failed'));
      setConfirmStep(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {lang === 'ar' ? 'نقل المريض إلى سرير فارغ' : 'Transfer Patient to Vacant Bed'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? 'معاملة ذرية آمنة (Atomic Transaction) تحافظ على ثبات patientId' 
                  : 'Atomic transaction preserving invariant patientId'}
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
          {/* Patient Card Preview */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
                <User className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">
                  {patient.fullNameAr || patient.fullNameEn}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  MRN: #{patient.mrn} | ID: {patient.id.slice(0, 10)}...
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-slate-400">
                {lang === 'ar' ? 'السرير الحالي' : 'Current Bed'}
              </div>
              <div className="text-sm font-bold text-teal-400 font-mono">
                {lang === 'ar' ? `سرير ${effectiveSourceBed.bedNumber}` : `Bed ${effectiveSourceBed.bedNumber}`}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!confirmStep ? (
            <form onSubmit={handleStartConfirmation} className="space-y-4">
              {/* Target Bed Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'ar' ? 'اختر السرير المستهدف (الأسِرّة المتاحة فقط)' : 'Select Destination Bed (Available only)'}
                </label>
                {selectableBeds.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {lang === 'ar' 
                        ? 'لا توجد أسرة شاغرة حالياً في الوحدة للنقل إليها.' 
                        : 'No vacant beds currently available for transfer.'}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectableBeds.map(b => (
                      <button
                        type="button"
                        key={b.bedNumber}
                        onClick={() => setTargetBedId(b.bedNumber)}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                          targetBedId === b.bedNumber
                            ? 'bg-teal-500/20 border-teal-500 text-white ring-2 ring-teal-500/40 shadow-lg'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <Bed className="w-4 h-4 text-teal-400" />
                        <span className="text-xs font-bold font-mono">
                          {lang === 'ar' ? `سرير ${b.bedNumber}` : `Bed ${b.bedNumber}`}
                        </span>
                        <span className="text-[10px] text-emerald-400">
                          {lang === 'ar' ? 'شاغر' : 'Vacant'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Transfer Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'ar' ? 'سبب النقل السريري (إلزامي)' : 'Clinical Reason for Transfer (Required)'}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: نقل لموقع مجهز بجهاز تنفس، عزل، تعديل توزيع المرضى...' : 'e.g., Relocation for ventilator readiness, isolation bay, staffing alignment...'}
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              {/* Action Buttons */}
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
                  disabled={!targetBedId || !reason.trim() || selectableBeds.length === 0}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <span>{lang === 'ar' ? 'تأكيد أمر النقل السريري' : 'Confirm Clinical Transfer Order'}</span>
                </div>
                <p>
                  {lang === 'ar' 
                    ? `هل أنت متأكد من نقل المريض "${patient.fullNameAr || patient.fullNameEn}" من السرير (${effectiveSourceBed.bedNumber}) إلى السرير (${targetBedId})؟`
                    : `Are you sure you want to transfer "${patient.fullNameAr || patient.fullNameEn}" from Bed ${effectiveSourceBed.bedNumber} to Bed ${targetBedId}?`}
                </p>
                <div className="p-2 rounded bg-slate-950/60 font-mono text-[11px] text-slate-300">
                  <span className="text-slate-400">{lang === 'ar' ? 'السبب: ' : 'Reason: '}</span>
                  {reason}
                </div>
                <div className="text-[11px] text-teal-300">
                  ✓ {lang === 'ar' ? 'سيتم الاحتفاظ بكامل السجلات الطبية والتحاليل دون أي تغيير.' : 'All clinical labs and telemetry history will remain intact.'}
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
                  onClick={handleExecuteTransfer}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{lang === 'ar' ? 'جارِ النقل الآمن...' : 'Executing Transfer...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'تأكيد وتنفيذ النقل الآن' : 'Confirm & Execute Transfer'}</span>
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
