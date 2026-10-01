import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldCheck, FileText, ClipboardList, User } from 'lucide-react';
import { BedNumber, StaffRole, NoteType } from '../types/schema.ts';
import { createClinicalNote } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { VoiceNoteRecorder } from './VoiceNoteRecorder.tsx';

interface AddClinicalNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber?: BedNumber;
  patientId: string;
  patientName: string;
  onNoteCreated: () => void;
}

export const AddClinicalNoteModal: React.FC<AddClinicalNoteModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patientId,
  patientName,
  onNoteCreated,
}) => {
  const { lang } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [noteType, setNoteType] = useState<NoteType>(NoteType.PROGRESS_NOTE);
  const [consultationSpecialty, setConsultationSpecialty] = useState<string>('Nephrology / الكلى');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  // Derive user info dynamically from currently logged in user
  const loggedInName = currentUser?.displayName || currentUser?.name || (lang === 'ar' 
    ? currentUser?.nameAr || currentUser?.nameEn 
    : currentUser?.nameEn || currentUser?.nameAr) || (lang === 'ar' ? 'طبيب مناوب' : 'Staff Clinician');

  const loggedInRole = currentUser?.role || StaffRole.RESIDENT;
  const loggedInBadgeId = currentUser?.badgeId || currentUser?.staffId || '9912';
  const loggedInUid = currentUser?.uid ? `staff-${currentUser.uid}` : (currentUser?.badgeId ? `staff-${currentUser.badgeId}` : 'staff-9912');

  // Quick Clinical Templates for high utility
  const templates = [
    {
      id: 'icu_progress',
      titleEn: 'Daily ICU Progress Note',
      titleAr: 'ملاحظة تقدمية يومية للعناية المركزة',
      type: NoteType.PROGRESS_NOTE,
      content: `CNS: RASS 0, GCS 15. Pupils equal & reactive. No sedation.
CVS: Hemodynamically stable, sinus rhythm, no inotropes. MAP > 65 mmHg.
RESP: Stable on room air/HFNC. SpO2 98%. Lungs clear bilaterally.
GI/GU: Abdomen soft, bowel sounds positive, tolerating enteral feeding. UOP > 0.5 ml/kg/hr.
ID: Afebrile. Procalcitonin/WBC down. Antibiotics continue on schedule.
PLAN: De-escalate antibiotics, encourage early mobilization, consult physiotherapy.`
    },
    {
      id: 'nephrology_consult',
      titleEn: 'Referral: Nephrology Consultation',
      titleAr: 'طلب عرض: استشارة طبيب الكلى',
      type: NoteType.CONSULTATION_NOTE,
      content: `REASON FOR REFERRAL: Assessment of acute kidney injury (AKI) with worsening renal function.
BACKGROUND: Patient admitted with septic shock. Serum Creatinine increased from baseline 0.8 mg/dL to 2.4 mg/dL over 48 hours. Urea: 85 mg/dL. Potassium: 5.6 mEq/L with ECG showing peaked T waves.
FLUID BALANCE: 24H Fluid Balance is +3.5 Liters. Urine Output has dropped to < 0.3 ml/kg/hr for the last 8 hours (Oliguria).
CURRENT MEDICATIONS: On Norepinephrine infusion, Meropenem 1g Q8H (needs adjustment), and Furosemide 40mg IV Q12H with poor response.
CLINICAL INQUIRY: Kindly review the patient's labs and fluid state, recommend appropriate renal dose adjustments for antibiotics, and advise on the suitability of urgent Hemodialysis (CRRT) or high-dose diuretic titration.`
    },
    {
      id: 'cvc_insertion',
      titleEn: 'Procedural Note: Central Line Insertion (CVC)',
      titleAr: 'ملاحظة إجراء: تركيب قسطرة وريدية مركزية',
      type: NoteType.PROCEDURAL_NOTE,
      content: `PROCEDURE: Central Venous Catheter Insertion
INDICATIONS: Vasopressor support / poor peripheral access.
OPERATOR: ${loggedInName}
TECHNIQUE: Full sterile barrier precautions. Ultrasound-guided puncture of Right Internal Jugular vein.
CATHETER: Double-lumen 7F CVC advanced and secured at 15cm.
COMPLICATIONS: None. Good blood return in all lumens, flushed.
PLAN: Post-procedural chest X-ray ordered immediately to confirm tip position and rule out pneumothorax.`
    },
    {
      id: 'intubation',
      titleEn: 'Procedural Note: Rapid Sequence Intubation',
      titleAr: 'ملاحظة إجراء: التنبيب الرغامي السريع',
      type: NoteType.PROCEDURAL_NOTE,
      content: `PROCEDURE: Rapid Sequence Intubation (RSI)
INDICATIONS: Acute Hypoxemic Respiratory Failure
DRUGS: Fentanyl 100 mcg, Propofol 100 mg, Rocuronium 80 mg IV.
TUBE: Endotracheal Tube (ETT) Size 7.5, secured at 22cm at the lips.
CONFIRMATION: Bilateral breath sounds equal, positive colorimetric end-tidal CO2 detection.
VENTILATOR: Connected to mechanical ventilator on PRVC mode.
PLAN: Check ABG in 30 minutes. Order urgent portable chest X-ray.`
    },
    {
      id: 'consult_reply',
      titleEn: 'Clinical Consultation Reply',
      titleAr: 'الرد على استشارة طبية سريرية',
      type: NoteType.CONSULTATION_NOTE,
      content: `REASON FOR CONSULT: Critical care assessment for MICU admission.
BACKGROUND: Sepsis secondary to severe community-acquired pneumonia.
ASSESSMENT: Patient shows signs of early septic shock (MAP < 60 on fluids) with worsening hypoxemia. Meets criteria for ICU transfer.
RECOMMENDATIONS:
1. Accept and transfer to MICU immediately (isolation bed requested).
2. Start Norepinephrine central/peripheral infusion to maintain MAP > 65.
3. Broaden antibiotics to Meropenem + Linezolid.
4. Keep patient NPO.`
    }
  ];

  const handleApplyTemplate = (tpl: typeof templates[0]) => {
    setTitle(lang === 'ar' ? tpl.titleAr : tpl.titleEn);
    setNoteType(tpl.type);
    setContent(tpl.content);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      await createClinicalNote({
        bedId: bedNumber,
        patientId,
        noteType,
        title: title.trim(),
        content: content.trim(),
        authorId: loggedInUid,
        authorName: loggedInName,
        authorRole: loggedInRole,
        authorStaffId: loggedInBadgeId,
        createdByUid: currentUser?.uid || '',
        consultationSpecialty: noteType === NoteType.CONSULTATION_NOTE ? consultationSpecialty : undefined,
        consultationStatus: noteType === NoteType.CONSULTATION_NOTE ? 'PENDING' : undefined,
      });
      onNoteCreated();
      setTitle('');
      setContent('');
      onClose();
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء تشفير وحفظ الملاحظة الطبية.' : 'Error creating clinical progress note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lock background scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain">
      <div className="w-full max-w-2xl bg-white dark:bg-[#0c1426] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto text-slate-900 dark:text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#090f1d] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <FileText className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'توقيع ملاحظة طبية رقمية جديدة' : 'Sign New Clinical Note'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === 'ar' 
                  ? `تسجيل مستند طبي رسمي للمريض: ${patientName}` 
                  : `Record secure clinical document for ${patientName}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors animate-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clinical Templates Panel */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 dark:text-teal-400 mb-2">
            <ClipboardList className="w-4 h-4" />
            <span>{lang === 'ar' ? 'قوالب الملاحظات الطبية الجاهزة (Clinical Presets):' : 'Medico-Clinical Presets:'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tpl)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500/50 text-[11px] text-slate-700 dark:text-slate-300 transition-all text-left flex items-center gap-1 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>
                <span>{lang === 'ar' ? tpl.titleAr : tpl.titleEn}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'نوع الملاحظة (Note Classification)' : 'Note Classification'}
              </label>
              <select
                value={noteType}
                onChange={(e) => {
                  const val = e.target.value as NoteType;
                  setNoteType(val);
                  if (val === NoteType.CONSULTATION_NOTE && !title) {
                    setTitle(lang === 'ar' ? 'طلب عرض طبي واستشارة' : 'Medical Consultation Referral');
                  }
                }}
                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none font-sans"
              >
                <option value={NoteType.PROGRESS_NOTE}>{lang === 'ar' ? 'Progress Note (ملاحظة تقدمية)' : 'Clinical Progress Note'}</option>
                <option value={NoteType.CONSULTATION_NOTE}>{lang === 'ar' ? 'Consultation Note (طلب عرض / استشارة)' : 'Clinical Consultation Referral'}</option>
                <option value={NoteType.PROCEDURAL_NOTE}>{lang === 'ar' ? 'Procedural Note (إجراء طبي)' : 'Bedside Procedure Note'}</option>
                <option value={NoteType.ADMISSION_NOTE}>{lang === 'ar' ? 'Admission Note (ملاحظة دخول)' : 'Admission Progress Note'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'عنوان المستند السريري' : 'Document Title'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === 'ar' ? "مثال: طلب عرض طبي - استشارة الكلى" : "e.g., Nephrology Consultation Request"}
                className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {noteType === NoteType.CONSULTATION_NOTE && (
            <div className="p-3 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
              <label className="text-[11px] text-teal-800 dark:text-teal-300 font-bold block">
                {lang === 'ar' ? 'التخصص الطبي المستهدف للاستشارة (Target Specialty) *' : 'Target Consulting Specialty *'}
              </label>
              <select
                value={consultationSpecialty}
                onChange={(e) => {
                  setConsultationSpecialty(e.target.value);
                  const specialtyName = e.target.value.split('/')[1]?.trim() || e.target.value;
                  setTitle(lang === 'ar' ? `طلب عرض طبي: استشارة طبيب ${specialtyName}` : `Clinical Referral: ${e.target.value.split('/')[0].trim()} Consult`);
                }}
                className="w-full bg-white dark:bg-[#090f1d] border border-teal-300 dark:border-teal-800/50 rounded-lg px-3 py-2 text-teal-900 dark:text-teal-200 focus:border-teal-400 focus:outline-none font-sans"
              >
                <option value="Nephrology / الكلى">{lang === 'ar' ? 'Nephrology (أخصائي / استشاري أمراض الكلى)' : 'Nephrology (Kidney Specialty)'}</option>
                <option value="Cardiology / القلب">{lang === 'ar' ? 'Cardiology (أخصائي / استشاري أمراض القلب)' : 'Cardiology (Heart Specialty)'}</option>
                <option value="Pulmonology / الصدرية">{lang === 'ar' ? 'Pulmonology (أخصائي / استشاري الصدرية)' : 'Pulmonology (Respiratory)'}</option>
                <option value="Neurology / المخ والأعصاب">{lang === 'ar' ? 'Neurology (أخصائي / استشاري الأعصاب)' : 'Neurology (Nervous System)'}</option>
                <option value="Infectious Diseases / الأمراض المعدية">{lang === 'ar' ? 'Infectious Diseases (الأمراض المعدية)' : 'Infectious Diseases'}</option>
                <option value="Clinical Pharmacy / الصيدلة الإكلينيكية">{lang === 'ar' ? 'Clinical Pharmacy (الصيدلي الإكلينيكي)' : 'Clinical Pharmacy'}</option>
                <option value="General Surgery / الجراحة العامة">{lang === 'ar' ? 'General Surgery (الجراحة العامة)' : 'General Surgery'}</option>
                <option value="Other Specialty / تخصص آخر">{lang === 'ar' ? 'Other Medical Specialty (تخصص آخر)' : 'Other Medical Specialty'}</option>
              </select>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                {lang === 'ar' 
                  ? 'اختر تخصص الاستشارة المطلوب. سيظهر هذا العرض في قائمة الملاحظات كحالة معلقة باللون الأصفر، وسيتمكن الطبيب المعني من كتابة الرد الرسمي مباشرة.' 
                  : 'Select the consulting specialty. This referral will appear as pending (yellow), allowing the specific consultant to record their clinical answer.'}
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block">
                {lang === 'ar' ? 'المحتوى الطبي المفصل (Note Content)' : 'Detailed Clinical Narrative'}
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
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={lang === 'ar' ? "اكتب السرد الطبي المفصل وخطة العلاج والملاحظات التمريضية والسريرية هنا أو استخدم زر الإملاء الصوتي أعلاه..." : "Document detailed physical assessments, vitals correlation, ventilator weaning, or drug adjustments (or click Record Voice Note)..."}
              className="w-full bg-slate-50 dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none font-mono text-xs leading-relaxed"
              required
            />
          </div>

          {/* Doctor Name Display */}
          <div className="p-3 bg-slate-50 dark:bg-[#090f1d] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <User className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  {lang === 'ar' ? 'اسم الطبيب:' : 'Physician Name:'}
                </span>
                <span className="text-sm font-bold text-teal-700 dark:text-teal-300 font-sans">
                  {loggedInName}
                </span>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Lock className="w-4 h-4" />
              <span>{isSubmitting ? (lang === 'ar' ? 'جاري التوقيع والحفظ...' : 'Signing & Hashing...') : (lang === 'ar' ? 'توقيع وحفظ الملاحظة' : 'Sign & Lock Note')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
