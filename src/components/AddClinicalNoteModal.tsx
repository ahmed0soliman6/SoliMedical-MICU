import React, { useState } from 'react';
import { X, Lock, ShieldCheck, FileText, ClipboardList, User } from 'lucide-react';
import { BedNumber, StaffRole, NoteType } from '../types/schema.ts';
import { createClinicalNote } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';

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
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [noteType, setNoteType] = useState<NoteType>(NoteType.PROGRESS_NOTE);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Derive user info dynamically from currently logged in user
  const loggedInName = lang === 'ar' 
    ? currentUser?.nameAr || currentUser?.nameEn || 'مدخل بيانات غير معروف'
    : currentUser?.nameEn || currentUser?.nameAr || 'Unknown Data Entry User';

  const loggedInRole = currentUser?.role || StaffRole.RESIDENT;
  const loggedInBadgeId = currentUser?.badgeId || '9912';
  const loggedInUid = currentUser?.uid ? `staff-${currentUser.uid}` : 'staff-9912';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0c1426] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-[#090f1d] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <FileText className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? 'توقيع ملاحظة طبية رقمية جديدة' : 'Sign New Clinical Note'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {lang === 'ar' 
                  ? `تسجيل مستند طبي رسمي للمريض: ${patientName} • محمي بـ SHA-256` 
                  : `Record secure clinical document for ${patientName} • Cryptographically Locked`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors animate-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clinical Templates Panel */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-400 mb-2">
            <ClipboardList className="w-4 h-4" />
            <span>{lang === 'ar' ? 'قوالب الملاحظات الطبية الجاهزة (Clinical Presets):' : 'Medico-Clinical Presets:'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tpl)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-teal-500/50 text-[11px] text-slate-300 transition-all text-left flex items-center gap-1 cursor-pointer hover:bg-slate-800"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                <span>{lang === 'ar' ? tpl.titleAr : tpl.titleEn}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'نوع الملاحظة (Note Classification)' : 'Note Classification'}
              </label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as NoteType)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none font-sans"
              >
                <option value={NoteType.PROGRESS_NOTE}>{lang === 'ar' ? 'Progress Note (ملاحظة تقدمية)' : 'Clinical Progress Note'}</option>
                <option value={NoteType.CONSULTATION_NOTE}>{lang === 'ar' ? 'Consultation Note (رد استشارة)' : 'Clinical Consultation Note'}</option>
                <option value={NoteType.PROCEDURAL_NOTE}>{lang === 'ar' ? 'Procedural Note (إجراء طبي)' : 'Bedside Procedure Note'}</option>
                <option value={NoteType.ADMISSION_NOTE}>{lang === 'ar' ? 'Admission Note (ملاحظة دخول)' : 'Admission Progress Note'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'عنوان المستند السريري' : 'Document Title'}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === 'ar' ? "مثال: ملاحظة تقدمية يومية - تحسن الوعي" : "e.g., Daily Progress Note - Vent weaning"}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-300 font-semibold block mb-1">
              {lang === 'ar' ? 'المحتوى الطبي المفصل (Note Content)' : 'Detailed Clinical Narrative'}
            </label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={lang === 'ar' ? "اكتب السرد الطبي المفصل وخطة العلاج والملاحظات التمريضية والسريرية هنا..." : "Document detailed physical assessments, vitals correlation, ventilator weaning, or drug adjustments..."}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-3 text-white focus:border-teal-500 focus:outline-none font-mono text-xs leading-relaxed"
              required
            />
          </div>

          {/* Readonly Logged in User Display */}
          <div className="p-3.5 bg-[#090f1d] border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold leading-none">
                  {lang === 'ar' ? 'مقدم الملاحظة الرقمية (مدخل البيانات الحالي):' : 'Digital Note Author (Data Entry Clerk):'}
                </span>
                <span className="text-xs font-bold text-teal-300 font-sans mt-1 block">
                  {loggedInName}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold leading-none">
                {lang === 'ar' ? 'الدور السريري / رقم الموظف:' : 'Clinical Role / Badge ID:'}
              </span>
              <span className="text-xs font-semibold text-slate-200 mt-1 block font-mono">
                {loggedInRole} • ID: {loggedInBadgeId}
              </span>
            </div>
          </div>

          {/* Cryptographic Compliance Standard Footer */}
          <div className="p-3 bg-[#080f1e] rounded-xl border border-teal-900/40 flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0" />
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-teal-300 block">
                {lang === 'ar' ? 'معايير التوثيق الرقمي CBAHI / HIPAA' : 'CBAHI / HIPAA Compliance Standard'}
              </span>
              <p className="text-[10px] text-slate-400 leading-normal">
                {lang === 'ar' 
                  ? 'بمجرد التوقيع الرقمي للملاحظة، تصبح معزولة كلياً ومحمية تشفيرياً بصيغة SHA-256. التعديلات اللاحقة تتم حصراً كملحقات (Addendums) مرتبطة بسلسلة مشفرة متصلة.' 
                  : 'Upon digital signing, notes are locked using a SHA-256 secure hash. Standard audits and future updates can only be executed via linked addendums.'}
              </p>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold hover:text-white transition-all cursor-pointer"
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
