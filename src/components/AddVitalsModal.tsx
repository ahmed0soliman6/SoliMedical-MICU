import React, { useState, useEffect } from 'react';
import { X, Activity, Heart, Wind, Thermometer, ShieldCheck, Pencil } from 'lucide-react';
import { BedNumber, StaffRole, TelemetryVitals } from '../types/schema.ts';
import { addTimestampedVitals } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';
import { parseEnglishFloat, parseEnglishInt, toEnglishDigits } from '../services/numberUtils.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { db } from '../db/icuSyncDb.ts';

interface AddVitalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patientId: string;
  patientName: string;
  onVitalsAdded: () => void;
  vitalsToEdit?: TelemetryVitals | null;
}

export const AddVitalsModal: React.FC<AddVitalsModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patientId,
  patientName,
  onVitalsAdded,
  vitalsToEdit,
}) => {
  const { t, lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const [heartRate, setHeartRate] = useState<string>('');
  const [heartRhythm, setHeartRhythm] = useState<string>('Normal Sinus Rhythm');
  const [systolicBp, setSystolicBp] = useState<string>('');
  const [diastolicBp, setDiastolicBp] = useState<string>('');
  const [isArterialLine, setIsArterialLine] = useState<boolean>(true);
  const [spo2, setSpo2] = useState<string>('');
  const [fio2, setFio2] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [coreTemp, setCoreTemp] = useState<string>('');
  const [tempSite, setTempSite] = useState<'FOLEY_CORE' | 'AXILLARY' | 'TYMPANIC'>('FOLEY_CORE');
  const [gcsTotal, setGcsTotal] = useState<string>('');
  const [sedationRass, setSedationRass] = useState<string>('0');
  const [cvp, setCvp] = useState<string>('');
  const [bloodGlucose, setBloodGlucose] = useState<string>('');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (vitalsToEdit) {
      setHeartRate(vitalsToEdit.heartRateBpm !== undefined && vitalsToEdit.heartRateBpm !== null ? String(vitalsToEdit.heartRateBpm) : '');
      setHeartRhythm(vitalsToEdit.heartRhythm || 'Normal Sinus Rhythm');
      setSystolicBp(vitalsToEdit.systolicBpMmHg !== undefined && vitalsToEdit.systolicBpMmHg !== null ? String(vitalsToEdit.systolicBpMmHg) : '');
      setDiastolicBp(vitalsToEdit.diastolicBpMmHg !== undefined && vitalsToEdit.diastolicBpMmHg !== null ? String(vitalsToEdit.diastolicBpMmHg) : '');
      setIsArterialLine(vitalsToEdit.isArterialLine ?? true);
      setSpo2(vitalsToEdit.spo2Percent !== undefined && vitalsToEdit.spo2Percent !== null ? String(vitalsToEdit.spo2Percent) : '');
      setFio2(vitalsToEdit.fio2SuppliedPercent !== undefined && vitalsToEdit.fio2SuppliedPercent !== null ? String(vitalsToEdit.fio2SuppliedPercent) : '');
      setRespiratoryRate(vitalsToEdit.respiratoryRateCpm !== undefined && vitalsToEdit.respiratoryRateCpm !== null ? String(vitalsToEdit.respiratoryRateCpm) : '');
      setCoreTemp(vitalsToEdit.coreTemperatureCelsius !== undefined && vitalsToEdit.coreTemperatureCelsius !== null ? String(vitalsToEdit.coreTemperatureCelsius) : '');
      if (vitalsToEdit.temperatureSite) setTempSite(vitalsToEdit.temperatureSite as any);
      setGcsTotal(vitalsToEdit.gcsTotalScore !== undefined && vitalsToEdit.gcsTotalScore !== null ? String(vitalsToEdit.gcsTotalScore) : '');
      if (vitalsToEdit.sedationRassScore !== undefined && vitalsToEdit.sedationRassScore !== null) {
        setSedationRass(String(vitalsToEdit.sedationRassScore));
      } else {
        setSedationRass('0');
      }
      setCvp(vitalsToEdit.cvpMmHg !== undefined && vitalsToEdit.cvpMmHg !== null ? String(vitalsToEdit.cvpMmHg) : '');
      setBloodGlucose(vitalsToEdit.bloodGlucoseMgDl !== undefined && vitalsToEdit.bloodGlucoseMgDl !== null ? String(vitalsToEdit.bloodGlucoseMgDl) : '');
      setClinicalNotes(vitalsToEdit.clinicalNotes || '');
    } else {
      setHeartRate('');
      setHeartRhythm('Normal Sinus Rhythm');
      setSystolicBp('');
      setDiastolicBp('');
      setIsArterialLine(true);
      setSpo2('');
      setFio2('');
      setRespiratoryRate('');
      setCoreTemp('');
      setTempSite('FOLEY_CORE');
      setGcsTotal('');
      setSedationRass('0');
      setCvp('');
      setBloodGlucose('');
      setClinicalNotes('');
    }
  }, [vitalsToEdit, isOpen]);

  if (!isOpen) return null;

  const sysVal = parseEnglishInt(systolicBp) || 0;
  const diaVal = parseEnglishInt(diastolicBp) || 0;
  const map = sysVal && diaVal ? Math.round(diaVal + (sysVal - diaVal) / 3) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const userDisplay = currentUser?.nameAr || currentUser?.nameEn || currentUser?.displayName || currentUser?.email || (lang === 'ar' ? 'تمريض العناية المركزة' : 'ICU Staff RN');
      const staffId = currentUser?.badgeId || currentUser?.id || currentUser?.uid || '7721';
      const userRole = (currentUser?.role as StaffRole) || StaffRole.LEAD_RN;

      if (vitalsToEdit) {
        const updatedVitals: TelemetryVitals = {
          ...vitalsToEdit,
          heartRateBpm: parseEnglishInt(heartRate) || 80,
          heartRhythm,
          systolicBpMmHg: parseEnglishInt(systolicBp) || 120,
          diastolicBpMmHg: parseEnglishInt(diastolicBp) || 80,
          meanArterialPressureMmHg: map || 93,
          isArterialLine,
          spo2Percent: parseEnglishInt(spo2) || 98,
          fio2SuppliedPercent: parseEnglishInt(fio2) || 21,
          respiratoryRateCpm: parseEnglishInt(respiratoryRate) || 16,
          coreTemperatureCelsius: parseEnglishFloat(coreTemp) || 37.0,
          temperatureSite: tempSite,
          gcsTotalScore: parseEnglishInt(gcsTotal) || 15,
          sedationRassScore: !isNaN(parseEnglishInt(sedationRass)) ? parseEnglishInt(sedationRass) : 0,
          cvpMmHg: cvp ? parseEnglishInt(cvp) : undefined,
          bloodGlucoseMgDl: bloodGlucose ? parseEnglishFloat(bloodGlucose) : undefined,
          clinicalNotes: clinicalNotes.trim() || undefined,
          recordedBy: {
            staffId,
            name: userDisplay,
            role: userRole,
          },
        };
        await db.vitals.put(updatedVitals);
      } else {
        await addTimestampedVitals({
          bedId: bedNumber,
          patientId,
          heartRateBpm: parseEnglishInt(heartRate) || 80,
          heartRhythm,
          systolicBpMmHg: parseEnglishInt(systolicBp) || 120,
          diastolicBpMmHg: parseEnglishInt(diastolicBp) || 80,
          isArterialLine,
          spo2Percent: parseEnglishInt(spo2) || 98,
          fio2SuppliedPercent: parseEnglishInt(fio2) || 21,
          respiratoryRateCpm: parseEnglishInt(respiratoryRate) || 16,
          coreTemperatureCelsius: parseEnglishFloat(coreTemp) || 37.0,
          temperatureSite: tempSite,
          gcsTotalScore: parseEnglishInt(gcsTotal) || 15,
          sedationRassScore: !isNaN(parseEnglishInt(sedationRass)) ? parseEnglishInt(sedationRass) : 0,
          cvpMmHg: cvp ? parseEnglishInt(cvp) : undefined,
          bloodGlucoseMgDl: bloodGlucose ? parseEnglishFloat(bloodGlucose) : undefined,
          recordedBy: {
            staffId,
            name: userDisplay,
            role: userRole,
          },
          clinicalNotes: clinicalNotes.trim() || undefined,
        });
      }

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
              {vitalsToEdit ? <Pencil className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {vitalsToEdit
                  ? (lang === 'ar' ? 'تعديل القراءة الحيوية' : 'Edit Vital Signs Reading')
                  : (lang === 'ar' ? 'تسجيل علامات حيوية (Bedside Telemetry)' : 'Bedside Telemetry & Vital Entry')}
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
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
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
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(toEnglishDigits(e.target.value))}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">
                  {lang === 'ar' ? 'الانبساطي (Diastolic mmHg)' : 'Diastolic (mmHg)'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(toEnglishDigits(e.target.value))}
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
                type="text"
                inputMode="numeric"
                value={heartRate}
                onChange={(e) => setHeartRate(toEnglishDigits(e.target.value))}
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
                <option value="Normal Sinus Rhythm">Normal Sinus Rhythm</option>
                <option value="Sinus Tachycardia">Sinus Tachycardia</option>
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
                type="text"
                inputMode="numeric"
                value={spo2}
                onChange={(e) => setSpo2(toEnglishDigits(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">FiO₂ (%)</label>
              <input
                type="text"
                inputMode="numeric"
                value={fio2}
                onChange={(e) => setFio2(toEnglishDigits(e.target.value))}
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
                type="text"
                inputMode="numeric"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(toEnglishDigits(e.target.value))}
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
                type="text"
                inputMode="decimal"
                value={coreTemp}
                onChange={(e) => setCoreTemp(toEnglishDigits(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">GCS Score</label>
              <input
                type="text"
                inputMode="numeric"
                value={gcsTotal}
                onChange={(e) => setGcsTotal(toEnglishDigits(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">RASS Score</label>
              <select
                value={sedationRass}
                onChange={(e) => setSedationRass(e.target.value)}
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

          {/* CVP & Blood Glucose */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'الضغط الوريدي المركزي CVP (mmHg)' : 'Central Venous Pressure CVP (mmHg)'}</label>
              <input
                type="text"
                inputMode="numeric"
                value={cvp}
                onChange={(e) => setCvp(toEnglishDigits(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'السكر العشوائي (RBG mg/dL)' : 'Random Glucose (mg/dL)'}</label>
              <input
                type="text"
                inputMode="numeric"
                value={bloodGlucose}
                onChange={(e) => setBloodGlucose(toEnglishDigits(e.target.value))}
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
