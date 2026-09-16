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

  // Intake states
  const [ivMaintenance, setIvMaintenance] = useState('1500');
  const [ivMedications, setIvMedications] = useState('350');
  const [enteralFeed, setEnteralFeed] = useState('0');
  const [bloodProducts, setBloodProducts] = useState('0');
  const [oralFluids, setOralFluids] = useState('0');

  // Output states
  const [urineOutput, setUrineOutput] = useState('1200');
  const [ngDrainage, setNgDrainage] = useState('100');
  const [chestTube, setChestTube] = useState('0');
  const [surgicalDrain, setSurgicalDrain] = useState('0');
  const [insensibleLoss, setInsensibleLoss] = useState('500');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialFluidBalance) {
      setIvMaintenance(String(initialFluidBalance.intakeBreakdown?.ivMaintenanceFluidMl || 0));
      setIvMedications(String(initialFluidBalance.intakeBreakdown?.ivMedicationInfusionsMl || 0));
      setEnteralFeed(String(initialFluidBalance.intakeBreakdown?.enteralFeedingMl || 0));
      setBloodProducts(String(initialFluidBalance.intakeBreakdown?.bloodProductsMl || 0));
      setOralFluids(String(initialFluidBalance.intakeBreakdown?.oralFluidsMl || 0));

      setUrineOutput(String(initialFluidBalance.outputBreakdown?.urineOutputMl || 0));
      setNgDrainage(String(initialFluidBalance.outputBreakdown?.nasogastricDrainageMl || 0));
      setChestTube(String(initialFluidBalance.outputBreakdown?.chestTubeDrainageMl || 0));
      setSurgicalDrain(String(initialFluidBalance.outputBreakdown?.surgicalDrainageMl || 0));
      setInsensibleLoss(String(initialFluidBalance.outputBreakdown?.insensibleLossMl || 0));
    }
  }, [initialFluidBalance, isOpen]);

  if (!isOpen) return null;

  // Live Calculations
  const numIvMaint = parseEnglishFloat(ivMaintenance) || 0;
  const numIvMeds = parseEnglishFloat(ivMedications) || 0;
  const numEnteral = parseEnglishFloat(enteralFeed) || 0;
  const numBlood = parseEnglishFloat(bloodProducts) || 0;
  const numOral = parseEnglishFloat(oralFluids) || 0;
  const totalIntake = numIvMaint + numIvMeds + numEnteral + numBlood + numOral;

  const numUrine = parseEnglishFloat(urineOutput) || 0;
  const numNg = parseEnglishFloat(ngDrainage) || 0;
  const numChest = parseEnglishFloat(chestTube) || 0;
  const numSurg = parseEnglishFloat(surgicalDrain) || 0;
  const numInsensible = parseEnglishFloat(insensibleLoss) || 0;
  const totalOutput = numUrine + numNg + numChest + numSurg + numInsensible;

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
          ivMaintenanceFluidMl: numIvMaint,
          ivMedicationInfusionsMl: numIvMeds,
          enteralFeedingMl: numEnteral,
          bloodProductsMl: numBlood,
          oralFluidsMl: numOral,
          totalIntakeMl: totalIntake,
        },
        outputBreakdown: {
          urineOutputMl: numUrine,
          hourlyUrineAverageMlPerHour: hourlyUop,
          nasogastricDrainageMl: numNg,
          chestTubeDrainageMl: numChest,
          surgicalDrainageMl: numSurg,
          insensibleLossMl: numInsensible,
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
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'محاليل وريدية رئيسية (IV Maint):' : 'IV Maintenance (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ivMaintenance}
                  onChange={(e) => setIvMaintenance(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'أدوية ومضخات حقن (IV Meds):' : 'IV Meds & Boluses (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ivMedications}
                  onChange={(e) => setIvMedications(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 font-mono text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'تغذية أنبوبية (NG Feeds):' : 'Enteral / NG Tube (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={enteralFeed}
                  onChange={(e) => setEnteralFeed(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'مشتقات دم (Blood Products):' : 'Blood Transfusions (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={bloodProducts}
                  onChange={(e) => setBloodProducts(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'سوائل فموية (Oral Fluids):' : 'Oral Fluids (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={oralFluids}
                  onChange={(e) => setOralFluids(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:border-cyan-400 focus:outline-none"
                />
              </div>
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
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'كمية البول الإجمالية (Urine):' : 'Urine Output (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={urineOutput}
                  onChange={(e) => setUrineOutput(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  required
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'نزح أنبوب المعدة (NG Suction):' : 'NG Tube Drainage (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ngDrainage}
                  onChange={(e) => setNgDrainage(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'درنقة الصدر (Chest Tube):' : 'Chest Tube Drain (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={chestTube}
                  onChange={(e) => setChestTube(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'درانق جراحية (Surgical Drain):' : 'Surgical Drains (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={surgicalDrain}
                  onChange={(e) => setSurgicalDrain(toEnglishDigits(e.target.value))}
                  placeholder="0"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'فقد غير محسوس (Insensible):' : 'Insensible Loss (mL):'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={insensibleLoss}
                  onChange={(e) => setInsensibleLoss(toEnglishDigits(e.target.value))}
                  placeholder="500"
                  className="w-full bg-[#060b17] border border-slate-700 rounded-xl px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>
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
