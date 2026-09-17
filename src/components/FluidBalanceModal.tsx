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
  const [shiftType, setShiftType] = useState<'DAY' | 'NIGHT'>(() => {
    const hour = new Date().getHours();
    return (hour >= 7 && hour < 19) ? 'DAY' : 'NIGHT';
  });
  const [previousDayRecord, setPreviousDayRecord] = useState<FluidBalance24H | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMoreHistory, setShowMoreHistory] = useState(false);

  // Blood Products & Plasma Specific States
  const [bloodPrbcUnits, setBloodPrbcUnits] = useState<number>(0);
  const [bloodPrbcMl, setBloodPrbcMl] = useState<string>('');
  const [bloodFfpUnits, setBloodFfpUnits] = useState<number>(0);
  const [bloodFfpMl, setBloodFfpMl] = useState<string>('');
  const [bloodPltUnits, setBloodPltUnits] = useState<number>(0);
  const [bloodPltMl, setBloodPltMl] = useState<string>('');
  const [bloodCryoMl, setBloodCryoMl] = useState<string>('');
  const [isBloodExpanded, setIsBloodExpanded] = useState<boolean>(false);

  // Load / initialize record values
  useEffect(() => {
    const initialMap: Record<string, string> = {};
    activeCategories.forEach(cat => {
      initialMap[cat.id] = '';
    });

    if (initialFluidBalance) {
      if (initialFluidBalance.periodEndTimestamp) {
        setRecordDate(initialFluidBalance.periodEndTimestamp.split('T')[0]);
      }
      if (initialFluidBalance.shiftType) {
        setShiftType(initialFluidBalance.shiftType);
      } else {
        const hour = new Date().getHours();
        setShiftType((hour >= 7 && hour < 19) ? 'DAY' : 'NIGHT');
      }

      if (initialFluidBalance.intakeBreakdown) {
        if (initialFluidBalance.intakeBreakdown.ivMaintenanceFluidMl) {
          initialMap['ivMaintenance'] = String(initialFluidBalance.intakeBreakdown.ivMaintenanceFluidMl);
        }
        if (initialFluidBalance.intakeBreakdown.ivMedicationInfusionsMl) {
          initialMap['ivMedications'] = String(initialFluidBalance.intakeBreakdown.ivMedicationInfusionsMl);
        }
        if (initialFluidBalance.intakeBreakdown.enteralFeedingMl) {
          initialMap['enteralFeed'] = String(initialFluidBalance.intakeBreakdown.enteralFeedingMl);
        }
        if (initialFluidBalance.intakeBreakdown.bloodProductsMl) {
          initialMap['bloodProducts'] = String(initialFluidBalance.intakeBreakdown.bloodProductsMl);
        }
        if (initialFluidBalance.intakeBreakdown.oralFluidsMl) {
          initialMap['oralFluids'] = String(initialFluidBalance.intakeBreakdown.oralFluidsMl);
        }
      }

      if (initialFluidBalance.outputBreakdown) {
        if (initialFluidBalance.outputBreakdown.urineOutputMl) {
          initialMap['urineOutput'] = String(initialFluidBalance.outputBreakdown.urineOutputMl);
        }
        if (initialFluidBalance.outputBreakdown.nasogastricDrainageMl) {
          initialMap['ngDrainage'] = String(initialFluidBalance.outputBreakdown.nasogastricDrainageMl);
        }
        if (initialFluidBalance.outputBreakdown.chestTubeDrainageMl) {
          initialMap['chestTube'] = String(initialFluidBalance.outputBreakdown.chestTubeDrainageMl);
        }
        if (initialFluidBalance.outputBreakdown.surgicalDrainageMl) {
          initialMap['surgicalDrain'] = String(initialFluidBalance.outputBreakdown.surgicalDrainageMl);
        }
        if (initialFluidBalance.outputBreakdown.insensibleLossMl) {
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
      setBloodPrbcMl(prbcVol > 0 ? String(prbcVol) : '');
      setBloodFfpUnits(ffpU);
      setBloodFfpMl(ffpVol > 0 ? String(ffpVol) : '');
      setBloodPltUnits(pltU);
      setBloodPltMl(pltVol > 0 ? String(pltVol) : '');
      setBloodCryoMl(cryoVol > 0 ? String(cryoVol) : '');
      if (totalBlood > 0) initialMap['bloodProducts'] = String(totalBlood);
    } else {
      setRecordDate(new Date().toISOString().split('T')[0]);
      const hour = new Date().getHours();
      setShiftType((hour >= 7 && hour < 19) ? 'DAY' : 'NIGHT');
      setBloodPrbcUnits(0);
      setBloodPrbcMl('');
      setBloodFfpUnits(0);
      setBloodFfpMl('');
      setBloodPltUnits(0);
      setBloodPltMl('');
      setBloodCryoMl('');
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

  const getValue = (id: string): string => {
    const raw = values[id];
    if (!raw || raw === '0') return '';
    return raw;
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
    setBloodPrbcMl(nextMl > 0 ? String(nextMl) : '');
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
    setBloodFfpMl(nextMl > 0 ? String(nextMl) : '');
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
    setBloodPltMl(nextMl > 0 ? String(nextMl) : '');
    syncBloodTotal(
      parseEnglishFloat(bloodPrbcMl) || 0,
      parseEnglishFloat(bloodFfpMl) || 0,
      nextMl,
      parseEnglishFloat(bloodCryoMl) || 0
    );
  };

  // Live Calculations
  const totalIntake = intakeCategories.reduce((sum, cat) => {
    const val = parseEnglishFloat(getValue(cat.id)) || 0;
    return sum + val;
  }, 0);

  const totalOutput = outputCategories.reduce((sum, cat) => {
    const val = parseEnglishFloat(getValue(cat.id)) || 0;
    return sum + val;
  }, 0);

  const numUrine = parseEnglishFloat(getValue('urineOutput')) || 0;
  const netBalance = totalIntake - totalOutput;
  const hourlyUop = Math.round(numUrine / 12);
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
      const bldTotal = prbcM + ffpM + pltM + cryoM > 0 ? (prbcM + ffpM + pltM + cryoM) : (parseEnglishFloat(getValue('bloodProducts')) || 0);

      const balanceRecord: FluidBalance24H = {
        id: initialFluidBalance?.id || `fluid_${patientId}_${recordDate}_${shiftType}`,
        bedId: bedNumber,
        patientId: patientId,
        periodStartTimestamp: new Date(selectedDateTime.getTime() - 12 * 3600 * 1000).toISOString(),
        periodEndTimestamp: selectedDateTime.toISOString(),
        shiftType: shiftType,
        shiftNameAr: shiftType === 'DAY' ? 'المناوبة الصباحية (07:00-19:00)' : 'المناوبة الليلية (19:00-07:00)',
        intakeBreakdown: {
          ivMaintenanceFluidMl: parseEnglishFloat(getValue('ivMaintenance')) || 0,
          ivMedicationInfusionsMl: parseEnglishFloat(getValue('ivMedications')) || 0,
          enteralFeedingMl: parseEnglishFloat(getValue('enteralFeed')) || 0,
          bloodProductsMl: bldTotal,
          oralFluidsMl: parseEnglishFloat(getValue('oralFluids')) || 0,
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
          nasogastricDrainageMl: parseEnglishFloat(getValue('ngDrainage')) || 0,
          chestTubeDrainageMl: parseEnglishFloat(getValue('chestTube')) || 0,
          surgicalDrainageMl: parseEnglishFloat(getValue('surgicalDrain')) || 0,
          insensibleLossMl: parseEnglishFloat(getValue('insensibleLoss')) || 0,
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
                <span>{lang === 'ar' ? `ميزان السوائل والبول 12 ساعة - سرير ${bedNumber}` : `12h Fluid Balance Tracker - Bed ${bedNumber}`}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-mono">
                  {patient?.fullNameAr || patient?.fullNameEn || `Bed ${bedNumber}`}
                </span>
              </h2>
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
        <div className="p-3.5 bg-[#060b17] border-b border-slate-800 grid grid-cols-2 gap-2.5 text-center font-mono">
          <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-800/60">
            <div className="text-[10px] text-cyan-400 font-bold uppercase">{lang === 'ar' ? 'الوارد الكلي (IN)' : 'Total Intake (IN)'}</div>
            <div className="text-base sm:text-lg font-black text-cyan-300 mt-0.5">{totalIntake} <span className="text-[10px] font-normal text-slate-400">mL</span></div>
          </div>

          <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-800/60">
            <div className="text-[10px] text-amber-400 font-bold uppercase">{lang === 'ar' ? 'الصادر الكلي (OUT)' : 'Total Output (OUT)'}</div>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5">{totalOutput} <span className="text-[10px] font-normal text-slate-400">mL</span></div>
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

          {/* Date & 12H Shift Selector Row */}
          <div className="p-3.5 rounded-xl bg-[#070d1d] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-400" />
                <div className="text-xs font-bold text-white">
                  {lang === 'ar' ? 'تاريخ الميزان والنوبتجية (12 ساعة):' : 'Fluid Balance Date & Shift (12H):'}
                </div>
              </div>
              <input
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className="bg-[#060b17] border border-slate-700 rounded-xl px-3 py-1.5 text-teal-300 font-mono text-xs focus:border-teal-400 focus:outline-none"
              />
            </div>

            {/* Shift Toggle Buttons (DAY vs NIGHT) */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShiftType('DAY')}
                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                  shiftType === 'DAY'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500 shadow-md shadow-amber-500/10'
                    : 'bg-[#060b17] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>{lang === 'ar' ? 'مناوبة صباحية (07:00 - 19:00)' : 'DAY Shift (07:00 - 19:00)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType('NIGHT')}
                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center justify-center gap-1.5 ${
                  shiftType === 'NIGHT'
                    ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500 shadow-md shadow-indigo-500/10'
                    : 'bg-[#060b17] text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                <span>{lang === 'ar' ? 'مناوبة ليلية (19:00 - 07:00)' : 'NIGHT Shift (19:00 - 07:00)'}</span>
              </button>
            </div>
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
                    value={getValue(cat.id)}
                    onChange={(e) => updateValue(cat.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder=""
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
                    {getValue('bloodProducts') || '0'} mL
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
                        onFocus={(e) => e.target.select()}
                        placeholder=""
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
                    value={getValue(cat.id)}
                    onChange={(e) => updateValue(cat.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder=""
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
