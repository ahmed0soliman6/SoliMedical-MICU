import React, { useState, useEffect } from 'react';
import { 
  Wind, 
  X, 
  Check, 
  AlertCircle, 
  Activity, 
  Trash2, 
  Sliders, 
  Layers,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { BedNumber, PatientDossier, VentilatorParameters, VentilatorMode } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase.ts';
import { COLLECTIONS } from '../types/contracts.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { toEnglishDigits, parseEnglishFloat } from '../services/numberUtils.ts';

interface VentilatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patient?: PatientDossier | null;
  initialVentilator?: VentilatorParameters | null;
  onSaved: () => void;
}

const VENTILATOR_MODES: { id: VentilatorMode; labelEn: string; labelAr: string; type: 'invasive' | 'non-invasive' | 'weaning' }[] = [
  { id: VentilatorMode.SIMV_PC, labelEn: 'SIMV-PC (Pressure Control)', labelAr: 'SIMV بالتحكم بالضغط', type: 'invasive' },
  { id: VentilatorMode.SIMV_VC, labelEn: 'SIMV-VC (Volume Control)', labelAr: 'SIMV بالتحكم بالحجم', type: 'invasive' },
  { id: VentilatorMode.PRVC, labelEn: 'PRVC (Pressure Regulated Vol)', labelAr: 'PRVC الحجم المنظم بالضغط', type: 'invasive' },
  { id: VentilatorMode.PSV_CPAP, labelEn: 'PSV / CPAP (Spontaneous)', labelAr: 'PSV / CPAP دعم الضغط العفوي', type: 'weaning' },
  { id: VentilatorMode.BIPAP, labelEn: 'BiPAP (Non-Invasive Mask)', labelAr: 'BiPAP قناع غير جائر', type: 'non-invasive' },
  { id: VentilatorMode.HIGH_FLOW_NC, labelEn: 'High-Flow Nasal Cannula (HFNC)', labelAr: 'قنية أنفية عالية التدفق HFNC', type: 'non-invasive' },
  { id: VentilatorMode.T_PIECE, labelEn: 'T-Piece Weaning Trial', labelAr: 'اختبار فطام T-Piece', type: 'weaning' },
];

