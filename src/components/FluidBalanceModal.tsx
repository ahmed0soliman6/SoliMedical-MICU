import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  X, 
  Check, 
  AlertCircle, 
  Droplets, 
  Activity, 
  Trash2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { BedNumber, PatientDossier, FluidBalance24H } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase.ts';
import { COLLECTIONS } from '../types/contracts.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { DEFAULT_FLUID_CATEGORIES, FluidCategoryPreset } from '../types/settings.ts';
import { toEnglishDigits, parseEnglishFloat } from '../services/numberUtils.ts';

interface FluidBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patient?: PatientDossier | null;
  initialFluidBalance?: FluidBalance24H | null;
  onSaved: () => void;
}

export const FluidBalanceModal: React.FC<FluidBalanceModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patient,
  initialFluidBalance,
  onSaved,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();

  const activeCategories = settings.fluidCategories && settings.fluidCategories.length > 0
    ? settings.fluidCategories
    : DEFAULT_FLUID_CATEGORIES;

  const intakeCategories = activeCategories.filter(c => c.type === 'intake');
  const outputCategories = activeCategories.filter(c => c.type === 'output');

  const [values, setValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const initialMap: Record<string, string> = {};
    activeCategories.forEach(cat => {
      initialMap[cat.id] = String(cat.defaultMl ?? 0);
    });

    if (initialFluidBalance) {
      if (initialFluidBalance.intakeBreakdown) {
        if (initialFluidBalance.intakeBreakdown.ivMaintenanceFluidMl !== undefined) {
          initialMap['ivMaintenance'] = String(initialFluidBalance.intakeBreakdown.ivMaintenanceFluidMl);
        }
        if (initialFluidBalance.intakeBreakdown.ivMedicationInfusionsMl !== undefined) {
          initialMap['ivMedications'] = String(initialFluidBalance.intakeBreakdown.ivMedicationInfusionsMl);
        }
        if (initialFluidBalance.intakeBreakdown.enteralFeedingMl !== undefined) {
          initialMap['enteralFeed'] = String(initialFluidBalance.intakeBreakdown.enteralFeedingMl);
        }
        if (initialFluidBalance.intakeBreakdown.bloodProductsMl !== undefined) {
          initialMap['bloodProducts'] = String(initialFluidBalance.intakeBreakdown.bloodProductsMl);
        }
        if (initialFluidBalance.intakeBreakdown.oralFluidsMl !== undefined) {
          initialMap['oralFluids'] = String(initialFluidBalance.intakeBreakdown.oralFluidsMl);
        }
      }

      if (initialFluidBalance.outputBreakdown) {
        if (initialFluidBalance.outputBreakdown.urineOutputMl !== undefined) {
          initialMap['urineOutput'] = String(initialFluidBalance.outputBreakdown.urineOutputMl);
        }
        if (initialFluidBalance.outputBreakdown.nasogastricDrainageMl !== undefined) {
          initialMap['ngDrainage'] = String(initialFluidBalance.outputBreakdown.nasogastricDrainageMl);
        }
        if (initialFluidBalance.outputBreakdown.chestTubeDrainageMl !== undefined) {
          initialMap['chestTube'] = String(initialFluidBalance.outputBreakdown.chestTubeDrainageMl);
        }
        if (initialFluidBalance.outputBreakdown.surgicalDrainageMl !== undefined) {
          initialMap['surgicalDrain'] = String(initialFluidBalance.outputBreakdown.surgicalDrainageMl);
        }
        if (initialFluidBalance.outputBreakdown.insensibleLossMl !== undefined) {
          initialMap['insensibleLoss'] = String(initialFluidBalance.outputBreakdown.insensibleLossMl);
        }
      }
    }

    setValues(initialMap);
  }, [initialFluidBalance, isOpen, activeCategories]);

  if (!isOpen) return null;

  const getValue = (id: string, defaultVal?: number): string => {
    return values[id] !== undefined ? values[id] : String(defaultVal ?? 0);
  };

  const updateValue = (id: string, val: string) => {
    setValues(prev => ({
      ...prev,
      [id]: toEnglishDigits(val)
    }));
  };

  // Live Calculations
  const totalIntake = intakeCategories.reduce((sum, cat) => {
    const val = parseEnglishFloat(getValue(cat.id, cat.defaultMl)) || 0;
    return sum + val;
  }, 0);

  const totalOutput = outputCategories.reduce((sum, cat) => {
    const val = parseEnglishFloat(getValue(cat.id, cat.defaultMl)) || 0;
    return sum + val;
  }, 0);

  const numUrine = parseEnglishFloat(getValue('urineOutput', 1200)) || 0;
  const netBalance = totalIntake - totalOutput;
  const hourlyUop = Math.round(numUrine / 24);
  const ibw = patient?.idealBodyWeightKg || (patient?.gender === 'MALE' ? 70 : 60) || 70;
  const uopMlKgHr = ibw > 0 ? (hourlyUop / ibw).toFixed(2) : null;
  const isOliguric = uopMlKgHr !== null && Number(uopMlKgHr) < 0.5;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const patientId = patient?.id || 'unknown_patient';

    try {
      const now = new Date();
      const balanceRecord: FluidBalance24H = {
        id: initialFluidBalance?.id || `fluid_${patientId}_${now.toISOString().split('T')[0]}`,
        bedId: bedNumber,
        patientId: patientId,
        periodStartTimestamp: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
        periodEndTimestamp: now.toISOString(),
        intakeBreakdown: {
          ivMaintenanceFluidMl: parseEnglishFloat(getValue('ivMaintenance', 1500)) || 0,
          ivMedicationInfusionsMl: parseEnglishFloat(getValue('ivMedications', 350)) || 0,
          enteralFeedingMl: parseEnglishFloat(getValue('enteralFeed', 0)) || 0,
          bloodProductsMl: parseEnglishFloat(getValue('bloodProducts', 0)) || 0,
          oralFluidsMl: parseEnglishFloat(getValue('oralFluids', 0)) || 0,
          totalIntakeMl: totalIntake,
        },
        outputBreakdown: {
          urineOutputMl: numUrine,
          hourlyUrineAverageMlPerHour: hourlyUop,
          nasogastricDrainageMl: parseEnglishFloat(getValue('ngDrainage', 100)) || 0,
          chestTubeDrainageMl: parseEnglishFloat(getValue('chestTube', 0)) || 0,
          surgicalDrainageMl: parseEnglishFloat(getValue('surgicalDrain', 0)) || 0,
          insensibleLossMl: parseEnglishFloat(getValue('insensibleLoss', 500)) || 0,
          totalOutputMl: totalOutput,
        },
        netCumulativeBalanceMl: netBalance,
        recordedByStaffName: currentUser?.nameAr || currentUser?.nameEn || 'تمريض العناية المركزة',
      };

      // Save to Dexie
      await db.fluidBalances.put(balanceRecord);

      // Save to Firebase
      try {
        const fluidRef = doc(firestore, 'fluid_balances', balanceRecord.id);
        await setDoc(fluidRef, {
          ...balanceRecord,
          updatedAt: Date.now(),
        });
      } catch (cloudErr) {
        console.warn('Firestore offline sync will queue fluid balance:', cloudErr);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving fluid balance record:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل حفظ ميزان السوائل' : 'Failed to save fluid balance'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#091122] border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? `ميزان السوائل والبول 24 ساعة - سرير ${bedNumber}` : `24h Fluid Balance Tracker - Bed ${bedNumber}`}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-mono">
                  {patient?.fullNameAr || patient?.fullNameEn || `Bed ${bedNumber}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'حساب الوارد والصادر الإجمالي ومعدل إدرار البول بالساعة' : 'Calculate 24-hour intake vs output, UOP/kg/hr & cumulative net balance'}
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

        {/* Real-time Balance Summary KPI */}
        <div className="p-4 bg-[#060b17] border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
          <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60">
            <div className="text-[10px] text-cyan-400 font-bold uppercase">{lang === 'ar' ? 'الوارد الكلي (Intake)' : 'Total Intake'}</div>
            <div className="text-lg font-black text-cyan-300 mt-0.5">{totalIntake} <span className="text-xs font-normal text-slate-400">mL</span></div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60">
            <div className="text-[10px] text-amber-400 font-bold uppercase">{lang === 'ar' ? 'الصادر الكلي (Output)' : 'Total Output'}</div>
            <div className="text-lg font-black text-amber-300 mt-0.5">{totalOutput} <span className="text-xs font-normal text-slate-400">mL</span></div>
          </div>

          <div className={`p-2.5 rounded-xl border ${netBalance >= 0 ? 'bg-indigo-950/40 border-indigo-800/60' : 'bg-emerald-950/40 border-emerald-800/60'}`}>
            <div className="text-[10px] text-slate-300 font-bold uppercase">{lang === 'ar' ? 'صافي الميزان (Net)' : 'Net Balance'}</div>
            <div className={`text-lg font-black mt-0.5 ${netBalance >= 0 ? 'text-indigo-300' : 'text-emerald-300'}`}>
              {netBalance > 0 ? `+${netBalance}` : netBalance} <span className="text-xs font-normal text-slate-400">mL</span>
            </div>
          </div>

          <div className={`p-2.5 rounded-xl border ${isOliguric ? 'bg-red-950/50 border-red-800/80 animate-pulse' : 'bg-slate-900/60 border-slate-800'}`}>
            <div className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'ar' ? 'إدرار البول (UOP)' : 'UOP / kg / hr'}</div>
            <div className={`text-lg font-black mt-0.5 ${isOliguric ? 'text-red-400' : 'text-emerald-400'}`}>
              {uopMlKgHr ?? '—'} <span className="text-xs font-normal text-slate-400">mL/kg/h</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-5 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: INTAKE (وارد السوائل) */}
          <div className="p-4 rounded-xl bg-[#060d1b] border border-cyan-900/40 space-y-3">
            <div className="flex items-center justify-between border-b border-cyan-900/40 pb-2">
              <div className="text-xs font-bold text-cyan-300 uppercase flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'ar' ? 'تفصيل وارد السوائل (Intake Breakdown)' : 'Fluid Intake Breakdown (mL)'}</span>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                {totalIntake} mL
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {intakeCategories.map((cat) => (
                <div key={cat.id}>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? cat.labelAr : cat.labelEn}
                    <span className="text-[10px] text-slate-500 font-mono ml-1 font-normal">(mL)</span>:
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={getValue(cat.id, cat.defaultMl)}
                    onChange={(e) => updateValue(cat.id, e.target.value)}
                    placeholder={String(cat.defaultMl ?? 0)}
                    className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: OUTPUT (صادر السوائل) */}
          <div className="p-4 rounded-xl bg-[#060d1b] border border-amber-900/40 space-y-3">
            <div className="flex items-center justify-between border-b border-amber-900/40 pb-2">
              <div className="text-xs font-bold text-amber-300 uppercase flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-400" />
                <span>{lang === 'ar' ? 'تفصيل صادر السوائل (Output Breakdown)' : 'Fluid Output Breakdown (mL)'}</span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                {totalOutput} mL
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {outputCategories.map((cat) => (
                <div key={cat.id}>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? cat.labelAr : cat.labelEn}
                    <span className="text-[10px] text-slate-500 font-mono ml-1 font-normal">(mL)</span>:
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={getValue(cat.id, cat.defaultMl)}
                    onChange={(e) => updateValue(cat.id, e.target.value)}
                    placeholder={String(cat.defaultMl ?? 0)}
                    required={cat.id === 'urineOutput'}
                    className={`w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 font-mono text-xs focus:outline-none ${
                      cat.id === 'urineOutput'
                        ? 'text-amber-300 font-bold focus:border-amber-400'
                        : 'text-slate-200 focus:border-amber-400'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-teal-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 text-slate-950" />
              <span>{lang === 'ar' ? 'حفظ ميزان السوائل' : 'Save Fluid Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
