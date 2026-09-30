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
  ShieldCheck,
  Flame,
  Gauge,
  PowerOff
} from 'lucide-react';
import { BedNumber, PatientDossier, VentilatorParameters, VentilatorMode } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { doc, deleteDoc } from 'firebase/firestore';
import { firestore, setDoc } from '../services/firebase.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { toEnglishDigits, parseEnglishFloat } from '../services/numberUtils.ts';
import { canDeleteRecord } from '../services/medicalRecordPermissions.ts';

interface VentilatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patient?: PatientDossier | null;
  initialVentilator?: VentilatorParameters | null;
  onSaved: () => void;
}

export type RespiratoryCategory = 'OXYGEN_THERAPY' | 'NON_INVASIVE_NIV' | 'INVASIVE_VENT' | 'ROOM_AIR';

interface RespiratoryDeviceOption {
  id: string;
  category: RespiratoryCategory;
  labelEn: string;
  labelAr: string;
  defaultFlow?: number;
  defaultFio2?: number;
  flowRange?: string;
  descriptionEn?: string;
  descriptionAr?: string;
}

const RESPIRATORY_DEVICES: RespiratoryDeviceOption[] = [
  // 1. Oxygen Therapy Devices
  { 
    id: 'NASAL_CANNULA', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Nasal Cannula (NC)', 
    labelAr: 'قنية أنفية (نيزل كانيولا)', 
    defaultFlow: 3, 
    defaultFio2: 32, 
    flowRange: '1 - 6 L/min',
    descriptionAr: '1-6 لتر/د (FiO₂ تقريبي 24% - 44%)',
    descriptionEn: '1-6 L/min (~24-44% FiO2)'
  },
  { 
    id: 'SIMPLE_MASK', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Simple Face Mask', 
    labelAr: 'قناع أكسجين بسيط (Face Mask)', 
    defaultFlow: 8, 
    defaultFio2: 50, 
    flowRange: '5 - 10 L/min',
    descriptionAr: '5-10 لتر/د (FiO₂ تقريبي 40% - 60%)',
    descriptionEn: '5-10 L/min (~40-60% FiO2)'
  },
  { 
    id: 'RESERVOIR_MASK', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Non-Rebreather Mask (NRBM / Reservoir)', 
    labelAr: 'قناع ريزرفوار ذو كيس حزام (NRBM)', 
    defaultFlow: 15, 
    defaultFio2: 90, 
    flowRange: '10 - 15 L/min',
    descriptionAr: '10-15 لتر/د (FiO₂ عالي 60% - 95%)',
    descriptionEn: '10-15 L/min (~60-95% FiO2)'
  },
  { 
    id: 'VENTURI_MASK', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Venturi Mask (Fixed FiO₂)', 
    labelAr: 'قناع فنتوري (تركيز أكسجين دقيق)', 
    defaultFlow: 8, 
    defaultFio2: 35, 
    flowRange: '4 - 12 L/min',
    descriptionAr: 'توصيل تركيز أكسجين ثابت ومحدد (24% - 50%)',
    descriptionEn: 'Fixed, precise FiO2 delivery (24-50%)'
  },
  { 
    id: 'HIGH_FLOW_NC', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'High-Flow Nasal Cannula (HFNC)', 
    labelAr: 'قنية أنفية عالية التدفق (HFNC)', 
    defaultFlow: 40, 
    defaultFio2: 50, 
    flowRange: '20 - 60 L/min',
    descriptionAr: 'تدفق عالي 20-60 لتر/د مع ترطيب وتدفئة',
    descriptionEn: 'High-flow humidified oxygen 20-60 L/min'
  },
  { 
    id: 'TRACH_MASK', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Tracheostomy Mask / Collar', 
    labelAr: 'قناع الشق الحنجري (Trach Collar)', 
    defaultFlow: 8, 
    defaultFio2: 35, 
    flowRange: '5 - 15 L/min',
    descriptionAr: 'توصيل الأكسجين والرذاذ للشق الحنجري',
    descriptionEn: 'Oxygen and mist collar for tracheostomy'
  },
  { 
    id: 'ROOM_AIR', 
    category: 'ROOM_AIR', 
    labelEn: 'Room Air (Spontaneous Breathing)', 
    labelAr: 'هواء الغرفة (تنفس طبيعي بدون أكسجين)', 
    defaultFlow: 0, 
    defaultFio2: 21, 
    flowRange: '0 L/min',
    descriptionAr: 'المريض يتنفس تلقائياً هواء الغرفة (21% FiO₂)',
    descriptionEn: 'Spontaneous breathing on ambient room air'
  },

  // 2. Non-Invasive Ventilation (NIV)
  { 
    id: 'BIPAP', 
    category: 'NON_INVASIVE_NIV', 
    labelEn: 'BiPAP (IPAP / EPAP)', 
    labelAr: 'BiPAP تهوية ثنائية الضغط غير جائرة', 
    defaultFlow: 0, 
    defaultFio2: 40,
    descriptionAr: 'دعم تنفس غير جائر بقناع وجه',
    descriptionEn: 'Non-invasive positive pressure mask'
  },
  { 
    id: 'PSV_CPAP', 
    category: 'NON_INVASIVE_NIV', 
    labelEn: 'CPAP / PS (Spontaneous)', 
    labelAr: 'CPAP / PS ضغط مستمر مع دعم تنفس', 
    defaultFlow: 0, 
    defaultFio2: 40,
    descriptionAr: 'ضغط مجرى هوائي إيجابي مستمر',
    descriptionEn: 'Continuous positive airway pressure'
  },

  // 3. Invasive Mechanical Ventilation
  { 
    id: 'PRVC', 
    category: 'INVASIVE_VENT', 
    labelEn: 'PRVC / AC (Pressure Regulated Vol)', 
    labelAr: 'PRVC / AC الحجم المنظم بالضغط', 
    defaultFio2: 45,
    descriptionAr: 'النمط الموصى به لحماية الرئة (Lung-Protective)',
    descriptionEn: 'Lung-protective dual control mode'
  },
  { 
    id: 'SIMV_PC', 
    category: 'INVASIVE_VENT', 
    labelEn: 'SIMV-PC (Pressure Control)', 
    labelAr: 'SIMV بالتحكم بالضغط', 
    defaultFio2: 45,
    descriptionAr: 'تهوية إجبارية متزامنة بالضغط',
    descriptionEn: 'Synchronized intermittent mandatory PC'
  },
  { 
    id: 'SIMV_VC', 
    category: 'INVASIVE_VENT', 
    labelEn: 'SIMV-VC (Volume Control)', 
    labelAr: 'SIMV بالتحكم بالحجم', 
    defaultFio2: 45,
    descriptionAr: 'تهوية إجبارية متزامنة بالحجم',
    descriptionEn: 'Synchronized intermittent mandatory VC'
  },
  { 
    id: 'APRV', 
    category: 'INVASIVE_VENT', 
    labelEn: 'APRV (BiLevel Release)', 
    labelAr: 'APRV تحرير ضغط مجرى الهواء', 
    defaultFio2: 60,
    descriptionAr: 'لحالات ARDS الشديدة وتبادل الغازات الصعب',
    descriptionEn: 'Airway pressure release for severe ARDS'
  },
  { 
    id: 'T_PIECE', 
    category: 'INVASIVE_VENT', 
    labelEn: 'T-Piece Weaning Trial', 
    labelAr: 'اختبار فطام وصلة T-Piece', 
    defaultFio2: 35,
    descriptionAr: 'تقييم جاهزية نزع الأنبوب الحنجري (Extubation)',
    descriptionEn: 'Spontaneous breathing trial before extubation'
  },
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

  // Active Category Tab
  const [activeCategory, setActiveCategory] = useState<RespiratoryCategory>('OXYGEN_THERAPY');
  
  // Selected Device / Mode
  const [selectedDevice, setSelectedDevice] = useState<string>('NASAL_CANNULA');
  
  // Fields
  const [oxygenFlow, setOxygenFlow] = useState<string>('3');
  const [fio2, setFio2] = useState<string>('32');
  const [peep, setPeep] = useState<string>('5');
  const [tidalVolume, setTidalVolume] = useState<string>('420');
  const [setRate, setSetRate] = useState<string>('14');
  const [actualRate, setActualRate] = useState<string>('16');
  const [peakPressure, setPeakPressure] = useState<string>('');
  const [plateauPressure, setPlateauPressure] = useState<string>('');
  const [ieRatio, setIeRatio] = useState<string>('1:2');
  const [circuitLeak, setCircuitLeak] = useState<string>('0');
  const [deviceModel, setDeviceModel] = useState<string>('');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [isWeaning, setIsWeaning] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);

  // Initialize values when opening
  useEffect(() => {
    if (!isOpen) {
      setHasInitialized(false);
      return;
    }

    if (isOpen && !hasInitialized) {
      if (initialVentilator) {
        const devMode = String(initialVentilator.mode || '');
        const matched = RESPIRATORY_DEVICES.find(d => d.id === devMode || d.labelEn === devMode || d.labelAr === devMode);
        
        if (matched) {
          setActiveCategory(matched.category);
          setSelectedDevice(matched.id);
        } else if (initialVentilator.supportCategory) {
          setActiveCategory(initialVentilator.supportCategory as RespiratoryCategory);
          setSelectedDevice(devMode);
        } else if (devMode.includes('Nasal') || devMode.includes('Mask') || devMode.includes('HFNC') || devMode.includes('Room')) {
          setActiveCategory('OXYGEN_THERAPY');
          setSelectedDevice(devMode);
        } else {
          setActiveCategory('INVASIVE_VENT');
          setSelectedDevice(devMode || 'PRVC');
        }

        setOxygenFlow(initialVentilator.oxygenFlowLpm !== undefined ? String(initialVentilator.oxygenFlowLpm) : '3');
        setFio2(initialVentilator.fio2Percent !== undefined ? String(initialVentilator.fio2Percent) : '32');
        setPeep(initialVentilator.peepCmH2O !== undefined ? String(initialVentilator.peepCmH2O) : '5');
        setTidalVolume(initialVentilator.tidalVolumeMl !== undefined ? String(initialVentilator.tidalVolumeMl) : '420');
        setSetRate(initialVentilator.setRespiratoryRateCpm !== undefined ? String(initialVentilator.setRespiratoryRateCpm) : '14');
        setActualRate(initialVentilator.actualRespiratoryRateCpm !== undefined ? String(initialVentilator.actualRespiratoryRateCpm) : '16');
        setPeakPressure(initialVentilator.peakInspiratoryPressureCmH2O !== undefined ? String(initialVentilator.peakInspiratoryPressureCmH2O) : '');
        setPlateauPressure(initialVentilator.plateauPressureCmH2O !== undefined ? String(initialVentilator.plateauPressureCmH2O) : '');
        setIeRatio(initialVentilator.ieRatio || '1:2');
        setCircuitLeak(initialVentilator.circuitLeakPercent !== undefined ? String(initialVentilator.circuitLeakPercent) : '0');
        setDeviceModel(initialVentilator.deviceModel || '');
        setClinicalNotes(initialVentilator.notes || '');
        setIsWeaning(initialVentilator.isWeaningTrialActive || false);
      } else {
        // Default to Nasal Cannula 3 L/min
        setActiveCategory('OXYGEN_THERAPY');
        setSelectedDevice('NASAL_CANNULA');
        setOxygenFlow('3');
        setFio2('32');
        setPeep('5');
        setTidalVolume('420');
        setSetRate('14');
        setActualRate('16');
        setPeakPressure('');
        setPlateauPressure('');
        setIeRatio('1:2');
        setCircuitLeak('0');
        setDeviceModel('Standard O2 Flowmeter');
        setClinicalNotes('');
        setIsWeaning(false);
      }
      setHasInitialized(true);
    }
  }, [isOpen, initialVentilator, hasInitialized]);

  if (!isOpen) return null;

  // Handler when selecting a device
  const handleSelectDevice = (device: RespiratoryDeviceOption) => {
    setSelectedDevice(device.id);
    setActiveCategory(device.category);

    if (device.category === 'OXYGEN_THERAPY') {
      const flow = device.defaultFlow || 3;
      setOxygenFlow(String(flow));
      setFio2(String(device.defaultFio2 || Math.min(100, 20 + flow * 4)));
      setDeviceModel(device.labelEn);
    } else if (device.category === 'ROOM_AIR') {
      setOxygenFlow('0');
      setFio2('21');
      setPeep('0');
      setDeviceModel('Room Air');
    } else if (device.category === 'NON_INVASIVE_NIV') {
      setFio2(String(device.defaultFio2 || 40));
      setPeep('5');
      setDeviceModel('BiPAP / NIV Mask');
    } else if (device.category === 'INVASIVE_VENT') {
      setFio2(String(device.defaultFio2 || 45));
      setPeep('5');
      setTidalVolume('420');
      setDeviceModel('Draeger / Hamilton ICU Ventilator');
    }
  };

  // Helper when changing oxygen flow rate for Nasal Cannula
  const handleFlowChange = (valStr: string) => {
    const rawVal = toEnglishDigits(valStr);
    setOxygenFlow(rawVal);
    const flowNum = parseEnglishFloat(rawVal);
    if (selectedDevice === 'NASAL_CANNULA' && flowNum > 0 && flowNum <= 6) {
      // Rule of 4: 1L = 24%, 2L = 28%, 3L = 32%, 4L = 36%, 5L = 40%, 6L = 44%
      const calculatedFio2 = Math.round(20 + flowNum * 4);
      setFio2(String(calculatedFio2));
    } else if (selectedDevice === 'SIMPLE_MASK' && flowNum >= 5) {
      const calcFio2 = Math.min(60, Math.max(40, 30 + flowNum * 3));
      setFio2(String(Math.round(calcFio2)));
    } else if (selectedDevice === 'RESERVOIR_MASK' && flowNum >= 10) {
      setFio2(String(Math.min(95, 60 + (flowNum - 10) * 7)));
    }
  };

  // Calculations for mechanical ventilator
  const parsedPplat = parseEnglishFloat(plateauPressure);
  const parsedPeep = parseEnglishFloat(peep);
  const calculatedDrivingPressure = (parsedPplat > 0 && parsedPeep > 0) ? Math.max(0, parsedPplat - parsedPeep) : null;
  const parsedVt = parseEnglishFloat(tidalVolume);
  const ibw = patient?.idealBodyWeightKg || (patient?.gender === 'MALE' ? 70 : 60) || 70;
  const vtPerKg = ibw > 0 && parsedVt > 0 ? (parsedVt / ibw).toFixed(1) : null;

  // Save / Record
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const patientId = patient?.id || 'unknown_patient';

    try {
      const existingRecordId = initialVentilator?.id || `vent_${bedNumber}_${patientId}`;
      const existingRecord = await db.ventilators.get(existingRecordId);
      const existingHistory = existingRecord?.history || [];

      // Find current device details for clean labeling
      const matchedDevice = RESPIRATORY_DEVICES.find(d => d.id === selectedDevice);
      const modeLabel = matchedDevice 
        ? matchedDevice.labelEn 
        : selectedDevice;

      const flowVal = parseEnglishFloat(oxygenFlow) || 0;
      const fio2Val = parseEnglishFloat(fio2) || (activeCategory === 'ROOM_AIR' ? 21 : 40);
      const peepVal = parseEnglishFloat(peep) || 0;
      const vtVal = parseEnglishFloat(tidalVolume) || 0;

      const newHistoryEntry = {
        id: `vent_hist_${Date.now()}`,
        timestamp: new Date().toISOString(),
        mode: modeLabel,
        supportCategory: activeCategory,
        oxygenFlowLpm: activeCategory === 'OXYGEN_THERAPY' ? flowVal : undefined,
        fio2Percent: fio2Val,
        peepCmH2O: (activeCategory === 'INVASIVE_VENT' || activeCategory === 'NON_INVASIVE_NIV') ? peepVal : 0,
        tidalVolumeMl: activeCategory === 'INVASIVE_VENT' ? vtVal : 0,
        recordedByStaffName: currentUser?.nameEn || currentUser?.nameAr || 'ICU Clinician',
        recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
        deviceModel: deviceModel.trim() || modeLabel,
        setRespiratoryRateCpm: parseEnglishFloat(setRate) || 14,
        actualRespiratoryRateCpm: parseEnglishFloat(actualRate) || 16,
        peakInspiratoryPressureCmH2O: parseEnglishFloat(peakPressure) || 0,
        plateauPressureCmH2O: parseEnglishFloat(plateauPressure) || 0,
        drivingPressureCmH2O: calculatedDrivingPressure || 0,
        ieRatio: ieRatio.trim(),
        circuitLeakPercent: parseEnglishFloat(circuitLeak) || 0,
        notes: clinicalNotes.trim(),
      };

      const ventRecord: VentilatorParameters = {
        id: existingRecordId,
        bedId: bedNumber,
        patientId: patientId,
        timestamp: new Date().toISOString(),
        deviceModel: deviceModel.trim() || modeLabel,
        mode: modeLabel as any,
        supportCategory: activeCategory,
        oxygenFlowLpm: activeCategory === 'OXYGEN_THERAPY' ? flowVal : undefined,
        fio2Percent: fio2Val,
        peepCmH2O: (activeCategory === 'INVASIVE_VENT' || activeCategory === 'NON_INVASIVE_NIV') ? peepVal : 0,
        tidalVolumeMl: activeCategory === 'INVASIVE_VENT' ? vtVal : 0,
        peakInspiratoryPressureCmH2O: parseEnglishFloat(peakPressure) || 0,
        plateauPressureCmH2O: parseEnglishFloat(plateauPressure) || 0,
        drivingPressureCmH2O: calculatedDrivingPressure || 0,
        setRespiratoryRateCpm: parseEnglishFloat(setRate) || 14,
        actualRespiratoryRateCpm: parseEnglishFloat(actualRate) || 16,
        ieRatio: ieRatio.trim(),
        isWeaningTrialActive: isWeaning,
        circuitLeakPercent: parseEnglishFloat(circuitLeak) || 0,
        notes: clinicalNotes.trim(),
        recordedByStaffName: currentUser?.nameEn || currentUser?.nameAr || 'ICU Clinician',
        history: [...existingHistory, newHistoryEntry],
      };

      // Save to Dexie local DB
      await db.ventilators.put(ventRecord);

      // Sync to Firebase Cloud Firestore
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
      console.error('Error saving respiratory record:', err);
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل حفظ بيانات دعم التنفس' : 'Failed to save respiratory parameters'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Discontinue / Set to Room Air
  const handleDiscontinueToRoomAir = async () => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من فصل دعم الأكسجين/التنفس وتأكيد تنفس المريض على هواء الغرفة (Room Air)؟' : 'Confirm weaning/discontinuing to Room Air (Spontaneous Breathing)?')) {
      return;
    }

    handleSelectDevice(RESPIRATORY_DEVICES.find(d => d.id === 'ROOM_AIR')!);
  };

  // Complete Delete of Record
  const handleRemoveVentilator = async () => {
    if (!canDeleteRecord(currentUser)) {
      alert(lang === 'ar' ? 'غير مصرح: حذف السجلات الطبية يتطلب صلاحيات إدارية خاصة.' : 'Unauthorized: Deleting medical records requires administrative permissions.');
      return;
    }

    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف سجل التنفس والأكسجين نهائياً لهذا السرير؟' : 'Confirm complete deletion of respiratory record?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const existing = await db.ventilators.where('patientId').equals(patient?.id || '').first();
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
      setErrorMessage(err?.message || (lang === 'ar' ? 'فشل إزالة السجل' : 'Failed to remove record'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOxygenTherapy = activeCategory === 'OXYGEN_THERAPY';
  const isRoomAir = activeCategory === 'ROOM_AIR';
  const isInvasiveVent = activeCategory === 'INVASIVE_VENT';
  const isNiv = activeCategory === 'NON_INVASIVE_NIV';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl bg-white dark:bg-[#091122] border border-slate-200 dark:border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-900 dark:text-white"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{lang === 'ar' ? `إعدادات دعم التنفس والأكسجين - سرير ${bedNumber}` : `Respiratory & Oxygen Support - Bed ${bedNumber}`}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800 font-mono font-bold">
                  {patient?.fullNameAr || patient?.fullNameEn || `Bed ${bedNumber}`}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' 
                  ? 'تسجيل وتوثيق أجهزة الأكسجين (كانيولا، ماسك، ريزرفوار) وأجهزة التنفس الصناعي والـ NIV' 
                  : 'Configure Oxygen Delivery (Cannula, Masks, HFNC), NIV & Mechanical Ventilation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-4 sm:px-5 pt-3 bg-slate-100 dark:bg-[#070d1a] border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('OXYGEN_THERAPY');
              const firstOxygen = RESPIRATORY_DEVICES.find(d => d.category === 'OXYGEN_THERAPY');
              if (firstOxygen) handleSelectDevice(firstOxygen);
            }}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeCategory === 'OXYGEN_THERAPY'
                ? 'bg-white dark:bg-[#091122] text-teal-600 dark:text-teal-300 border-teal-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-teal-500" />
            <span>{lang === 'ar' ? 'أجهزة العلاج بالأكسجين (Oxygen Therapy)' : 'Oxygen Delivery Devices'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('INVASIVE_VENT');
              const firstVent = RESPIRATORY_DEVICES.find(d => d.category === 'INVASIVE_VENT');
              if (firstVent) handleSelectDevice(firstVent);
            }}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeCategory === 'INVASIVE_VENT'
                ? 'bg-white dark:bg-[#091122] text-cyan-600 dark:text-cyan-300 border-cyan-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wind className="w-3.5 h-3.5 text-cyan-500" />
            <span>{lang === 'ar' ? 'جهاز تنفس صناعي جائر (Mechanical Vent)' : 'Mechanical Ventilation'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('NON_INVASIVE_NIV');
              const firstNiv = RESPIRATORY_DEVICES.find(d => d.category === 'NON_INVASIVE_NIV');
              if (firstNiv) handleSelectDevice(firstNiv);
            }}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeCategory === 'NON_INVASIVE_NIV'
                ? 'bg-white dark:bg-[#091122] text-indigo-600 dark:text-indigo-300 border-indigo-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            <span>{lang === 'ar' ? 'تهوية غير جائرة (NIV / BiPAP)' : 'NIV / BiPAP'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('ROOM_AIR');
              const roomAir = RESPIRATORY_DEVICES.find(d => d.category === 'ROOM_AIR');
              if (roomAir) handleSelectDevice(roomAir);
            }}
            className={`px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
              activeCategory === 'ROOM_AIR'
                ? 'bg-white dark:bg-[#091122] text-emerald-600 dark:text-emerald-300 border-emerald-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>{lang === 'ar' ? 'هواء الغرفة (Room Air)' : 'Room Air'}</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-red-950/60 border border-rose-200 dark:border-red-800/80 text-rose-800 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 dark:text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Device Selection Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {lang === 'ar' ? 'اختر جهاز ونوع دعم التنفس المطلوب:' : 'Select Specific Respiratory Delivery Device:'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {RESPIRATORY_DEVICES.filter(d => d.category === activeCategory).map((dev) => {
                const isSelected = selectedDevice === dev.id;
                return (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => handleSelectDevice(dev)}
                    className={`p-3 rounded-xl text-xs text-start border transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-sm ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-cyan-500/20 text-slate-900 dark:text-cyan-200 border-teal-500 dark:border-cyan-400 ring-2 ring-teal-400/30'
                        : 'bg-slate-50 dark:bg-[#060b17] text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs font-sans text-slate-900 dark:text-white">
                        {lang === 'ar' ? dev.labelAr : dev.labelEn}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {lang === 'ar' ? dev.descriptionAr : dev.descriptionEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC PARAMETER SECTION BASED ON SELECTED CATEGORY */}

          {/* A. OXYGEN THERAPY SECTION (Nasal Cannula, Simple Mask, Reservoir Mask, Venturi, HFNC, Trach Mask) */}
          {isOxygenTherapy && (
            <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-[#060d1b] border border-teal-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-teal-200 dark:border-slate-800 text-xs">
                <span className="font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'معاملات تدفق الأكسجين والتركيز:' : 'Oxygen Flow & FiO₂ Settings:'}</span>
                </span>
                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                  {selectedDevice === 'NASAL_CANNULA' ? (lang === 'ar' ? 'كل 1 لتر/د يرفع FiO₂ بمعدل 4%' : 'Rule of 4: +4% FiO2 per L/min') : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Flow Rate (L/min) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'معدل تدفق الأكسجين (L/min):' : 'Oxygen Flow Rate (L/min):'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={oxygenFlow}
                      onChange={(e) => handleFlowChange(e.target.value)}
                      placeholder="e.g. 3, 5, 8, 15"
                      required
                      className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-teal-800 dark:text-teal-300 font-mono font-bold text-base focus:border-teal-500 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-mono font-bold">L/min</span>
                  </div>

                  {/* Flow Presets Pills */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map((presetFlow) => (
                      <button
                        key={presetFlow}
                        type="button"
                        onClick={() => handleFlowChange(String(presetFlow))}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          oxygenFlow === String(presetFlow)
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {presetFlow}L
                      </button>
                    ))}
                  </div>
                </div>

                {/* FiO2 (%) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'نسبة الأكسجين المستنشق FiO₂ (%):' : 'Fraction of Inspired O₂ (FiO₂ %):'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fio2}
                      onChange={(e) => setFio2(toEnglishDigits(e.target.value))}
                      placeholder="21 - 100"
                      required
                      className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-teal-800 dark:text-teal-300 font-mono font-bold text-base focus:border-teal-500 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-mono font-bold">%</span>
                  </div>

                  {/* FiO2 Quick Presets */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[24, 28, 32, 35, 40, 50, 60, 80, 100].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFio2(String(f))}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                          fio2 === String(f)
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        {f}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Respiratory Rate (RR) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'معدل التنفس الفعلي (RR bpm):' : 'Respiratory Rate (RR bpm):'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={actualRate}
                      onChange={(e) => setActualRate(toEnglishDigits(e.target.value))}
                      placeholder="12 - 35"
                      className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-base focus:border-teal-500 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-mono font-bold">bpm</span>
                  </div>
                </div>
              </div>

              {/* Summary Strip */}
              <div className="p-3 rounded-xl bg-white dark:bg-[#060b17] border border-teal-200 dark:border-slate-800 text-xs flex items-center justify-between flex-wrap gap-2 text-slate-800 dark:text-slate-200 font-mono">
                <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-bold">
                  <Activity className="w-4 h-4" />
                  <span>
                    {RESPIRATORY_DEVICES.find(d => d.id === selectedDevice)?.labelEn || selectedDevice} @ {oxygenFlow} L/min (FiO₂ {fio2}%)
                  </span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {lang === 'ar' ? 'سيتم حفظ هذا الجهاز وتوثيقه في السجل وتسليم SBAR' : 'Logged into flowsheet & SBAR handover'}
                </span>
              </div>
            </div>
          )}

          {/* B. ROOM AIR SECTION */}
          {isRoomAir && (
            <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/40 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                {lang === 'ar' ? 'تنفس طبيعي على هواء الغرفة (Room Air)' : 'Spontaneous Breathing on Room Air'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                {lang === 'ar' 
                  ? 'المريض لا يحتاج لأي أجهزة أو أنابيب أكسجين ويتنفس تلقائياً بتركيز FiO₂ 21%.' 
                  : 'Patient is extubated and maintaining adequate saturation on ambient room air (21% FiO2).'}
              </p>
            </div>
          )}

          {/* C. INVASIVE MECHANICAL VENTILATOR & NIV PARAMETERS */}
          {(isInvasiveVent || isNiv) && (
            <div className="space-y-4">
              {/* Lung-Protective Strip */}
              {isInvasiveVent && (
                <div className="p-3 rounded-xl bg-cyan-50 dark:bg-[#060d1b] border border-cyan-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div>
                    <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'حجم التنفس لكل كجم IBW:' : 'Vt / kg IBW:'}</div>
                    <div className="text-teal-700 dark:text-teal-300 font-bold text-sm">
                      {vtPerKg ? `${vtPerKg} mL/kg` : '—'} 
                      <span className="text-[10px] font-normal text-slate-500 ml-1">(IBW: {ibw}kg)</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'ضغط القيادة (Driving P):' : 'Driving Pressure (ΔP):'}</div>
                    <div className={`font-bold text-sm ${calculatedDrivingPressure && calculatedDrivingPressure > 14 ? 'text-red-500 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {calculatedDrivingPressure !== null ? `${calculatedDrivingPressure} cmH2O` : '—'}
                      <span className="text-[9px] font-normal text-slate-500 ml-1">(&lt; 14 safe)</span>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="text-[10px] text-slate-500">{lang === 'ar' ? 'طراز جهاز التنفس:' : 'Ventilator Model:'}</div>
                    <input
                      type="text"
                      value={deviceModel}
                      onChange={(e) => setDeviceModel(e.target.value)}
                      placeholder="e.g. Draeger Evita V800"
                      className="w-full bg-white dark:bg-transparent border border-slate-300 dark:border-slate-700 rounded-lg dark:border-0 dark:border-b text-slate-900 dark:text-slate-200 text-xs px-2 py-1 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Numerical Parameters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* FiO2 */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                      className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-teal-700 dark:text-teal-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                    />
                    <span className="absolute right-2.5 top-2.5 text-xs text-slate-500 font-mono">%</span>
                  </div>
                </div>

                {/* PEEP / EPAP */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isNiv ? 'EPAP / PEEP (cmH2O)' : 'PEEP (cmH2O)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={peep}
                    onChange={(e) => setPeep(toEnglishDigits(e.target.value))}
                    placeholder="0 - 24"
                    required
                    className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-cyan-700 dark:text-cyan-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Tidal Volume (Vt) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tidal Volume (mL)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tidalVolume}
                    onChange={(e) => setTidalVolume(toEnglishDigits(e.target.value))}
                    placeholder="300 - 650"
                    required={isInvasiveVent}
                    className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Set Rate */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Set Rate (RR bpm)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={setRate}
                    onChange={(e) => setSetRate(toEnglishDigits(e.target.value))}
                    placeholder="10 - 35"
                    required={isInvasiveVent}
                    className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Peak Pressure PIP */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {isNiv ? 'IPAP / PIP (cmH2O)' : 'Ppeak / PIP (cmH2O)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={peakPressure}
                    onChange={(e) => setPeakPressure(toEnglishDigits(e.target.value))}
                    placeholder="15 - 40"
                    className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-amber-600 dark:text-amber-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Plateau Pressure Pplat */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pplat (cmH2O)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={plateauPressure}
                    onChange={(e) => setPlateauPressure(toEnglishDigits(e.target.value))}
                    placeholder="10 - 30"
                    className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-indigo-600 dark:text-indigo-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* Actual Rate */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Actual Total RR
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={actualRate}
                    onChange={(e) => setActualRate(toEnglishDigits(e.target.value))}
                    placeholder="12 - 40"
                    className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                {/* I:E Ratio */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    I:E Ratio
                  </label>
                  <input
                    type="text"
                    value={ieRatio}
                    onChange={(e) => setIeRatio(e.target.value)}
                    placeholder="1:2"
                    className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-mono font-bold text-sm focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes & Additional Clinical Observations */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'ar' ? 'ملاحظات وتوجيهات سريرية (Clinical Notes):' : 'Clinical Notes & Weaning Observations:'}
            </label>
            <input
              type="text"
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder={lang === 'ar' ? 'مثال: نيزل كانيولا 3 لتر للحفاظ على SpO2 > 94%، مريض متعاون...' : 'e.g. NC 3L maintaining SpO2 > 94%, patient comfortable...'}
              className="w-full bg-slate-50 dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:border-teal-500 focus:outline-none"
            />
          </div>

          {/* Weaning Checkbox */}
          {(isInvasiveVent || isNiv) && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isWeaning"
                checked={isWeaning}
                onChange={(e) => setIsWeaning(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <label htmlFor="isWeaning" className="text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                {lang === 'ar' ? 'تفعيل اختبار الفطام السريري (Spontaneous Breathing / Weaning Trial)' : 'Active Spontaneous Breathing / Weaning Trial'}
              </label>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {/* Discontinue / Room Air button */}
              <button
                type="button"
                onClick={handleDiscontinueToRoomAir}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 text-xs font-bold transition-all cursor-pointer"
                title={lang === 'ar' ? 'إيقاف الدعم والتنفس على هواء الغرفة' : 'Discontinue to Room Air'}
              >
                <PowerOff className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إيقاف / هواء الغرفة' : 'Set to Room Air'}</span>
              </button>

              {/* Complete Delete button */}
              {initialVentilator && canDeleteRecord(currentUser) && (
                <button
                  type="button"
                  onClick={handleRemoveVentilator}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800/80 text-xs font-bold transition-all cursor-pointer"
                  title={lang === 'ar' ? 'حذف السجل نهائياً' : 'Delete Record'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'حذف السجل' : 'Delete'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold shadow-md shadow-teal-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? (lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ وتوثيق الإعدادات' : 'Save & Record Settings')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
