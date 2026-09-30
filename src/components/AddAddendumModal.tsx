import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { StaffRole } from '../types/schema.ts';
import { appendImmutableAddendum } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { VoiceNoteRecorder } from './VoiceNoteRecorder.tsx';

interface AddAddendumModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  patientId: string;
  originalNoteAuthor: string;
  patientName: string;
  onAddendumAppended: () => void;
  defaultReason?: 'CLINICAL_UPDATE' | 'CORRECTION' | 'LAB_CORRELATION' | 'CONSULTANT_COUNTERSIGN' | 'HANDOVER_NOTE';
}

export const AddAddendumModal: React.FC<AddAddendumModalProps> = ({
  isOpen,
  onClose,
  noteId,
  patientId,
  originalNoteAuthor,
  onAddendumAppended,
  defaultReason,
}) => {
  const { t, lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();
  const [content, setContent] = useState<string>('');
  const [reason, setReason] = useState<'CLINICAL_UPDATE' | 'CORRECTION' | 'LAB_CORRELATION' | 'CONSULTANT_COUNTERSIGN' | 'HANDOVER_NOTE'>('CLINICAL_UPDATE');

  const isVoiceDictationEnabled = settings?.features?.enableVoiceNoteDictation !== false;

  const handleVoiceTranscript = (chunk: string) => {
    if (!chunk.trim()) return;
    setContent(prev => {
      const trimmed = prev.trim();
      if (!trimmed) {
        return chunk;
      }
      const endsWithSentencePunctuation = /[.!?:\n]$/.test(trimmed);
      if (endsWithSentencePunctuation) {
        return `${trimmed}\n${chunk}`;
      }
      return `${trimmed} ${chunk}`;
    });
  };
  
  const loggedInName = lang === 'ar' 
    ? currentUser?.nameAr || currentUser?.nameEn || 'طبيب العناية المناوب'
    : currentUser?.nameEn || currentUser?.nameAr || 'ICU Duty Physician';
  const loggedInRole = currentUser?.role as StaffRole || StaffRole.RESIDENT;

  const [authorName, setAuthorName] = useState<string>(loggedInName);
  const [authorRole, setAuthorRole] = useState<StaffRole>(loggedInRole);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state with dynamic auth user and props on open
  useEffect(() => {
    if (isOpen) {
      setAuthorName(loggedInName);
      setAuthorRole(loggedInRole);
      if (defaultReason) {
        setReason(defaultReason);
      } else {
        setReason('CLINICAL_UPDATE');
      }
    }
  }, [isOpen, currentUser, defaultReason, lang]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const loggedInUid = currentUser?.uid ? `staff-${currentUser.uid}` : 'staff-9912';
      const loggedInBadgeId = currentUser?.badgeId || '9912';

      await appendImmutableAddendum({
        noteId,
        patientId,
        authorId: loggedInUid,
        authorName,
        authorRole,
        authorStaffId: loggedInBadgeId,
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
      <div className="w-full max-w-lg bg-white dark:bg-[#0c1426] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto text-slate-900 dark:text-white">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#090f1d] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'إلحاق ملحق بالملاحظة (Clinical Addendum)' : 'Clinical Note Addendum'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'ar' ? 'بروتوكول الحماية الطبية والتسجيل المعتمد' : 'CBAHI & HIPAA Medico-Legal Addendum Standard'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rule 2.6 Immutability Notice */}
        <div className="bg-purple-50 dark:bg-purple-950/40 border-b border-purple-200 dark:border-purple-900/40 p-3 flex items-start gap-2 text-xs text-purple-900 dark:text-purple-300">
          <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">{lang === 'ar' ? 'تنبيه الحصانة القانونية: ' : 'Legal Immutability Notice: '}</span>
            {lang === 'ar' ? (
              <>
                الملاحظة الأصلية الموقعة من{' '}
                <span className="font-mono font-bold text-purple-800 dark:text-purple-200">{originalNoteAuthor}</span> غير قابلة للتعديل أو الحذف.
                سيتم ربط الملحق الجديد تشفيرياً بسلسلة الهاش (Cryptographic Chain).
              </>
            ) : (
              <>
                The baseline note signed by <span className="font-mono font-bold text-purple-800 dark:text-purple-200">{originalNoteAuthor}</span> cannot be altered or deleted.
                This entry will be cryptographically chained via SHA-256.
              </>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
              {lang === 'ar' ? 'سبب إلحاق الملاحظة (Reason for Addendum)' : 'Reason for Addendum'}
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as any)}
              className="w-full mt-1 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="CLINICAL_UPDATE">{lang === 'ar' ? 'CLINICAL_UPDATE (تحديث سريري)' : 'CLINICAL_UPDATE (Patient Status Change)'}</option>
              <option value="LAB_CORRELATION">{lang === 'ar' ? 'LAB_CORRELATION (ربط بنتائج تحاليل/أشعة جديدة)' : 'LAB_CORRELATION (Diagnostics / Imaging)'}</option>
              <option value="CONSULTANT_COUNTERSIGN">{lang === 'ar' ? 'CONSULTANT_COUNTERSIGN (اعتماد استشاري)' : 'CONSULTANT_COUNTERSIGN (Attending Attestation)'}</option>
              <option value="CORRECTION">{lang === 'ar' ? 'CORRECTION (تصحيح ملحق)' : 'CORRECTION (Correction & Clarification)'}</option>
              <option value="HANDOVER_NOTE">{lang === 'ar' ? 'HANDOVER_NOTE (ملاحظة تسليم)' : 'HANDOVER_NOTE (Shift / Bedside Briefing)'}</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                {lang === 'ar' ? 'نص الملحق الطبي (Clinical Addendum Content)' : 'Addendum Clinical Content'}
              </label>
              {content && (
                <button
                  type="button"
                  onClick={() => setContent('')}
                  className="text-[10px] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'مسح النص' : 'Clear Text'}
                </button>
              )}
            </div>

            {/* Voice Dictation via Browser SpeechRecognition */}
            {isVoiceDictationEnabled && (
              <div className="mb-2">
                <VoiceNoteRecorder
                  onTranscript={handleVoiceTranscript}
                  defaultLang={lang === 'ar' ? 'ar-SA' : 'en-US'}
                />
              </div>
            )}

            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={lang === 'ar' ? "اكتب التحديثات السريرية، استجابة المريض للعلاج، نتائج الأشعة أو استخدم الإملاء الصوتي أعلاه..." : "Document clinical response, new lab values, scan findings, or click Record Voice Note..."}
              className="w-full mt-1 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-600 dark:text-slate-400">{lang === 'ar' ? 'الطبيب كاتب الملحق' : 'Authoring Clinician'}</label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full mt-1 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-600 dark:text-slate-400">{lang === 'ar' ? 'الصفة الوظيفية' : 'Clinical Role'}</label>
              <select
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value as StaffRole)}
                className="w-full mt-1 bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none"
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
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-purple-950/20 dark:shadow-purple-950/40 cursor-pointer"
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
