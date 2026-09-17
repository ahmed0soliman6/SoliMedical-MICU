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
  Sparkles,
  Plus,
  Minus,
  History,
  Droplet,
  ChevronDown,
  ChevronUp
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
  allFluidBalances?: FluidBalance24H[];
  onSaved: () => void;
}

export const FluidBalanceModal: React.FC<FluidBalanceModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patient,
  initialFluidBalance,
  allFluidBalances = [],
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
  const [recordDate, setRecordDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [previousDayRecord, setPreviousDayRecord] = useState<FluidBalance24H | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Blood Products & Plasma Specific States
  const [bloodPrbcUnits, setBloodPrbcUnits] = useState<number>(0);
  const [bloodPrbcMl, setBloodPrbcMl] = useState<string>('0');
  const [bloodFfpUnits, setBloodFfpUnits] = useState<number>(0);
  const [bloodFfpMl, setBloodFfpMl] = useState<string>('0');
  const [bloodPltUnits, setBloodPltUnits] = useState<number>(0);
  const [bloodPltMl, setBloodPltMl] = useState<string>('0');
  const [bloodCryoMl, setBloodCryoMl] = useState<string>('0');
  const [isBloodExpanded, setIsBloodExpanded] = useState<boolean>(true);

  // Load / initialize record values
  useEffect(() => {
    const initialMap: Record<string, string> = {};
    activeCategories.forEach(cat => {
      initialMap[cat.id] = String(cat.defaultMl ?? 0);
    });

    if (initialFluidBalance) {
      if (initialFluidBalance.periodEndTimestamp) {
        setRecordDate(initialFluidBalance.periodEndTimestamp.split('T')[0]);
      }
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

      // Initialize blood breakdown
      const transfusions = (initialFluidBalance as any).transfusionProductsGiven;
      const prbcU = transfusions?.prbcUnits ?? 0;
      const ffpU = transfusions?.ffpUnits ?? 0;
      const pltU = transfusions?.plateletsUnits ?? 0;
      const cryoU = transfusions?.cryoUnits ?? 0;

      const bBreakdown = (initialFluidBalance.intakeBreakdown as any);
      const prbcVol = bBreakdown?.prbcMl ?? (prbcU > 0 ? prbcU * 250 : 0);
      const ffpVol = bBreakdown?.ffpPlasmaMl ?? (ffpU > 0 ? ffpU * 200 : 0);
      const pltVol = bBreakdown?.plateletsMl ?? (pltU > 0 ? pltU * 50 : 0);
      const cryoVol = bBreakdown?.cryoMl ?? 0;
      const totalBlood = initialFluidBalance.intakeBreakdown?.bloodProductsMl ?? (prbcVol + ffpVol + pltVol + cryoVol);

      setBloodPrbcUnits(prbcU);
      setBloodPrbcMl(String(prbcVol));
      setBloodFfpUnits(ffpU);
      setBloodFfpMl(String(ffpVol));
      setBloodPltUnits(pltU);
      setBloodPltMl(String(pltVol));
      setBloodCryoMl(String(cryoVol));
      initialMap['bloodProducts'] = String(totalBlood);
    } else {
      setRecordDate(new Date().toISOString().split('T')[0]);
      setBloodPrbcUnits(0);
      setBloodPrbcMl('0');
      setBloodFfpUnits(0);
      setBloodFfpMl('0');
      setBloodPltUnits(0);
      setBloodPltMl('0');
      setBloodCryoMl('0');
    }

    setValues(initialMap);
  }, [initialFluidBalance, isOpen, activeCategories]);

  // Load Previous Day Fluid Balance relative to current recordDate
  useEffect(() => {
    if (!isOpen || !patient?.id) return;

    const findPreviousDayRecord = async () => {
      try {
        let records = allFluidBalances;
        if (!records || records.length === 0) {
          records = await db.fluidBalances
            .where('patientId')
            .equals(patient.id)
            .toArray();
        }

        const currentTargetTime = new Date(`${recordDate}T23:59:59`).getTime();
        const currentRecordDateStr = recordDate;

        const filtered = records
          .filter(r => {
            const rDateStr = (r.periodEndTimestamp ? r.periodEndTimestamp.split('T')[0] : '') || (r as any).date || '';
            // Must be strictly before the selected record date
            if (rDateStr >= currentRecordDateStr) return false;
            if (initialFluidBalance && r.id === initialFluidBalance.id) return false;
            return true;
          })
          .sort((a, b) => new Date(b.periodEndTimestamp || 0).getTime() - new Date(a.periodEndTimestamp || 0).getTime());

        setPreviousDayRecord(filtered[0] || null);
      } catch (err) {
        console.warn('Could not query previous fluid balance:', err);
      }
    };

    findPreviousDayRecord();
  }, [isOpen, patient?.id, recordDate, initialFluidBalance, allFluidBalances]);

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

  // Sync Blood Component volumes into total blood products intake
  const syncBloodTotal = (
    prbcMlVal: number,
    ffpMlVal: number,
    pltMlVal: number,
    cryoMlVal: number
  ) => {
    const totalBld = prbcMlVal + ffpMlVal + pltMlVal + cryoMlVal;
    updateValue('bloodProducts', String(totalBld));
  };

  const handlePrbcUnitChange = (delta: number) => {
    const nextUnits = Math.max(0, bloodPrbcUnits + delta);
    const nextMl = nextUnits * 250;
    setBloodPrbcUnits(nextUnits);
    setBloodPrbcMl(String(nextMl));
    syncBloodTotal(
      nextMl,
      parseEnglishFloat(bloodFfpMl) || 0,
      parseEnglishFloat(bloodPltMl) || 0,
      parseEnglishFloat(bloodCryoMl) || 0
    );
  };

  const handleFfpUnitChange = (delta: number) => {
    const nextUnits = Math.max(0, bloodFfpUnits + delta);
    const nextMl = nextUnits * 200;
    setBloodFfpUnits(nextUnits);
    setBloodFfpMl(String(nextMl));
    syncBloodTotal(
      parseEnglishFloat(bloodPrbcMl) || 0,
      nextMl,
      parseEnglishFloat(bloodPltMl) || 0,
      parseEnglishFloat(bloodCryoMl) || 0
    );
  };

  const handlePltUnitChange = (delta: number) => {
    const nextUnits = Math.max(0, bloodPltUnits + delta);
    const nextMl = nextUnits * 50;
    setBloodPltUnits(nextUnits);
    setBloodPltMl(String(nextMl));
    syncBloodTotal(
      parseEnglishFloat(bloodPrbcMl) || 0,
      parseEnglishFloat(bloodFfpMl) || 0,
      nextMl,
      parseEnglishFloat(bloodCryoMl) || 0
    );
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
      const selectedDateTime = new Date(`${recordDate}T12:00:00`);
      const prbcM = parseEnglishFloat(bloodPrbcMl) || (bloodPrbcUnits > 0 ? bloodPrbcUnits * 250 : 0);
      const ffpM = parseEnglishFloat(bloodFfpMl) || (bloodFfpUnits > 0 ? bloodFfpUnits * 200 : 0);
      const pltM = parseEnglishFloat(bloodPltMl) || (bloodPltUnits > 0 ? bloodPltUnits * 50 : 0);
      const cryoM = parseEnglishFloat(bloodCryoMl) || 0;
      const bldTotal = prbcM + ffpM + pltM + cryoM > 0 ? (prbcM + ffpM + pltM + cryoM) : (parseEnglishFloat(getValue('bloodProducts', 0)) || 0);

      const balanceRecord: FluidBalance24H = {
        id: initialFluidBalance?.id || `fluid_${patientId}_${recordDate}`,
        bedId: bedNumber,
        patientId: patientId,
        periodStartTimestamp: new Date(selectedDateTime.getTime() - 24 * 3600 * 1000).toISOString(),
        periodEndTimestamp: selectedDateTime.toISOString(),
        intakeBreakdown: {
          ivMaintenanceFluidMl: parseEnglishFloat(getValue('ivMaintenance', 1500)) || 0,
          ivMedicationInfusionsMl: parseEnglishFloat(getValue('ivMedications', 350)) || 0,
          enteralFeedingMl: parseEnglishFloat(getValue('enteralFeed', 0)) || 0,
          bloodProductsMl: bldTotal,
          oralFluidsMl: parseEnglishFloat(getValue('oralFluids', 0)) || 0,
          totalIntakeMl: totalIntake,
          ...({
            prbcMl: prbcM,
            ffpPlasmaMl: ffpM,
            plateletsMl: pltM,
            cryoMl: cryoM,
          } as any)
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
        transfusionProductsGiven: {
          prbcUnits: bloodPrbcUnits || (prbcM > 0 ? Math.ceil(prbcM / 250) : 0),
          ffpUnits: bloodFfpUnits || (ffpM > 0 ? Math.ceil(ffpM / 200) : 0),
          plateletsUnits: bloodPltUnits || (pltM > 0 ? Math.ceil(pltM / 50) : 0),
          cryoUnits: cryoM > 0 ? Math.ceil(cryoM / 15) : 0,
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

  const handleDelete = async () => {
    if (!initialFluidBalance?.id) return;
    setIsSubmitting(true);
    try {
      await db.fluidBalances.delete(initialFluidBalance.id);
      try {
        const fluidRef = doc(firestore, 'fluid_balances', initialFluidBalance.id);
        await deleteDoc(fluidRef);
      } catch (e) {
        console.warn('Firestore delete offline:', e);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل حذف ميزان السوائل' : 'Failed to delete record'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#091122] border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
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
                {lang === 'ar' ? 'تسجيل وحساب الوارد والصادر الإجمالي ومشتقات الدم ومعدل إدرار البول بالساعة' : 'Calculate 24-hour intake, output, blood products & UOP rate'}
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

        {/* Real-time Current Balance Summary KPI */}
        <div className="p-3.5 bg-[#060b17] border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono">
          <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-800/60">
            <div className="text-[10px] text-cyan-400 font-bold uppercase">{lang === 'ar' ? 'الوارد الكلي (IN)' : 'Total Intake (IN)'}</div>
            <div className="text-base sm:text-lg font-black text-cyan-300 mt-0.5">{totalIntake} <span className="text-[10px] font-normal text-slate-400">mL</span></div>
          </div>

          <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-800/60">
            <div className="text-[10px] text-amber-400 font-bold uppercase">{lang === 'ar' ? 'الصادر الكلي (OUT)' : 'Total Output (OUT)'}</div>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5">{totalOutput} <span className="text-[10px] font-normal text-slate-400">mL</span></div>
          </div>

          <div className={`p-2 rounded-xl border ${netBalance >= 0 ? 'bg-indigo-950/40 border-indigo-800/60' : 'bg-emerald-950/40 border-emerald-800/60'}`}>
            <div className="text-[10px] text-slate-300 font-bold uppercase">{lang === 'ar' ? 'صافي الميزان (NET)' : 'Net Balance (NET)'}</div>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${netBalance >= 0 ? 'text-indigo-300' : 'text-emerald-300'}`}>
              {netBalance > 0 ? `+${netBalance}` : netBalance} <span className="text-[10px] font-normal text-slate-400">mL</span>
            </div>
          </div>

          <div className={`p-2 rounded-xl border ${isOliguric ? 'bg-red-950/50 border-red-800/80 animate-pulse' : 'bg-slate-900/60 border-slate-800'}`}>
            <div className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'ar' ? 'إدرار البول (UOP)' : 'UOP Rate'}</div>
            <div className={`text-base sm:text-lg font-black mt-0.5 ${isOliguric ? 'text-red-400' : 'text-emerald-400'}`}>
              {uopMlKgHr ?? '—'} <span className="text-[10px] font-normal text-slate-400">mL/kg/h</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 🌟 Top Feature: PREVIOUS DAY'S BALANCE BANNER (ميزان اليوم السابق) */}
          <div className="p-3 rounded-xl bg-[#081226] border border-blue-900/50 space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-blue-900/40 pb-1.5 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                <History className="w-4 h-4 text-blue-400" />
                <span>{lang === 'ar' ? 'ميزان اليوم السابق (Previous Day Balance):' : 'Previous Day Balance Reference:'}</span>
                {previousDayRecord && (
                  <span className="text-[11px] font-mono font-normal text-blue-200 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                    {previousDayRecord.periodEndTimestamp ? previousDayRecord.periodEndTimestamp.split('T')[0] : (previousDayRecord as any).date}
                  </span>
                )}
              </div>

              {!previousDayRecord && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {lang === 'ar' ? 'لا يوجد ميزان مسجل ليوم سابق' : 'No prior balance recorded'}
                </span>
              )}
            </div>

            {previousDayRecord ? (() => {
              const prevIn = previousDayRecord.intakeBreakdown?.totalIntakeMl ?? 0;
              const prevOut = previousDayRecord.outputBreakdown?.totalOutputMl ?? 0;
              const prevNet = previousDayRecord.netCumulativeBalanceMl ?? (prevIn - prevOut);
              const prevUrine = previousDayRecord.outputBreakdown?.urineOutputMl ?? 0;
              const prevUopRate = previousDayRecord.outputBreakdown?.hourlyUrineAverageMlPerHour ?? Math.round(prevUrine / 24);
              const prevPrbc = (previousDayRecord as any).transfusionProductsGiven?.prbcUnits ?? 0;
              const prevFfp = (previousDayRecord as any).transfusionProductsGiven?.ffpUnits ?? 0;
              const prevPlt = (previousDayRecord as any).transfusionProductsGiven?.plateletsUnits ?? 0;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-[#050b18] p-2 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-cyan-400 font-semibold">{lang === 'ar' ? 'الوارد السابق (IN)' : 'Prev Intake (IN)'}</div>
                    <div className="text-sm font-bold text-cyan-200 mt-0.5">{prevIn} <span className="text-[9px] text-slate-500">mL</span></div>
                  </div>

                  <div className="bg-[#050b18] p-2 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-amber-400 font-semibold">{lang === 'ar' ? 'الصادر السابق (OUT)' : 'Prev Output (OUT)'}</div>
                    <div className="text-sm font-bold text-amber-200 mt-0.5">{prevOut} <span className="text-[9px] text-slate-500">mL</span></div>
                  </div>

                  <div className="bg-[#050b18] p-2 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-indigo-400 font-semibold">{lang === 'ar' ? 'صافي السابق (NET)' : 'Prev Net (NET)'}</div>
                    <div className={`text-sm font-bold mt-0.5 ${prevNet >= 0 ? 'text-indigo-300' : 'text-emerald-300'}`}>
                      {prevNet > 0 ? `+${prevNet}` : prevNet} <span className="text-[9px] text-slate-500">mL</span>
                    </div>
                  </div>

                  <div className="bg-[#050b18] p-2 rounded-lg border border-slate-800">
                    <div className="text-[9px] text-slate-400 font-semibold">{lang === 'ar' ? 'البول ونقل الدم' : 'Urine & MTP'}</div>
                    <div className="text-xs text-slate-200 mt-0.5 truncate">
                      {prevUrine} mL ({prevUopRate} mL/h)
                    </div>
                    {(prevPrbc > 0 || prevFfp > 0 || prevPlt > 0) && (
                      <div className="text-[9px] text-red-300 mt-0.5 font-bold">
                        PRBC: {prevPrbc} • FFP: {prevFfp} • PLT: {prevPlt}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="text-[11px] text-slate-400 py-1 italic">
                {lang === 'ar'
                  ? 'هذا هو الميزان الأول أو لم يتم العثور على سجل سابق قبل هذا التاريخ المحدد.'
                  : 'This is the initial record or no previous fluid balance was logged before this date.'}
              </div>
            )}
          </div>

          {/* Date Selector Row for multi-day logging */}
          <div className="p-3.5 rounded-xl bg-[#070d1d] border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-400" />
              <div>
                <div className="text-xs font-bold text-white">
                  {lang === 'ar' ? 'تاريخ يوم الميزان (ICU Day Date):' : 'Fluid Balance Record Date:'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {lang === 'ar' ? 'تحديد اليوم لتسجيل أو تعديل ميزان السوائل' : 'Select date to record or edit fluid balance for subsequent days'}
                </div>
              </div>
            </div>
            <input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="bg-[#060b17] border border-slate-700 rounded-xl px-3 py-1.5 text-teal-300 font-mono text-xs focus:border-teal-400 focus:outline-none"
            />
          </div>

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

            {/* Standard Non-Blood Categories */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {intakeCategories.filter(cat => cat.id !== 'bloodProducts').map((cat) => (
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

            {/* 🩸 BLOOD PRODUCTS & PLASMA SELECTION SECTION (مشتقات الدم والبلازما) */}
            <div className="mt-3 p-3.5 rounded-xl bg-[#130912] border border-red-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold text-red-300">
                    {lang === 'ar' ? 'مشتقات ونقل الدم والبلازما (Blood & Plasma Transfusion)' : 'Blood Products & Plasma Transfusion'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-red-300 bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
                    {getValue('bloodProducts', 0)} mL
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBloodExpanded(!isBloodExpanded)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                  >
                    {isBloodExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {isBloodExpanded && (
                <div className="space-y-3 pt-1 border-t border-red-900/40">
                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <span className="text-slate-400">{lang === 'ar' ? 'إضافة سريعة:' : 'Quick Add:'}</span>
                    <button
                      type="button"
                      onClick={() => handlePrbcUnitChange(1)}
                      className="px-2 py-1 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold active:scale-95 cursor-pointer"
                    >
                      +1 {lang === 'ar' ? 'كيس دم PRBC (250mL)' : 'PRBC Bag (250mL)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFfpUnitChange(1)}
                      className="px-2 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800 font-bold active:scale-95 cursor-pointer"
                    >
                      +1 {lang === 'ar' ? 'كيس بلازما FFP (200mL)' : 'FFP Plasma (200mL)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePltUnitChange(1)}
                      className="px-2 py-1 rounded-lg bg-yellow-950/80 hover:bg-yellow-900 text-yellow-300 border border-yellow-800 font-bold active:scale-95 cursor-pointer"
                    >
                      +1 {lang === 'ar' ? 'كيس صفائح PLT (50mL)' : 'Platelets PLT (50mL)'}
                    </button>
                  </div>

                  {/* 4 Distinct Products Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* 1. PRBC (دم مركز) */}
                    <div className="p-2.5 rounded-xl bg-[#09050d] border border-red-950 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-red-300 text-[11px]">{lang === 'ar' ? 'كريات دم مركزة (PRBC)' : 'Packed RBCs (PRBC)'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{bloodPrbcMl} mL</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePrbcUnitChange(-1)}
                          disabled={bloodPrbcUnits <= 0}
                          className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-white text-xs">{bloodPrbcUnits} <span className="text-[9px] text-slate-500">{lang === 'ar' ? 'كيس' : 'U'}</span></span>
                        <button
                          type="button"
                          onClick={() => handlePrbcUnitChange(1)}
                          className="w-6 h-6 rounded bg-red-900 text-red-200 hover:bg-red-800 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* 2. FFP Plasma (بلازما مجمدة) */}
                    <div className="p-2.5 rounded-xl bg-[#09050d] border border-amber-950 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-amber-300 text-[11px]">{lang === 'ar' ? 'بلازما مجمدة طازجة (FFP)' : 'Fresh Frozen Plasma (FFP)'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{bloodFfpMl} mL</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleFfpUnitChange(-1)}
                          disabled={bloodFfpUnits <= 0}
                          className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-white text-xs">{bloodFfpUnits} <span className="text-[9px] text-slate-500">{lang === 'ar' ? 'كيس' : 'U'}</span></span>
                        <button
                          type="button"
                          onClick={() => handleFfpUnitChange(1)}
                          className="w-6 h-6 rounded bg-amber-900 text-amber-200 hover:bg-amber-800 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* 3. Platelets (صفائح دموية) */}
                    <div className="p-2.5 rounded-xl bg-[#09050d] border border-yellow-950 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-yellow-300 text-[11px]">{lang === 'ar' ? 'صفائح دموية (Platelets)' : 'Platelets (PLT)'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{bloodPltMl} mL</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePltUnitChange(-1)}
                          disabled={bloodPltUnits <= 0}
                          className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-white text-xs">{bloodPltUnits} <span className="text-[9px] text-slate-500">{lang === 'ar' ? 'كيس' : 'U'}</span></span>
                        <button
                          type="button"
                          onClick={() => handlePltUnitChange(1)}
                          className="w-6 h-6 rounded bg-yellow-900 text-yellow-200 hover:bg-yellow-800 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* 4. Cryoprecipitate / Other (راسب قري / مشتقات أخرى) */}
                    <div className="p-2.5 rounded-xl bg-[#09050d] border border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-300 text-[11px]">{lang === 'ar' ? 'راسب قري / ألبومين / أخرى' : 'Cryo / Albumin / Other'}</div>
                        <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'الحجم بالـ mL' : 'Volume in mL'}</div>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bloodCryoMl}
                        onChange={(e) => {
                          const val = toEnglishDigits(e.target.value);
                          setBloodCryoMl(val);
                          syncBloodTotal(
                            parseEnglishFloat(bloodPrbcMl) || 0,
                            parseEnglishFloat(bloodFfpMl) || 0,
                            parseEnglishFloat(bloodPltMl) || 0,
                            parseEnglishFloat(val) || 0
                          );
                        }}
                        placeholder="0"
                        className="w-20 bg-[#060b17] border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs text-right focus:border-red-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
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
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
            {initialFluidBalance ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/80 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={lang === 'ar' ? 'حذف سجل ميزان هذا اليوم' : 'Delete Fluid Record'}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>{lang === 'ar' ? 'حذف الميزان' : 'Delete'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5">
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
          </div>
        </form>
      </div>
    </div>
  );
};
