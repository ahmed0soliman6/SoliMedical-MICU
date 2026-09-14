import React, { useState } from 'react';
import { X, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { StaffRole } from '../types/schema.ts';
import { appendImmutableAddendum } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';

interface AddAddendumModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  patientId: string;
  originalNoteAuthor: string;
  patientName: string;
  onAddendumAppended: () => void;
}

export const AddAddendumModal: React.FC<AddAddendumModalProps> = ({
  isOpen,
  onClose,
  noteId,
  patientId,
  originalNoteAuthor,
  onAddendumAppended,
}) => {
  const { t, lang, isRTL } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [reason, setReason] = useState<'CLINICAL_UPDATE' | 'CORRECTION' | 'LAB_CORRELATION' | 'CONSULTANT_COUNTERSIGN' | 'HANDOVER_NOTE'>('CLINICAL_UPDATE');
  const [authorName, setAuthorName] = useState<string>('Dr. Tarek Fouad');
  const [authorRole, setAuthorRole] = useState<StaffRole>(StaffRole.SPECIALIST);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      await appendImmutableAddendum({
        noteId,
        patientId,
        authorId: 'staff-9912',
        authorName,
        authorRole,
        authorStaffId: '9912',
        content: content.trim(),
        reasonForAddendum: reason,
      });
      onAddendumAppended();
      onClose();
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء تشفير وإرفاق الملحق الطبي.' : 'Error creating cryptographic addendum.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-[#0c1426] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#090f1d] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? 'إلحاق ملاحظة مشفرة (SHA-256 Addendum)' : 'Immutable Note Addendum (SHA-256)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {lang === 'ar' ? 'بروتوكول Rule 2.6 للحماية الطبية القانونية (Doctor-to-Doctor Immutability)' : 'CBAHI & HIPAA Medico-Legal Addendum Standard'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rule 2.6 Immutability Notice */}
        <div className="bg-purple-950/40 border-b border-purple-900/40 p-3 flex items-start gap-2 text-xs text-purple-300">
          <AlertCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">{lang === 'ar' ? 'تنبيه الحصانة القانونية: ' : 'Legal Immutability Notice: '}</span>
            {lang === 'ar' ? (
              <>
                الملاحظة الأصلية الموقعة من{' '}
                <span className="font-mono text-purple-200">{originalNoteAuthor}</span> غير قابلة للتعديل أو الحذف.
                سيتم ربط الملحق الجديد تشفيرياً بسلسلة الهاش (Cryptographic Chain).
              </>
            ) : (
              <>
                The baseline note signed by <span className="font-mono text-purple-200">{originalNoteAuthor}</span> cannot be altered or deleted.
                This entry will be cryptographically chained via SHA-256.
              </>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="text-[11px] text-slate-300 font-semibold">
              {lang === 'ar' ? 'سبب إلحاق الملاحظة (Reason for Addendum)' : 'Reason for Addendum'}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="CLINICAL_UPDATE">{lang === 'ar' ? 'CLINICAL_UPDATE (تحديث سريري)' : 'CLINICAL_UPDATE (Patient Status Change)'}</option>
              <option value="LAB_CORRELATION">{lang === 'ar' ? 'LAB_CORRELATION (ربط بنتائج تحاليل/أشعة جديدة)' : 'LAB_CORRELATION (Diagnostics / Imaging)'}</option>
              <option value="CONSULTANT_COUNTERSIGN">{lang === 'ar' ? 'CONSULTANT_COUNTERSIGN (اعتماد استشاري)' : 'CONSULTANT_COUNTERSIGN (Attending Attestation)'}</option>
              <option value="CORRECTION">{lang === 'ar' ? 'CORRECTION (تصحيح ملحق)' : 'CORRECTION (Correction & Clarification)'}</option>
              <option value="HANDOVER_NOTE">{lang === 'ar' ? 'HANDOVER_NOTE (ملاحظة تسليم)' : 'HANDOVER_NOTE (Shift / Bedside Briefing)'}</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-300 font-semibold">
              {lang === 'ar' ? 'نص الملحق الطبي (Clinical Addendum Content)' : 'Addendum Clinical Content'}
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={lang === 'ar' ? "اكتب التحديثات السريرية، استجابة المريض للعلاج، نتائج الأشعة المقطعية أو خطة العناية..." : "Document clinical response, new lab values, scan findings, or revised care plan..."}
              className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'الطبيب كاتب الملحق' : 'Authoring Clinician'}</label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'الصفة الوظيفية' : 'Clinical Role'}</label>
              <select
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value as StaffRole)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
              >
                <option value={StaffRole.CONSULTANT}>Consultant Intensivist</option>
                <option value={StaffRole.SPECIALIST}>ICU Specialist / Fellow</option>
                <option value={StaffRole.RESIDENT}>ICU Resident</option>
                <option value={StaffRole.CLINICAL_PHARMACIST}>Critical Care Pharmacist</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-purple-950/40"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? (lang === 'ar' ? 'جاري التشفير والربط...' : 'Hashing...') : (lang === 'ar' ? 'توقيع وتثبيت الملحق' : 'Sign & Chain Addendum')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
