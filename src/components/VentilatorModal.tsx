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
  flowPresets?: number[];
  fio2Presets?: number[];
}

const RESPIRATORY_DEVICES: RespiratoryDeviceOption[] = [
  // 1. Oxygen Therapy Devices (Concise Medical Terms & Tailored Ranges)
  { 
    id: 'NASAL_CANNULA', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Nasal Cannula (NC)', 
    labelAr: 'قنية أنفية (Nasal Cannula - NC)', 
    defaultFlow: 3, 
    defaultFio2: 32, 
    flowRange: '1 - 6 L/min (24% - 44% FiO₂)',
    descriptionAr: '1-6 L/min (24% - 44% FiO₂)',
    descriptionEn: '1-6 L/min (24% - 44% FiO2)',
    flowPresets: [1, 2, 3, 4, 5, 6],
    fio2Presets: [24, 28, 32, 36, 40, 44]
  },
  { 
    id: 'SIMPLE_MASK', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Simple Mask (Face Mask)', 
    labelAr: 'ماسك وجه بسيط (Simple Face Mask)', 
    defaultFlow: 6, 
    defaultFio2: 45, 
    flowRange: '5 - 8 L/min (40% - 60% FiO₂)',
    descriptionAr: '5-8 L/min (40% - 60% FiO₂)',
    descriptionEn: '5-8 L/min (40% - 60% FiO2)',
    flowPresets: [5, 6, 7, 8],
    fio2Presets: [40, 45, 50, 55, 60]
  },
  { 
    id: 'PARTIAL_REBREATHER', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Partial Rebreather (PRBM)', 
    labelAr: 'ماسك بارشيال ريبريزر (PRBM)', 
    defaultFlow: 8, 
    defaultFio2: 70, 
    flowRange: '6 - 10 L/min (60% - 80% FiO₂)',
    descriptionAr: '6-10 L/min (60% - 80% FiO₂)',
    descriptionEn: '6-10 L/min (60% - 80% FiO2)',
    flowPresets: [6, 7, 8, 9, 10],
    fio2Presets: [60, 65, 70, 75, 80]
  },
  { 
    id: 'RESERVOIR_MASK', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Non-Rebreather (NRBM)', 
    labelAr: 'ماسك نون ريبريزر (NRBM)', 
    defaultFlow: 12, 
    defaultFio2: 80, 
    flowRange: '10 - 15 L/min (60% - 95% FiO₂)',
    descriptionAr: '10-15 L/min (60% - 95% FiO₂)',
    descriptionEn: '10-15 L/min (60% - 95% FiO2)',
    flowPresets: [10, 11, 12, 13, 14, 15],
    fio2Presets: [60, 70, 80, 90, 95]
  },
  { 
    id: 'VENTURI_MASK', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Venturi Mask (Fixed FiO₂)', 
    labelAr: 'ماسك فينتوري (Venturi Mask)', 
    defaultFlow: 6, 
    defaultFio2: 28, 
    flowRange: '4 - 10 L/min (24% - 55% FiO₂)',
    descriptionAr: '4-10 L/min (24% - 55% FiO₂)',
    descriptionEn: '4-10 L/min (24% - 55% FiO2)',
    flowPresets: [4, 6, 8, 10],
    fio2Presets: [24, 28, 31, 35, 40, 50, 55]
  },
  { 
    id: 'HIGH_FLOW_NC', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'High-Flow Cannula (HFNC)', 
    labelAr: 'قنية عالية التدفق (HFNC)', 
    defaultFlow: 40, 
    defaultFio2: 50, 
    flowRange: '20 - 60 L/min (21% - 100% FiO₂)',
    descriptionAr: '20-60 L/min (21% - 100% FiO₂)',
    descriptionEn: '20-60 L/min (21-100% FiO2)',
    flowPresets: [20, 30, 40, 50, 60],
    fio2Presets: [30, 40, 50, 60, 80, 100]
  },
  { 
    id: 'TRACH_MASK', 
    category: 'OXYGEN_THERAPY', 
    labelEn: 'Trach Collar / T-Piece', 
    labelAr: 'قناع شق حنجري (Trach Collar)', 
    defaultFlow: 8, 
    defaultFio2: 35, 
    flowRange: '5 - 15 L/min (28% - 50% FiO₂)',
    descriptionAr: '5-15 L/min (28% - 50% FiO₂)',
    descriptionEn: '5-15 L/min (28-50% FiO2)',
    flowPresets: [5, 8, 10, 12, 15],
    fio2Presets: [28, 35, 40, 50]
  },
  { 
    id: 'ROOM_AIR', 
    category: 'ROOM_AIR', 
    labelEn: 'Room Air (Spontaneous)', 
    labelAr: 'هواء الغرفة (Room Air)', 
    defaultFlow: 0, 
    defaultFio2: 21, 
    flowRange: '0 L/min (21% FiO₂)',
    descriptionAr: 'تنفس تلقائي (21% FiO₂)',
    descriptionEn: 'Spontaneous ambient air',
    flowPresets: [0],
    fio2Presets: [21]
  },

  // 2. Non-Invasive Ventilation (NIV)
  { 
    id: 'BIPAP', 
    category: 'NON_INVASIVE_NIV', 
    labelEn: 'BiPAP (IPAP / EPAP)', 
    labelAr: 'BiPAP (IPAP / EPAP)', 
    defaultFlow: 0, 
    defaultFio2: 40,
    descriptionAr: 'دعم ضغط إيجابي ثنائي غير جائر',
    descriptionEn: 'Non-invasive positive pressure'
  },
  { 
    id: 'PSV_CPAP', 
    category: 'NON_INVASIVE_NIV', 
    labelEn: 'CPAP / PSV', 
    labelAr: 'CPAP / PSV (Spontaneous)', 
    defaultFlow: 0, 
    defaultFio2: 40,
    descriptionAr: 'ضغط مستمر ودعم تنفس تلقائي',
    descriptionEn: 'Continuous airway pressure & PS'
  },

  // 3. Invasive Mechanical Ventilation
  { 
    id: 'PRVC', 
    category: 'INVASIVE_VENT', 
    labelEn: 'PRVC / AC', 
    labelAr: 'PRVC / AC (Lung-Protective)', 
    defaultFio2: 45,
    descriptionAr: 'حجم منظم بالضغط لحماية الرئة',
    descriptionEn: 'Dual-control lung-protective mode'
  },
  { 
    id: 'SIMV_PC', 
    category: 'INVASIVE_VENT', 
    labelEn: 'SIMV-PC', 
    labelAr: 'SIMV-PC (Pressure Control)', 
    defaultFio2: 45,
    descriptionAr: 'تهوية متزامنة بالتحكم بالضغط',
    descriptionEn: 'Synchronized intermittent mandatory PC'
  },
  { 
    id: 'SIMV_VC', 
    category: 'INVASIVE_VENT', 
    labelEn: 'SIMV-VC', 
    labelAr: 'SIMV-VC (Volume Control)', 
    defaultFio2: 45,
    descriptionAr: 'تهوية متزامنة بالتحكم بالحجم',
    descriptionEn: 'Synchronized intermittent mandatory VC'
  },
  { 
    id: 'APRV', 
    category: 'INVASIVE_VENT', 
    labelEn: 'APRV (BiLevel Release)', 
    labelAr: 'APRV (BiLevel Release)', 
    defaultFio2: 60,
    descriptionAr: 'لحالات ARDS الشديدة واضطراب الأكسجة',
    descriptionEn: 'Airway pressure release for severe ARDS'
  },
  { 
    id: 'T_PIECE', 
    category: 'INVASIVE_VENT', 
    labelEn: 'T-Piece Trial', 
    labelAr: 'T-Piece Trial (Weaning)', 
    defaultFio2: 35,
    descriptionAr: 'تجربة فطام وتقييم نزع الأنبوب الرغامي',
    descriptionEn: 'Spontaneous breathing trial (Extubation)'
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

  // Helper when changing oxygen flow rate
  const handleFlowChange = (valStr: string) => {
    const rawVal = toEnglishDigits(valStr);
    setOxygenFlow(rawVal);
    const flowNum = parseEnglishFloat(rawVal);
    if (isNaN(flowNum) || flowNum <= 0) return;

    if (selectedDevice === 'NASAL_CANNULA') {
      // 1L=24%, 2L=28%, 3L=32%, 4L=36%, 5L=40%, 6L=44%
      const calculatedFio2 = Math.min(44, Math.max(24, Math.round(20 + flowNum * 4)));
      setFio2(String(calculatedFio2));
    } else if (selectedDevice === 'SIMPLE_MASK') {
      // 5L=40%, 6L=45%, 7L=50%, 8L=60%
      const table: Record<number, number> = { 5: 40, 6: 45, 7: 50, 8: 60 };
      const nearest = table[Math.round(flowNum)] || Math.min(60, Math.max(40, Math.round(40 + (flowNum - 5) * 6.6)));
      setFio2(String(nearest));
    } else if (selectedDevice === 'PARTIAL_REBREATHER') {
      // 6L=60%, 7L=65%, 8L=70%, 9L=75%, 10L=80%
      const table: Record<number, number> = { 6: 60, 7: 65, 8: 70, 9: 75, 10: 80 };
      const nearest = table[Math.round(flowNum)] || Math.min(80, Math.max(60, Math.round(60 + (flowNum - 6) * 5)));
      setFio2(String(nearest));
    } else if (selectedDevice === 'RESERVOIR_MASK') {
      // 10L=60%, 11L=70%, 12L=80%, 13L=85%, 14L=90%, 15L=95%
      const table: Record<number, number> = { 10: 60, 11: 70, 12: 80, 13: 85, 14: 90, 15: 95 };
      const nearest = table[Math.round(flowNum)] || Math.min(95, Math.max(60, Math.round(60 + (flowNum - 10) * 7)));
      setFio2(String(nearest));
    } else if (selectedDevice === 'VENTURI_MASK') {
      // 4L=24%, 6L=28%, 8L=35%, 10L=50%
      const table: Record<number, number> = { 4: 24, 6: 28, 8: 35, 10: 50 };
      const nearest = table[Math.round(flowNum)];
      if (nearest) setFio2(String(nearest));
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
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>{lang === 'ar' ? `إعدادات دعم التنفس والأكسجين - سرير ${bedNumber}` : `Respiratory & Oxygen Support - Bed ${bedNumber}`}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800 font-mono font-bold">
                  {patient?.fullNameAr || patient?.fullNameEn || `Bed ${bedNumber}`}
                </span>
              </h2>
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
        <div className="px-3 sm:px-5 pt-2 bg-slate-100 dark:bg-[#070d1a] border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('OXYGEN_THERAPY');
              const firstOxygen = RESPIRATORY_DEVICES.find(d => d.category === 'OXYGEN_THERAPY');
              if (firstOxygen) handleSelectDevice(firstOxygen);
            }}
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer shrink-0 ${
              activeCategory === 'OXYGEN_THERAPY'
                ? 'bg-white dark:bg-[#091122] text-teal-600 dark:text-teal-300 border-teal-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-teal-500" />
            <span>{lang === 'ar' ? 'العلاج بالأكسجين (O₂ Therapy)' : 'O₂ Therapy'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('INVASIVE_VENT');
              const firstVent = RESPIRATORY_DEVICES.find(d => d.category === 'INVASIVE_VENT');
              if (firstVent) handleSelectDevice(firstVent);
            }}
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer shrink-0 ${
              activeCategory === 'INVASIVE_VENT'
                ? 'bg-white dark:bg-[#091122] text-cyan-600 dark:text-cyan-300 border-cyan-500 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wind className="w-3.5 h-3.5 text-cyan-500" />
            <span>{lang === 'ar' ? 'تنفس صناعي جائر (Mechanical Vent)' : 'Mechanical Vent'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('NON_INVASIVE_NIV');
              const firstNiv = RESPIRATORY_DEVICES.find(d => d.category === 'NON_INVASIVE_NIV');
              if (firstNiv) handleSelectDevice(firstNiv);
            }}
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer shrink-0 ${
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
            className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 cursor-pointer shrink-0 ${
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
        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-red-950/60 border border-rose-200 dark:border-red-800/80 text-rose-800 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 dark:text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Device Selection Grid (Strictly 2 Columns Per Row with Medical Abbreviations) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              {lang === 'ar' ? 'اختر جهاز ونوع دعم التنفس المطلوب (عمودين لكل صف):' : 'Select Respiratory Delivery Device (2 columns):'}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {RESPIRATORY_DEVICES.filter(d => d.category === activeCategory).map((dev) => {
                const isSelected = selectedDevice === dev.id;
                return (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => handleSelectDevice(dev)}
                    className={`p-2.5 sm:p-3 rounded-xl text-xs text-start border transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-sm ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-cyan-500/20 text-slate-900 dark:text-cyan-200 border-teal-500 dark:border-cyan-400 ring-2 ring-teal-400/40'
                        : 'bg-white dark:bg-[#060b17] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-bold text-xs font-sans text-slate-900 dark:text-white truncate">
                        {lang === 'ar' ? dev.labelAr : dev.labelEn}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium">
                      {lang === 'ar' ? dev.descriptionAr : dev.descriptionEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC PARAMETER SECTION BASED ON SELECTED CATEGORY */}

          {/* A. OXYGEN THERAPY SECTION (Compact 2-Column High-Contrast Design with Device-Specific Presets) */}
          {isOxygenTherapy && (() => {
            const currentDevice = RESPIRATORY_DEVICES.find(d => d.id === selectedDevice);
            const currentFlowPresets = currentDevice?.flowPresets || [1, 2, 3, 4, 5, 6];
            const currentFio2Presets = currentDevice?.fio2Presets || [24, 28, 32, 36, 40, 44];

            return (
              <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#060d1b] border-2 border-teal-500/40 dark:border-teal-500/40 space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-extrabold text-teal-800 dark:text-teal-300 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Flame className="w-4 h-4 text-teal-500 shrink-0" />
                    <span>{lang === 'ar' ? 'معاملات تدفق وتركيز الأكسجين:' : 'Oxygen Flow & FiO₂ Settings:'}</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">
                    {currentDevice?.flowRange || (lang === 'ar' ? 'توصيل أكسجين' : 'Oxygen Delivery')}
                  </span>
                </div>

                {/* 2 Compact Columns: Flow Rate & FiO2 (Respiratory rate removed per request) */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
                  {/* Flow Rate (L/min) */}
                  <div className="bg-white dark:bg-[#091122] p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        {lang === 'ar' ? 'معدل التدفق (Flow):' : 'Oxygen Flow Rate:'}
                      </label>
                      <div className="flex items-center rounded-lg border-2 border-teal-500/50 dark:border-teal-500/60 bg-slate-50 dark:bg-[#060b17] px-2.5 py-1.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-400/30">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={oxygenFlow}
                          onChange={(e) => handleFlowChange(e.target.value)}
                          placeholder="3"
                          required
                          className="w-full bg-transparent text-center font-mono font-black text-base sm:text-lg text-teal-800 dark:text-teal-300 outline-none"
                        />
                        <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0 select-none">L/min</span>
                      </div>
                    </div>

                    {/* Flow Presets Tailored to Selected Device */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentFlowPresets.map((presetFlow) => (
                        <button
                          key={presetFlow}
                          type="button"
                          onClick={() => handleFlowChange(String(presetFlow))}
                          className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            oxygenFlow === String(presetFlow)
                              ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {presetFlow}L
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* FiO2 (%) */}
                  <div className="bg-white dark:bg-[#091122] p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        {lang === 'ar' ? 'نسبة الأكسجين (FiO₂):' : 'Estimated FiO₂ (%):'}
                      </label>
                      <div className="flex items-center rounded-lg border-2 border-teal-500/50 dark:border-teal-500/60 bg-slate-50 dark:bg-[#060b17] px-2.5 py-1.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-400/30">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={fio2}
                          onChange={(e) => setFio2(toEnglishDigits(e.target.value))}
                          placeholder="32"
                          required
                          className="w-full bg-transparent text-center font-mono font-black text-base sm:text-lg text-teal-800 dark:text-teal-300 outline-none"
                        />
                        <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0 select-none">%</span>
                      </div>
                    </div>

                    {/* FiO2 Presets Tailored to Selected Device */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {currentFio2Presets.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFio2(String(f))}
                          className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                            fio2 === String(f)
                              ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {f}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Summary Strip */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#060b17] border border-teal-200 dark:border-slate-800 text-xs flex items-center justify-between flex-wrap gap-1.5 text-slate-800 dark:text-slate-200 font-mono shadow-sm">
                  <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-black text-[11px] sm:text-xs">
                    <Activity className="w-3.5 h-3.5" />
                    <span>
                      {currentDevice?.labelEn || selectedDevice} @ {oxygenFlow} L/min (FiO₂ {fio2}%)
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {lang === 'ar' ? 'توثيق في السجل وتسليم SBAR' : 'Auto-synced into Flowsheet & SBAR'}
                  </span>
                </div>
              </div>
            );
          })()}

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
                  <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#060b17] px-3 py-1.5 focus-within:border-cyan-400">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={fio2}
                      onChange={(e) => setFio2(toEnglishDigits(e.target.value))}
                      placeholder="21 - 100"
                      required
                      className="w-full bg-transparent text-center text-teal-700 dark:text-teal-300 font-mono font-bold text-sm outline-none"
                    />
                    <span className="text-xs text-slate-500 font-mono shrink-0 select-none">%</span>
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