export const VentilatorModal: React.FC<VentilatorModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patient,
  initialVentilator,
  onSaved,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();

  const availableModes = settings.ventilatorModes && settings.ventilatorModes.length > 0
    ? settings.ventilatorModes
    : VENTILATOR_MODES;

  const [mode, setMode] = useState<VentilatorMode | string>(
    initialVentilator?.mode || (availableModes[0]?.id as any) || VentilatorMode.PRVC
  );
  const [deviceModel, setDeviceModel] = useState<string>(initialVentilator?.deviceModel || 'Hamilton-C6 / Dräger V800');
  const [fio2, setFio2] = useState<string>(String(initialVentilator?.fio2Percent || '40'));
  const [peep, setPeep] = useState<string>(String(initialVentilator?.peepCmH2O || '8'));
  const [tidalVolume, setTidalVolume] = useState<string>(String(initialVentilator?.tidalVolumeMl || '420'));
  const [setRate, setSetRate] = useState<string>(String(initialVentilator?.setRespiratoryRateCpm || '16'));
  const [actualRate, setActualRate] = useState<string>(String(initialVentilator?.actualRespiratoryRateCpm || '18'));
  const [peakPressure, setPeakPressure] = useState<string>(String(initialVentilator?.peakInspiratoryPressureCmH2O || '22'));
  const [plateauPressure, setPlateauPressure] = useState<string>(String(initialVentilator?.plateauPressureCmH2O || '18'));
  const [ieRatio, setIeRatio] = useState<string>(initialVentilator?.ieRatio || '1:2');
  const [isWeaning, setIsWeaning] = useState<boolean>(initialVentilator?.isWeaningTrialActive || false);
  const [circuitLeak, setCircuitLeak] = useState<string>(initialVentilator?.circuitLeakPercent !== undefined ? String(initialVentilator.circuitLeakPercent) : '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hasInitialized, setHasInitialized] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
      return;
    }
    if (isOpen && !hasInitialized) {
      if (initialVentilator) {
        setMode(initialVentilator.mode);
        setDeviceModel(initialVentilator.deviceModel || 'Hamilton-C6 / Dräger V800');
        setFio2(String(initialVentilator.fio2Percent || '40'));
        setPeep(String(initialVentilator.peepCmH2O || '8'));
        setTidalVolume(String(initialVentilator.tidalVolumeMl || '420'));
        setSetRate(String(initialVentilator.setRespiratoryRateCpm || '16'));
        setActualRate(String(initialVentilator.actualRespiratoryRateCpm || '18'));
        setPeakPressure(String(initialVentilator.peakInspiratoryPressureCmH2O || '22'));
        setPlateauPressure(String(initialVentilator.plateauPressureCmH2O || '18'));
        setIeRatio(initialVentilator.ieRatio || '1:2');
        setIsWeaning(initialVentilator.isWeaningTrialActive || false);
        setCircuitLeak(initialVentilator.circuitLeakPercent !== undefined ? String(initialVentilator.circuitLeakPercent) : '');
      }
      setHasInitialized(true);
    }
  }, [isOpen, initialVentilator, hasInitialized]);

  if (!isOpen) return null;

  // Real-time calculations
  const parsedPplat = parseEnglishFloat(plateauPressure);
  const parsedPeep = parseEnglishFloat(peep);
  const calculatedDrivingPressure = (parsedPplat > 0 && parsedPeep > 0) ? Math.max(0, parsedPplat - parsedPeep) : null;
  const parsedVt = parseEnglishFloat(tidalVolume);
  const ibw = patient?.idealBodyWeightKg || (patient?.gender === 'MALE' ? 70 : 60) || 70;
  const vtPerKg = ibw > 0 && parsedVt > 0 ? (parsedVt / ibw).toFixed(1) : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const patientId = patient?.id || 'unknown_patient';

    try {
      const existingRecordId = initialVentilator?.id || `vent_${bedNumber}_${patientId}`;
      const existingRecord = await db.ventilators.get(existingRecordId);
      const existingHistory = existingRecord?.history || [];

      const newHistoryEntry = {
        id: `vent_hist_${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode,
        fio2Percent: parseEnglishFloat(fio2) || 40,
        peepCmH2O: parseEnglishFloat(peep) || 5,
        tidalVolumeMl: parseEnglishFloat(tidalVolume) || 420,
        recordedByStaffName: currentUser?.nameEn || currentUser?.nameAr || 'Dr. Guest',
        recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
        deviceModel: deviceModel.trim(),
        setRespiratoryRateCpm: parseEnglishFloat(setRate) || 14,
        actualRespiratoryRateCpm: parseEnglishFloat(actualRate) || 16,
        peakInspiratoryPressureCmH2O: parseEnglishFloat(peakPressure) || 20,
        plateauPressureCmH2O: parseEnglishFloat(plateauPressure) || 16,
        drivingPressureCmH2O: calculatedDrivingPressure || (parseEnglishFloat(plateauPressure) - parseEnglishFloat(peep)),
        ieRatio: ieRatio.trim(),
        circuitLeakPercent: parseEnglishFloat(circuitLeak) || 0,
      };

      const ventRecord: VentilatorParameters = {
        id: existingRecordId,
        bedId: bedNumber,
        patientId: patientId,
        timestamp: new Date().toISOString(),
        deviceModel: deviceModel.trim(),
        mode,
        fio2Percent: parseEnglishFloat(fio2) || 40,
        peepCmH2O: parseEnglishFloat(peep) || 5,
        tidalVolumeMl: parseEnglishFloat(tidalVolume) || 420,
        peakInspiratoryPressureCmH2O: parseEnglishFloat(peakPressure) || 20,
        plateauPressureCmH2O: parseEnglishFloat(plateauPressure) || 16,
        drivingPressureCmH2O: calculatedDrivingPressure || (parseEnglishFloat(plateauPressure) - parseEnglishFloat(peep)),
        setRespiratoryRateCpm: parseEnglishFloat(setRate) || 14,
        actualRespiratoryRateCpm: parseEnglishFloat(actualRate) || 16,
        ieRatio: ieRatio.trim(),
        isWeaningTrialActive: isWeaning,
        circuitLeakPercent: parseEnglishFloat(circuitLeak) || 0,
        recordedByStaffName: currentUser?.nameEn || currentUser?.nameAr || 'Dr. Guest',
        history: [...existingHistory, newHistoryEntry],
      };

      // Save to Dexie
      await db.ventilators.put(ventRecord);

      // Save to Firebase
      try {
        const ventRef = doc(firestore, 'ventilators', ventRecord.id);
        await setDoc(ventRef, {
          ...ventRecord,
          updatedAt: Date.now(),
        });
      } catch (cloudErr) {
        console.warn('Firestore offline sync will queue ventilator record:', cloudErr);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving ventilator record:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل حفظ بيانات جهاز التنفس' : 'Failed to save ventilator parameters'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveVentilator = async () => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من فصل جهاز التنفس وتأكيد تنفس المريض تلقائياً (Extubated/Room Air)؟' : 'Confirm ventilator discontinuation (patient breathing spontaneously)?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const existing = await db.ventilators.where('bedId').equals(bedNumber).first();
      if (existing) {
        await db.ventilators.delete(existing.id);
        try {
          const ventRef = doc(firestore, 'ventilators', existing.id);
          await deleteDoc(ventRef);
        } catch (cloudErr) {
          console.warn('Firestore delete offline sync:', cloudErr);
        }
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to remove ventilator:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل إزالة الجهاز' : 'Failed to discontinue ventilator'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#091122] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? `جهاز التنفس الصناعي - سرير ${bedNumber}` : `Ventilator Management - Bed ${bedNumber}`}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  {patient?.fullNameAr || patient?.fullNameEn || `Bed ${bedNumber}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'إدخال وتعديل معاملات التهوية الميكانيكية ومعايير حماية الرئة' : 'Configure mechanical ventilation & lung-protective metrics'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {lang === 'ar' ? 'وضعية التهوية (Ventilator Mode):' : 'Ventilator Mode:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableModes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id as any)}
                  className={`p-2.5 rounded-xl text-xs font-bold transition-all text-left border cursor-pointer ${
                    mode === m.id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-[#060b17] text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="font-mono text-[11px] text-white">{m.id}</div>
                  <div className="text-[10px] text-slate-400 truncate">{lang === 'ar' ? m.labelAr : m.labelEn}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Lung Protective Status Strip */}
          <div className="p-3 rounded-xl bg-[#060d1b] border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div>
              <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'حجم التنفس لكل كجم IBW:' : 'Vt / kg IBW:'}</div>
              <div className="text-teal-300 font-bold text-sm">
                {vtPerKg ? `${vtPerKg} mL/kg` : '—'} 
                <span className="text-[10px] font-normal text-slate-400 ml-1">(IBW: {ibw}kg)</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'ضغط القيادة (Driving P):' : 'Driving Pressure (ΔP):'}</div>
              <div className={`font-bold text-sm ${calculatedDrivingPressure && calculatedDrivingPressure > 14 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {calculatedDrivingPressure !== null ? `${calculatedDrivingPressure} cmH2O` : '—'}
                <span className="text-[9px] font-normal text-slate-500 ml-1">(&lt; 14 safe)</span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'نموذج الجهاز:' : 'Ventilator Model:'}</div>
              <input
                type="text"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                className="w-full bg-transparent border-b border-slate-700 text-slate-200 text-xs py-0.5 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Numerical Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* FiO2 */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                FiO₂ (%)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={fio2}
                  onChange={(e) => setFio2(toEnglishDigits(e.target.value))}
                  placeholder="21 - 100"
                  required
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-teal-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-mono">%</span>
              </div>
            </div>

            {/* PEEP */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                PEEP (cmH2O)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={peep}
                onChange={(e) => setPeep(toEnglishDigits(e.target.value))}
                placeholder="0 - 24"
                required
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Tidal Volume (Vt) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tidal Volume (mL)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={tidalVolume}
                onChange={(e) => setTidalVolume(toEnglishDigits(e.target.value))}
                placeholder="300 - 650"
                required
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Set Rate */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Set Rate (RR bpm)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={setRate}
                onChange={(e) => setSetRate(toEnglishDigits(e.target.value))}
                placeholder="10 - 35"
                required
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Peak Pressure PIP */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Ppeak / PIP (cmH2O)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={peakPressure}
                onChange={(e) => setPeakPressure(toEnglishDigits(e.target.value))}
                placeholder="15 - 40"
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Plateau Pressure Pplat */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Pplat (cmH2O)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={plateauPressure}
                onChange={(e) => setPlateauPressure(toEnglishDigits(e.target.value))}
                placeholder="10 - 30"
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-indigo-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Actual Rate */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Actual Total RR
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={actualRate}
                onChange={(e) => setActualRate(toEnglishDigits(e.target.value))}
                placeholder="12 - 40"
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* I:E Ratio */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                I:E Ratio
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={ieRatio}
                onChange={(e) => setIeRatio(toEnglishDigits(e.target.value))}
                placeholder="1:2"
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Weaning & Leak Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#060d1b] border border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
              <input
                type="checkbox"
                checked={isWeaning}
                onChange={(e) => setIsWeaning(e.target.checked)}
                className="w-4 h-4 rounded text-teal-500 bg-slate-900 border-slate-700 focus:ring-0"
              />
              <span>{lang === 'ar' ? 'المريض في مرحلة اختبار الفطام (Weaning SBT Active)' : 'Active Weaning Trial (SBT / PSV Trial)'}</span>
            </label>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 text-[10px]">{lang === 'ar' ? 'التسريب:' : 'Leak:'}</span>
              <input
                type="text"
                inputMode="decimal"
                value={circuitLeak}
                onChange={(e) => setCircuitLeak(toEnglishDigits(e.target.value))}
                className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-slate-200 text-xs"
              />
              <span className="text-slate-500">%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
            {initialVentilator ? (
              <button
                type="button"
                onClick={handleRemoveVentilator}
                disabled={isSubmitting}
                className="px-3 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/80 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>{lang === 'ar' ? 'فصل الجهاز (تنفس تلقائي)' : 'Discontinue / Extubated'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 text-slate-950" />
                <span>{lang === 'ar' ? 'حفظ إعدادات التنفس' : 'Save Ventilator Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
