import React, { useState } from 'react';
import { X, Activity, ShieldCheck } from 'lucide-react';
import { BedNumber, StaffRole, CodeStatus } from '../types/schema.ts';
import { signSbarHandover } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';

interface SbarSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patientId: string;
  patientName: string;
  primaryDiagnosis: string;
  codeStatus: CodeStatus;
  onHandoverSigned: () => void;
}

export const SbarSignModal: React.FC<SbarSignModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patientId,
  patientName,
  primaryDiagnosis,
  codeStatus,
  onHandoverSigned,
}) => {
  const { t, lang, isRTL } = useTranslation();
  const [shiftType, setShiftType] = useState<'NIGHT' | 'DAY'>('NIGHT');
  const [situation, setSituation] = useState<string>(
    `Patient in Bed ${bedNumber} admitted with ${primaryDiagnosis}. Currently on Norepinephrine infusion and mechanical ventilation.`
  );
  const [background, setBackground] = useState<string>(
    `Day 2 of ICU admission. Intubated on admission due to severe respiratory failure. Code Status: ${codeStatus}.`
  );
  const [hemodynamics, setHemodynamics] = useState<string>('Stable on low dose Norepinephrine. MAP > 68 mmHg.');
  const [pulmonary, setPulmonary] = useState<string>('Ventilated on PRVC/AC. Driving pressure 11 cmH2O. P/F ratio 220.');
  const [metabolic, setMetabolic] = useState<string>('Urine output 45 mL/hr. Lactate down to 2.1 mmol/L.');
  const [recommendation, setRecommendation] = useState<string>(
    `1. Continue Noradrenaline wean as tolerated.\n2. Repeat morning ABG and Electrolytes at 06:00.\n3. Attempt Spontaneous Breathing Trial (SBT).\n4. Maintain net negative fluid balance.`
  );
  const [departingStaffName, setDepartingStaffName] = useState<string>('Dr. Tarek Fouad');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await signSbarHandover({
        bedId: bedNumber,
        patientId,
        shiftType,
        shiftDate: today,
        shiftStartTime: shiftType === 'NIGHT' ? '19:00' : '07:00',
        shiftEndTime: shiftType === 'NIGHT' ? '07:00' : '19:00',
        situation: situation.trim(),
        background: background.trim(),
        assessment: {
          hemodynamics,
          pulmonaryAndAirway: pulmonary,
          metabolicAndRenal: metabolic,
          neurologyAndSedation: 'RASS -1 to 0 on low propofol',
          infectiousDiseaseAndAntibiotics: 'Meropenem + Vancomycin Day 3',
        },
        recommendationAndOrders: recommendation.split('\n').filter(r => r.trim().length > 0),
        outgoingDoctor: {
          staffId: 'DOC-102',
          name: departingStaffName,
          role: StaffRole.SPECIALIST,
        },
      });

      onHandoverSigned();
      onClose();
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء اعتماد وتسجيل تسليم المناوبة.' : 'Error signing SBAR handover.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0c1426] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-[#090f1d] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {lang === 'ar' ? 'تسليم المناوبة السريري (SBAR Shift Handover)' : 'Clinical Shift Handover (SBAR)'}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {lang === 'ar'
                  ? `سرير ${bedNumber} • ${patientName} • حالة الإنعاش: ${codeStatus}`
                  : `Bed ${bedNumber} • ${patientName} • Code Status: ${codeStatus}`}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
          {/* Shift Type Selection */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] text-slate-300 font-semibold flex-shrink-0">
              {lang === 'ar' ? 'نوع المناوبة:' : 'Shift Type:'}
            </label>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { id: 'NIGHT', label: lang === 'ar' ? 'المناوبة الليلية (Night Shift)' : 'Night Shift (19:00 - 07:00)' },
                { id: 'DAY', label: lang === 'ar' ? 'المناوبة الصباحية (Day Shift)' : 'Day Shift (07:00 - 19:00)' },
              ].map((shift) => (
                <button
                  type="button"
                  key={shift.id}
                  onClick={() => setShiftType(shift.id as any)}
                  className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all ${
                    shiftType === shift.id
                      ? 'bg-teal-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {shift.label}
                </button>
              ))}
            </div>
          </div>

          {/* S - Situation */}
          <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-teal-400 font-bold font-mono">
              <span className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center text-xs">S</span>
              <span>{lang === 'ar' ? 'Situation (الموقف الحالي والتشخيص)' : 'Situation (Current Diagnosis & Active Problems)'}</span>
            </div>
            <textarea
              rows={2}
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-500 focus:outline-none"
              required
            />
          </div>

          {/* B - Background */}
          <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold font-mono">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">B</span>
              <span>{lang === 'ar' ? 'Background (الخلفية المرضية ومسار الدخول)' : 'Background (Clinical Timeline & Comorbidities)'}</span>
            </div>
            <textarea
              rows={2}
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-500 focus:outline-none"
              required
            />
          </div>

          {/* A - Assessment */}
          <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold font-mono">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">A</span>
              <span>{lang === 'ar' ? 'Assessment (التقييم السريري، الغازات والمونيتور)' : 'Assessment (Organ Systems, Vent, & Labs)'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder={lang === 'ar' ? "الدورة الدموية والضغط (Hemodynamics)" : "Hemodynamics & Pressors"}
                value={hemodynamics}
                onChange={(e) => setHemodynamics(e.target.value)}
                className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-white"
              />
              <input
                type="text"
                placeholder={lang === 'ar' ? "التنفس والرئة (Pulmonary/Vent)" : "Pulmonary & Mechanics"}
                value={pulmonary}
                onChange={(e) => setPulmonary(e.target.value)}
                className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-white"
              />
              <input
                type="text"
                placeholder={lang === 'ar' ? "الكلى والسوائل (Renal/Fluids)" : "Renal, Fluid & I/O"}
                value={metabolic}
                onChange={(e) => setMetabolic(e.target.value)}
                className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-white"
              />
            </div>
          </div>

          {/* R - Recommendation */}
          <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">R</span>
              <span>{lang === 'ar' ? 'Recommendation (الخطة العلاجية والتوجيهات)' : 'Recommendation (Orders, Weaning, & Contingencies)'}</span>
            </div>
            <textarea
              rows={3}
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg p-2.5 text-white focus:border-teal-500 focus:outline-none"
              required
            />
          </div>

          {/* Doctors Signatures */}
          <div>
            <label className="text-[11px] text-slate-300 font-semibold">
              {lang === 'ar' ? 'الطبيب المُسَلِّم (Departing Staff)' : 'Outgoing Attending Physician'}
            </label>
            <input
              type="text"
              value={departingStaffName}
              onChange={(e) => setDepartingStaffName(e.target.value)}
              className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
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
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-teal-500/25 active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>{isSubmitting ? (lang === 'ar' ? 'جاري التوقيع...' : 'Signing...') : (lang === 'ar' ? 'توقيع واعتماد التسليم SBAR' : 'Authenticate & Sign SBAR')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
