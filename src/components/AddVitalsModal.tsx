import React, { useState } from 'react';
import { X, Activity, Heart, Wind, Thermometer, ShieldCheck } from 'lucide-react';
import { BedNumber, StaffRole } from '../types/schema.ts';
import { addTimestampedVitals } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';
import { parseEnglishFloat, parseEnglishInt } from '../services/numberUtils.ts';
import { useAuth } from '../services/AuthContext.tsx';

interface AddVitalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patientId: string;
  patientName: string;
  onVitalsAdded: () => void;
}

export const AddVitalsModal: React.FC<AddVitalsModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patientId,
  patientName,
  onVitalsAdded,
}) => {
  const { t, lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const [heartRate, setHeartRate] = useState<number>(110);
  const [heartRhythm, setHeartRhythm] = useState<string>('Sinus Tachycardia');
  const [systolicBp, setSystolicBp] = useState<number>(95);
  const [diastolicBp, setDiastolicBp] = useState<number>(60);
  const [isArterialLine, setIsArterialLine] = useState<boolean>(true);
  const [spo2, setSpo2] = useState<number>(94);
  const [fio2, setFio2] = useState<number>(60);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(22);
  const [coreTemp, setCoreTemp] = useState<number>(38.2);
  const [tempSite, setTempSite] = useState<'FOLEY_CORE' | 'AXILLARY' | 'TYMPANIC'>('FOLEY_CORE');
  const [gcsTotal, setGcsTotal] = useState<number>(10);
  const [sedationRass, setSedationRass] = useState<number>(-2);
  const [lactate, setLactate] = useState<number>(3.2);
  const [bloodGlucose, setBloodGlucose] = useState<number>(165);
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const map = Math.round(diastolicBp + (systolicBp - diastolicBp) / 3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const userDisplay = currentUser?.nameAr || currentUser?.nameEn || currentUser?.displayName || (lang === 'ar' ? 'تمريض العناية المركزة' : 'ICU Staff RN');
      const staffId = currentUser?.badgeId || currentUser?.id || currentUser?.uid || '7721';
      const userRole = (currentUser?.role as StaffRole) || StaffRole.LEAD_RN;

      await addTimestampedVitals({
        bedId: bedNumber,
        patientId,
        heartRateBpm: parseEnglishInt(heartRate) || 110,
        heartRhythm,
        systolicBpMmHg: parseEnglishInt(systolicBp) || 95,
        diastolicBpMmHg: parseEnglishInt(diastolicBp) || 60,
        isArterialLine,
        spo2Percent: parseEnglishInt(spo2) || 94,
        fio2SuppliedPercent: parseEnglishInt(fio2) || 60,
        respiratoryRateCpm: parseEnglishInt(respiratoryRate) || 22,
        coreTemperatureCelsius: parseEnglishFloat(coreTemp) || 38.2,
        temperatureSite: tempSite,
        gcsTotalScore: parseEnglishInt(gcsTotal) || 10,
        sedationRassScore: parseEnglishInt(sedationRass) || -2,
        lactateMmolPerL: lactate ? parseEnglishFloat(lactate) : undefined,
        bloodGlucoseMgDl: bloodGlucose ? parseEnglishFloat(bloodGlucose) : undefined,
        recordedBy: {
          staffId,
          name: userDisplay,
          role: userRole,
        },
        clinicalNotes: clinicalNotes.trim() || undefined,
      });

      onVitalsAdded();
      onClose();
    } catch (err) {
      console.error(err);
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
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? 'تسجيل علامات حيوية (Bedside Telemetry)' : 'Bedside Telemetry & Vital Entry'}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {lang === 'ar' 
                  ? `سرير ${bedNumber} • مريض: ${patientName}` 
                  : `Bed ${bedNumber} • Patient: ${patientName}`}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* Blood Pressure & MAP */}
          <div className="bg-[#070c18] p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300">
                {lang === 'ar' ? 'ضغط الدم الشرياني (Arterial Line / NIBP)' : 'Arterial Blood Pressure (ABP / NIBP)'}
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                MAP: {map} mmHg
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الانقباضي (Systolic mmHg)' : 'Systolic (mmHg)'}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(Number(e.target.value))}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الانبساطي (Diastolic mmHg)' : 'Diastolic (mmHg)'}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(Number(e.target.value))}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="artLine"
                checked={isArterialLine}
                onChange={(e) => setIsArterialLine(e.target.checked)}
                className="w-4 h-4 rounded text-teal-500 bg-slate-900 border-slate-700"
              />
              <label htmlFor="artLine" className="text-slate-300 cursor-pointer">
                {lang === 'ar' 
                  ? 'شريان شرياني مباشر (Continuous Invasive Arterial Line)' 
                  : 'Continuous Invasive Arterial Line (A-Line)'}
              </label>
            </div>
          </div>

          {/* Heart Rate & Rhythm */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400 flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-red-400" />
                <span>{lang === 'ar' ? 'النبض (HR bpm)' : 'Heart Rate (bpm)'}</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={heartRate}
                onChange={(e) => setHeartRate(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'النمط القلبي (Rhythm)' : 'ECG Cardiac Rhythm'}</label>
              <select
                value={heartRhythm}
                onChange={(e) => setHeartRhythm(e.target.value)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
              >
                <option value="Sinus Tachycardia">Sinus Tachycardia</option>
                <option value="Normal Sinus Rhythm">Normal Sinus Rhythm</option>
                <option value="Atrial Fibrillation (AFib)">Atrial Fibrillation (AFib)</option>
                <option value="Sinus Bradycardia">Sinus Bradycardia</option>
              </select>
            </div>
          </div>

          {/* SpO2, FiO2 & Respiratory Rate */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] text-slate-400">SpO₂ (%)</label>
              <input
                type="number"
                inputMode="decimal"
                value={spo2}
                onChange={(e) => setSpo2(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">FiO₂ (%)</label>
              <input
                type="number"
                inputMode="decimal"
                value={fio2}
                onChange={(e) => setFio2(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 flex items-center gap-1">
                <Wind className="w-3 h-3 text-cyan-400" />
                <span>{lang === 'ar' ? 'التنفس (RR)' : 'Resp Rate (RR)'}</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Temperature & GCS / RASS */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] text-slate-400 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-amber-400" />
                <span>{lang === 'ar' ? 'حرارة (°C)' : 'Temp (°C)'}</span>
              </label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={coreTemp}
                onChange={(e) => setCoreTemp(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">GCS Score</label>
              <input
                type="number"
                min="3"
                max="15"
                inputMode="decimal"
                value={gcsTotal}
                onChange={(e) => setGcsTotal(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">RASS Score</label>
              <select
                value={sedationRass}
                onChange={(e) => setSedationRass(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:border-teal-500 focus:outline-none"
              >
                <option value="0">0 (Alert & Calm)</option>
                <option value="-1">-1 (Drowsy)</option>
                <option value="-2">-2 (Light Sedation)</option>
                <option value="-3">-3 (Moderate Sedation)</option>
                <option value="-4">-4 (Deep Sedation)</option>
                <option value="-5">-5 (Unarousable)</option>
                <option value="1">+1 (Restless)</option>
                <option value="2">+2 (Agitated)</option>
              </select>
            </div>
          </div>

          {/* Lactate & Blood Glucose */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'اللاكتات (Lactate mmol/L)' : 'Lactate (mmol/L)'}</label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={lactate}
                onChange={(e) => setLactate(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'السكر العشوائي (RBG mg/dL)' : 'Random Glucose (mg/dL)'}</label>
              <input
                type="number"
                inputMode="decimal"
                value={bloodGlucose}
                onChange={(e) => setBloodGlucose(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Submit Button */}
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
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-teal-500/20"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (lang === 'ar' ? 'اعتماد وحفظ القراءة' : 'Commit Telemetry Entry')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
