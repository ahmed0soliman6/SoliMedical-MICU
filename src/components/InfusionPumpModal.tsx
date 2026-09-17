import React, { useState, useEffect } from 'react';
import { 
  Droplet, 
  X, 
  Check, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Square, 
  Sliders, 
  Sparkles,
  Zap
} from 'lucide-react';
import { BedNumber, PatientDossier, InfusionPumpLine, PumpStatus } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase.ts';
import { COLLECTIONS } from '../types/contracts.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { InfusionDrugPreset, DEFAULT_INFUSION_DRUGS } from '../types/settings.ts';
import { toEnglishDigits, parseEnglishFloat } from '../services/numberUtils.ts';

interface InfusionPumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patient?: PatientDossier | null;
  editingPump?: InfusionPumpLine | null;
  onSaved: () => void;
}

const COMMON_ICU_DRUGS: {
  nameEn: string;
  nameAr: string;
  defaultCarrier: string;
  defaultUnit: 'mcg/kg/min' | 'mcg/h' | 'mg/h' | 'Units/hr' | 'ml/h';
  defaultRate: number;
  defaultFlowRate: number;
  defaultTarget: string;
}[] = [
  { nameEn: 'Noradrenaline (Norepinephrine)', nameAr: 'نورأدرينالين', defaultCarrier: '4 mg in 50 mL D5W (80 mcg/mL)', defaultUnit: 'mcg/kg/min', defaultRate: 0.1, defaultFlowRate: 3.8, defaultTarget: 'Target MAP ≥ 65 mmHg' },
  { nameEn: 'Adrenaline (Epinephrine)', nameAr: 'أدرينالين', defaultCarrier: '4 mg in 50 mL D5W (80 mcg/mL)', defaultUnit: 'mcg/kg/min', defaultRate: 0.05, defaultFlowRate: 2.0, defaultTarget: 'Inotropic support & SBP > 90' },
  { nameEn: 'Dopamine', nameAr: 'دوبامين', defaultCarrier: '200 mg in 50 mL D5W (4 mg/mL)', defaultUnit: 'mcg/kg/min', defaultRate: 5.0, defaultFlowRate: 5.2, defaultTarget: 'Renal/Inotropic Support' },
  { nameEn: 'Dobutamine', nameAr: 'دوبيوتامين', defaultCarrier: '250 mg in 50 mL D5W (5 mg/mL)', defaultUnit: 'mcg/kg/min', defaultRate: 5.0, defaultFlowRate: 4.2, defaultTarget: 'Cardiac Index > 2.5 L/min' },
  { nameEn: 'Vasopressin', nameAr: 'فازوبريسين', defaultCarrier: '20 Units in 50 mL NS (0.4 U/mL)', defaultUnit: 'Units/hr', defaultRate: 0.03, defaultFlowRate: 4.5, defaultTarget: 'Refractory Septic Shock' },
  { nameEn: 'Regular Insulin (Actrapid)', nameAr: 'إنسولين عادي', defaultCarrier: '50 Units in 50 mL NS (1 U/mL)', defaultUnit: 'Units/hr', defaultRate: 3.0, defaultFlowRate: 3.0, defaultTarget: 'Target BG: 140-180 mg/dL' },
  { nameEn: 'Propofol 1%', nameAr: 'بروبوفول', defaultCarrier: '1000 mg in 100 mL Neat (10 mg/mL)', defaultUnit: 'mg/h', defaultRate: 100, defaultFlowRate: 10.0, defaultTarget: 'Target RASS: -2 to -3' },
  { nameEn: 'Fentanyl', nameAr: 'فنتانيل', defaultCarrier: '1000 mcg in 50 mL NS (20 mcg/mL)', defaultUnit: 'mcg/h', defaultRate: 50, defaultFlowRate: 2.5, defaultTarget: 'Analgesia (CPOT score < 2)' },
  { nameEn: 'Midazolam (Dormicum)', nameAr: 'ميدازولام', defaultCarrier: '50 mg in 50 mL NS (1 mg/mL)', defaultUnit: 'mg/h', defaultRate: 3.0, defaultFlowRate: 3.0, defaultTarget: 'Sedation / Anxiolysis' },
  { nameEn: 'Furosemide (Lasix)', nameAr: 'لازيكس', defaultCarrier: '200 mg in 50 mL NS (4 mg/mL)', defaultUnit: 'mg/h', defaultRate: 10.0, defaultFlowRate: 2.5, defaultTarget: 'Target Urine Output > 0.5 mL/kg/h' },
  { nameEn: 'Heparin Infusion', nameAr: 'هيبارين وريدي', defaultCarrier: '25,000 Units in 250 mL D5W (100 U/mL)', defaultUnit: 'Units/hr', defaultRate: 1000, defaultFlowRate: 10.0, defaultTarget: 'Target aPTT: 60-85 sec' },
  { nameEn: 'Potassium Chloride (KCl)', nameAr: 'بوتاسيوم وريدي', defaultCarrier: '40 mmol in 500 mL NS (Central)', defaultUnit: 'ml/h', defaultRate: 50, defaultFlowRate: 50.0, defaultTarget: 'Correction of Hypokalemia' },
  { nameEn: 'Normal Saline 0.9%', nameAr: 'محلول ملحي عادي', defaultCarrier: '500 mL IV Bag', defaultUnit: 'ml/h', defaultRate: 80, defaultFlowRate: 80.0, defaultTarget: 'Hydration & Maintenance' },
];

export const InfusionPumpModal: React.FC<InfusionPumpModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patient,
  editingPump,
  onSaved,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();

  const availableDrugs = settings.infusionDrugs && settings.infusionDrugs.length > 0
    ? settings.infusionDrugs
    : DEFAULT_INFUSION_DRUGS;

  const [drugNameEn, setDrugNameEn] = useState('');
  const [drugNameAr, setDrugNameAr] = useState('');
  const [pumpChannel, setPumpChannel] = useState<'PUMP_A' | 'PUMP_B' | 'PUMP_C' | 'PUMP_D'>('PUMP_A');
  const [lineAccessType, setLineAccessType] = useState<'CVC_LINE_1' | 'CVC_LINE_2' | 'CVC_LINE_3' | 'PERIPHERAL' | 'ARTERIAL'>('CVC_LINE_1');
  const [solutionCarrier, setSolutionCarrier] = useState('');
  const [currentRate, setCurrentRate] = useState('');
  const [rateUnit, setRateUnit] = useState<'mcg/kg/min' | 'mcg/h' | 'mg/h' | 'Units/hr' | 'ml/h'>('mcg/kg/min');
  const [flowRateMlPerHour, setFlowRateMlPerHour] = useState('');
  const [remainingVolumeMl, setRemainingVolumeMl] = useState('50');
  const [totalVolumeMl, setTotalVolumeMl] = useState('50');
  const [status, setStatus] = useState<PumpStatus>(PumpStatus.RUNNING);
  const [clinicalTargetDescription, setClinicalTargetDescription] = useState('Target MAP > 65 mmHg');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const applyDrugTemplate = (tpl: InfusionDrugPreset) => {
    setDrugNameEn(tpl.nameEn);
    setDrugNameAr(tpl.nameAr);
    setSolutionCarrier(tpl.defaultCarrier);
    setRateUnit(tpl.defaultUnit);
    setCurrentRate(String(tpl.defaultRate));
    setFlowRateMlPerHour(String(tpl.defaultFlowRate));
    setClinicalTargetDescription(tpl.defaultTarget);
    setRemainingVolumeMl('50');
    setTotalVolumeMl('50');
    setStatus(PumpStatus.RUNNING);
  };

  useEffect(() => {
    if (!isOpen) return;

    if (editingPump) {
      setDrugNameEn(editingPump.drugNameEn);
      setDrugNameAr(editingPump.drugNameAr || '');
      setPumpChannel(editingPump.pumpChannel || 'PUMP_A');
      setLineAccessType(editingPump.lineAccessType || 'CVC_LINE_1');
      setSolutionCarrier(editingPump.solutionCarrier || '');
      setCurrentRate(String(editingPump.currentRate || '0'));
      setRateUnit(editingPump.rateUnit || 'mcg/kg/min');
      setFlowRateMlPerHour(String(editingPump.flowRateMlPerHour || '0'));
      setRemainingVolumeMl(String(editingPump.remainingVolumeMl || '50'));
      setTotalVolumeMl(String(editingPump.totalVolumeMl || '50'));
      setStatus(editingPump.status || PumpStatus.RUNNING);
      setClinicalTargetDescription(editingPump.clinicalTargetDescription || '');
    } else if (availableDrugs.length > 0) {
      // Default to first available drug
      applyDrugTemplate(availableDrugs[0]);
    }
  }, [editingPump, isOpen, availableDrugs]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!drugNameEn.trim()) {
      setErrorMessage(lang === 'ar' ? 'يرجى تحديد اسم الدواء أو المحلول' : 'Please provide medication name');
      setIsSubmitting(false);
      return;
    }

    const patientId = patient?.id || 'unknown_patient';

    try {
      const pumpRecord: InfusionPumpLine = {
        id: editingPump?.id || `pump_${patientId}_${Date.now()}`,
        bedId: bedNumber,
        patientId: patientId,
        pumpChannel,
        lineAccessType,
        drugNameEn: drugNameEn.trim(),
        drugNameAr: drugNameAr.trim() || undefined,
        solutionCarrier: solutionCarrier.trim(),
        currentRate: parseEnglishFloat(currentRate) || 0,
        rateUnit,
        flowRateMlPerHour: parseEnglishFloat(flowRateMlPerHour) || 0,
        status,
        clinicalTargetDescription: clinicalTargetDescription.trim(),
        remainingVolumeMl: parseEnglishFloat(remainingVolumeMl) || 0,
        totalVolumeMl: parseEnglishFloat(totalVolumeMl) || 50,
      };

      // Save to Dexie
      await db.infusionPumps.put(pumpRecord);

      // Save to Firebase
      try {
        const pumpRef = doc(firestore, 'infusion_pumps', pumpRecord.id);
        await setDoc(pumpRef, {
          ...pumpRecord,
          updatedAt: Date.now(),
        });
      } catch (cloudErr) {
        console.warn('Firestore offline sync will queue pump line:', cloudErr);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving infusion pump line:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل حفظ مضخة المحلول' : 'Failed to save infusion pump'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePump = async () => {
    if (!editingPump) return;

    setIsSubmitting(true);
    try {
      await db.infusionPumps.delete(editingPump.id);
      try {
        const pumpRef = doc(firestore, 'infusionPumps', editingPump.id);
        await deleteDoc(pumpRef);
      } catch (cloudErr) {
        console.warn('Firestore delete offline sync:', cloudErr);
      }
      try {
        const pumpRefLegacy = doc(firestore, 'infusion_pumps', editingPump.id);
        await deleteDoc(pumpRefLegacy);
      } catch {
        // ignore legacy collection errors
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to remove infusion pump:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل حذف المضخة' : 'Failed to remove pump'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#091122] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{editingPump ? (lang === 'ar' ? `تعديل مضخة الحقن - سرير ${bedNumber}` : `Edit Infusion Pump - Bed ${bedNumber}`) : (lang === 'ar' ? `إضافة مضخة / محلول وريدي جديد` : `Add New Infusion Pump Line`)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                  {patient?.fullNameAr || patient?.fullNameEn || `Bed ${bedNumber}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'تسجيل أدوية الدعم القلبي والمهدئات والمحاليل الوريدية المستمرة' : 'Record vasoactive infusions, sedatives, & smart pump channels'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick drug templates */}
        {!editingPump && (
          <div className="p-3 bg-[#060b17] border-b border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'ar' ? 'أدوية ومحاليل العناية المركزة الشائعة (قوالب سريعة):' : 'Common ICU Infusions (Quick Select):'}</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {availableDrugs.map((tpl) => (
                <button
                  key={tpl.id || tpl.nameEn}
                  type="button"
                  onClick={() => applyDrugTemplate(tpl)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-all cursor-pointer ${
                    drugNameEn === tpl.nameEn
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {lang === 'ar' ? tpl.nameAr : tpl.nameEn.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Drug Name */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              {lang === 'ar' ? 'اسم الدواء أو المحلول (Medication Name):' : 'Medication Name (English):'}
            </label>
            <input
              type="text"
              value={drugNameEn}
              onChange={(e) => setDrugNameEn(e.target.value)}
              placeholder="e.g. Noradrenaline, Propofol, Dopamine..."
              required
              className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              {lang === 'ar' ? 'التركيز والمحلول الحامل (Carrier & Dilution):' : 'Dilution & Carrier Fluid:'}
            </label>
            <input
              type="text"
              value={solutionCarrier}
              onChange={(e) => setSolutionCarrier(e.target.value)}
              placeholder="e.g. 4 mg in 50 mL D5W (80 mcg/mL)"
              className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-300 font-mono text-xs focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Dosing & Rates */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {lang === 'ar' ? 'معدل الجرعة (Dose Rate):' : 'Dosing Rate:'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={currentRate}
                onChange={(e) => setCurrentRate(toEnglishDigits(e.target.value))}
                placeholder="0.0"
                required
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {lang === 'ar' ? 'وحدة الجرعة (Unit):' : 'Dosing Unit:'}
              </label>
              <select
                value={rateUnit}
                onChange={(e) => setRateUnit(e.target.value as any)}
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
              >
                <option value="mcg/kg/min">mcg/kg/min</option>
                <option value="mcg/h">mcg/h</option>
                <option value="mg/h">mg/h</option>
                <option value="Units/hr">Units/hr</option>
                <option value="ml/h">ml/h</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {lang === 'ar' ? 'التدفق المكتلي (Flow mL/h):' : 'Flow Rate (mL/h):'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={flowRateMlPerHour}
                onChange={(e) => setFlowRateMlPerHour(toEnglishDigits(e.target.value))}
                placeholder="0.0"
                required
                className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Volume */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              {lang === 'ar' ? 'الحجم الكلي VTBI (mL):' : 'Total Volume VTBI (mL):'}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={totalVolumeMl}
              onChange={(e) => setTotalVolumeMl(toEnglishDigits(e.target.value))}
              placeholder="50"
              className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Clinical Target */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              {lang === 'ar' ? 'الهدف السريري للمعايرة (Titration Target):' : 'Titration Target / Clinical Goal:'}
            </label>
            <input
              type="text"
              value={clinicalTargetDescription}
              onChange={(e) => setClinicalTargetDescription(e.target.value)}
              placeholder="e.g. Target MAP > 65 mmHg, Titrate up by 0.05 every 5 mins"
              className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-emerald-300 text-xs focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
            {editingPump ? (
              <button
                type="button"
                onClick={handleDeletePump}
                disabled={isSubmitting}
                className="px-3 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/80 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>{lang === 'ar' ? 'حذف المضخة' : 'Remove Line'}</span>
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
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 text-slate-950" />
                <span>{editingPump ? (lang === 'ar' ? 'حفظ تعديلات المضخة' : 'Update Pump Line') : (lang === 'ar' ? 'إضافة المضخة للقائمة' : 'Add Pump Line')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
