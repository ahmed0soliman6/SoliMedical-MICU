import React, { useState, useEffect, useMemo } from 'react';
import { 
  Droplet, 
  X, 
  Check, 
  AlertCircle, 
  Plus, 
  Minus,
  Trash2, 
  Sliders
} from 'lucide-react';
import { BedNumber, PatientDossier, InfusionPumpLine, PumpStatus } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { doc, deleteDoc } from 'firebase/firestore';
import { firestore, setDoc } from '../services/firebase.ts';
import { useTranslation } from '../services/i18n.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { toEnglishDigits, parseEnglishFloat } from '../services/numberUtils.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { canDeleteRecord } from '../services/medicalRecordPermissions.ts';

interface InfusionPumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patient?: PatientDossier | null;
  editingPump?: InfusionPumpLine | null;
  onSaved: () => void;
}

// Global Medical Drug Knowledge Base (ICU Standards)
interface DrugKnowledge {
  id: string;
  nameEn: string;
  nameAr: string;
  unitAmount: number; // e.g. 4 (mg), 20 (units), etc.
  unitMeasure: string; // 'mg' | 'mcg' | 'Units' | 'mmol' | 'mL'
  unitType: 'ampoule' | 'vial' | 'bag' | 'bottle';
  compatibleCarriers: { label: string; value: string; isDefault?: boolean }[];
  defaultVolumeMl: number;
  defaultFlowRate: number;
  dosingUnit: 'mcg/kg/min' | 'mcg/h' | 'mg/h' | 'Units/hr' | 'ml/h' | 'mcg/min' | 'mcg/kg/h';
  defaultTarget: string;
}

const ICU_DRUG_KNOWLEDGE: DrugKnowledge[] = [
  {
    id: 'noradrenaline',
    nameEn: 'Noradrenaline (Norepinephrine)',
    nameAr: 'نورأدرينالين',
    unitAmount: 4,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'D5W (ديكستروز 5% - موصى به)', value: 'D5W', isDefault: true },
      { label: 'D5NS (ديكستروز مع ملح)', value: 'D5NS' },
      { label: 'NS (محلول ملحي 0.9%)', value: 'NS' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 3.8,
    dosingUnit: 'mcg/kg/min',
    defaultTarget: 'Target MAP ≥ 65 mmHg'
  },
  {
    id: 'adrenaline',
    nameEn: 'Adrenaline (Epinephrine)',
    nameAr: 'أدرينالين',
    unitAmount: 4,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'D5W (ديكستروز 5% - موصى به)', value: 'D5W', isDefault: true },
      { label: 'NS (محلول ملحي 0.9%)', value: 'NS' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 2.0,
    dosingUnit: 'mcg/kg/min',
    defaultTarget: 'Inotropic support & SBP > 90 mmHg'
  },
  {
    id: 'insulin',
    nameEn: 'Regular Insulin (Actrapid)',
    nameAr: 'إنسولين عادي',
    unitAmount: 50,
    unitMeasure: 'Units',
    unitType: 'vial',
    compatibleCarriers: [
      { label: 'NS (محلول ملحي 0.9% - البروتوكول القياسي)', value: 'NS', isDefault: true }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 3.0,
    dosingUnit: 'Units/hr',
    defaultTarget: 'Target BG: 140 - 180 mg/dL'
  },
  {
    id: 'propofol',
    nameEn: 'Propofol 1%',
    nameAr: 'بروبوفول',
    unitAmount: 1000,
    unitMeasure: 'mg',
    unitType: 'bottle',
    compatibleCarriers: [
      { label: 'Neat (محلول مركز بدون تخفيف 100%)', value: 'Neat', isDefault: true },
      { label: 'D5W (ديكستروز 5%)', value: 'D5W' }
    ],
    defaultVolumeMl: 100,
    defaultFlowRate: 10.0,
    dosingUnit: 'mg/h',
    defaultTarget: 'Target RASS: -2 to -3 (Sedation)'
  },
  {
    id: 'midazolam',
    nameEn: 'Midazolam (Dormicum)',
    nameAr: 'ميدازولام',
    unitAmount: 50,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'NS (محلول ملحي 0.9% - موصى به)', value: 'NS', isDefault: true },
      { label: 'D5W (ديكستروز 5%)', value: 'D5W' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 3.0,
    dosingUnit: 'mg/h',
    defaultTarget: 'Sedation / Anxiolysis'
  },
  {
    id: 'fentanyl',
    nameEn: 'Fentanyl',
    nameAr: 'فنتانيل',
    unitAmount: 1000,
    unitMeasure: 'mcg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'NS (محلول ملحي 0.9% - موصى به)', value: 'NS', isDefault: true },
      { label: 'D5W (ديكستروز 5%)', value: 'D5W' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 2.5,
    dosingUnit: 'mcg/h',
    defaultTarget: 'Analgesia (CPOT score < 2)'
  },
  {
    id: 'dobutamine',
    nameEn: 'Dobutamine',
    nameAr: 'دوبيوتامين',
    unitAmount: 250,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'D5W (ديكستروز 5% - موصى به)', value: 'D5W', isDefault: true },
      { label: 'NS (محلول ملحي 0.9%)', value: 'NS' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 4.2,
    dosingUnit: 'mcg/kg/min',
    defaultTarget: 'Cardiac Index > 2.5 L/min'
  },
  {
    id: 'dopamine',
    nameEn: 'Dopamine',
    nameAr: 'دوبامين',
    unitAmount: 200,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'D5W (ديكستروز 5% - موصى به)', value: 'D5W', isDefault: true },
      { label: 'NS (محلول ملحي 0.9%)', value: 'NS' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 5.2,
    dosingUnit: 'mcg/kg/min',
    defaultTarget: 'Renal / Inotropic Support'
  },
  {
    id: 'vasopressin',
    nameEn: 'Vasopressin',
    nameAr: 'فازوبريسين',
    unitAmount: 20,
    unitMeasure: 'Units',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'NS (محلول ملحي 0.9% - موصى به)', value: 'NS', isDefault: true },
      { label: 'D5W (ديكستروز 5%)', value: 'D5W' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 4.5,
    dosingUnit: 'Units/hr',
    defaultTarget: 'Refractory Septic Shock'
  },
  {
    id: 'cordarone',
    nameEn: 'Cordarone (Amiodarone)',
    nameAr: 'كوردارون (أميودارون)',
    unitAmount: 300,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'D5W (ديكستروز 5% - إلزامي لتفادي الترسيب)', value: 'D5W', isDefault: true }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 3.3,
    dosingUnit: 'mg/h',
    defaultTarget: 'Rate Control / Sinus Rhythm'
  },
  {
    id: 'nitroglycerin',
    nameEn: 'Nitroglycerin (NTG)',
    nameAr: 'نيتروجلسرين',
    unitAmount: 50,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'D5W (ديكستروز 5% - موصى به)', value: 'D5W', isDefault: true },
      { label: 'NS (محلول ملحي 0.9%)', value: 'NS' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 3.0,
    dosingUnit: 'mcg/min',
    defaultTarget: 'Relieve Chest Pain / SBP 100-120'
  },
  {
    id: 'heparin',
    nameEn: 'Heparin Infusion',
    nameAr: 'هيبارين وريدي',
    unitAmount: 25000,
    unitMeasure: 'Units',
    unitType: 'vial',
    compatibleCarriers: [
      { label: 'D5W (ديكستروز 5% - موصى به)', value: 'D5W', isDefault: true },
      { label: 'NS (محلول ملحي 0.9%)', value: 'NS' }
    ],
    defaultVolumeMl: 250,
    defaultFlowRate: 10.0,
    dosingUnit: 'Units/hr',
    defaultTarget: 'Target aPTT: 60 - 85 sec'
  },
  {
    id: 'furosemide',
    nameEn: 'Furosemide (Lasix)',
    nameAr: 'لازيكس',
    unitAmount: 200,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'NS (محلول ملحي 0.9% - يجب عدم حله في D5W)', value: 'NS', isDefault: true }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 2.5,
    dosingUnit: 'mg/h',
    defaultTarget: 'Target Urine Output > 0.5 mL/kg/h'
  },
  {
    id: 'precedex',
    nameEn: 'Dexmedetomidine (Precedex)',
    nameAr: 'بريسيدكس (ديكسميديتوميدين)',
    unitAmount: 200,
    unitMeasure: 'mcg',
    unitType: 'vial',
    compatibleCarriers: [
      { label: 'NS (محلول ملحي 0.9% - موصى به)', value: 'NS', isDefault: true },
      { label: 'D5W (ديكستروز 5%)', value: 'D5W' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 5.0,
    dosingUnit: 'mcg/kg/h',
    defaultTarget: 'Light Sedation (RASS: 0 to -1)'
  },
  {
    id: 'kcl',
    nameEn: 'Potassium Chloride (KCl)',
    nameAr: 'بوتاسيوم وريدي',
    unitAmount: 40,
    unitMeasure: 'mmol',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'NS (محلول ملحي 0.9% - عبر خط وريدي مركزي)', value: 'NS', isDefault: true },
      { label: 'D5W (ديكستروز 5%)', value: 'D5W' }
    ],
    defaultVolumeMl: 500,
    defaultFlowRate: 50.0,
    dosingUnit: 'ml/h',
    defaultTarget: 'Correction of Hypokalemia'
  },
  {
    id: 'mgso4',
    nameEn: 'Magnesium Sulfate (MgSO4)',
    nameAr: 'سلفات المغنيسيوم',
    unitAmount: 5,
    unitMeasure: 'g',
    unitType: 'vial',
    compatibleCarriers: [
      { label: 'D5W (ديكستروز 5% - موصى به)', value: 'D5W', isDefault: true },
      { label: 'NS (محلول ملحي 0.9%)', value: 'NS' }
    ],
    defaultVolumeMl: 100,
    defaultFlowRate: 20.0,
    dosingUnit: 'ml/h',
    defaultTarget: 'Eclampsia / Torsades / Bronchospasm'
  },
  {
    id: 'pethidine',
    nameEn: 'Pethidine (Meperidine)',
    nameAr: 'بيثيدين',
    unitAmount: 100,
    unitMeasure: 'mg',
    unitType: 'ampoule',
    compatibleCarriers: [
      { label: 'NS (محلول ملحي 0.9% - موصى به)', value: 'NS', isDefault: true },
      { label: 'D5W (ديكستروز 5%)', value: 'D5W' }
    ],
    defaultVolumeMl: 50,
    defaultFlowRate: 2.5,
    dosingUnit: 'mg/h',
    defaultTarget: 'Analgesia (Pain Score < 3)'
  },
  {
    id: 'saline',
    nameEn: 'Normal Saline 0.9%',
    nameAr: 'محلول ملحي عادي',
    unitAmount: 500,
    unitMeasure: 'mL',
    unitType: 'bag',
    compatibleCarriers: [
      { label: 'None / IV Bag (مباشر من كيس المحلول)', value: 'None', isDefault: true }
    ],
    defaultVolumeMl: 500,
    defaultFlowRate: 80.0,
    dosingUnit: 'ml/h',
    defaultTarget: 'Hydration & Maintenance'
  }
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
  const { settings } = useSystemSettings();
  const { currentUser } = useAuth();

  // Selected drug knowledge
  const [selectedDrugId, setSelectedDrugId] = useState<string>('noradrenaline');
  const [drugNameEn, setDrugNameEn] = useState('');
  const [drugNameAr, setDrugNameAr] = useState('');
  
  // "العدد" (Count of ampoules/vials/units): 1 to 6 or Custom
  const [countValue, setCountValue] = useState<number>(1);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [customCountText, setCustomCountText] = useState<string>('1');

  // Carrier Solution Selection
  const [selectedCarrier, setSelectedCarrier] = useState<string>('D5W');
  const [isCustomCarrier, setIsCustomCarrier] = useState<boolean>(false);
  const [customCarrierText, setCustomCarrierText] = useState<string>('');

  // Primary operational parameters
  const [flowRateMlPerHour, setFlowRateMlPerHour] = useState<string>('3.8');
  const [totalVolumeMl, setTotalVolumeMl] = useState<string>('50');
  const [clinicalTargetDescription, setClinicalTargetDescription] = useState<string>('Target MAP ≥ 65 mmHg');
  
  // Channel & Line Access
  const [pumpChannel, setPumpChannel] = useState<'PUMP_A' | 'PUMP_B' | 'PUMP_C' | 'PUMP_D'>('PUMP_A');
  const [lineAccessType, setLineAccessType] = useState<'CVC_LINE_1' | 'CVC_LINE_2' | 'CVC_LINE_3' | 'PERIPHERAL' | 'ARTERIAL'>('CVC_LINE_1');
  const [status, setStatus] = useState<PumpStatus>(PumpStatus.RUNNING);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active drug knowledge object
  const currentKnowledge = useMemo(() => {
    if (selectedDrugId === 'custom') {
      return {
        id: 'custom',
        nameEn: drugNameEn || (lang === 'ar' ? 'دواء مخصص' : 'Custom Medication'),
        nameAr: drugNameAr || 'دواء مخصص',
        unitAmount: 1,
        unitMeasure: 'unit',
        unitType: 'ampoule' as const,
        compatibleCarriers: [
          { label: 'NS (محلول ملحي 0.9%)', value: 'NS', isDefault: true },
          { label: 'D5W (ديكستروز 5%)', value: 'D5W' },
          { label: 'D5NS (ديكستروز مع ملح)', value: 'D5NS' },
          { label: 'Neat (بدون تخفيف)', value: 'Neat' }
        ],
        defaultVolumeMl: 50,
        defaultFlowRate: 5.0,
        dosingUnit: 'ml/h' as const,
        defaultTarget: ''
      };
    }
    return ICU_DRUG_KNOWLEDGE.find(d => d.id === selectedDrugId) || ICU_DRUG_KNOWLEDGE[0];
  }, [selectedDrugId, drugNameEn, drugNameAr, lang]);

  // Find matching knowledge when drug name changes or presets are selected
  const applyDrugTemplate = (drug: DrugKnowledge) => {
    setSelectedDrugId(drug.id);
    setDrugNameEn(drug.nameEn);
    setDrugNameAr(drug.nameAr);
    setCountValue(1);
    setIsCustomCount(false);
    setCustomCountText('1');

    const defaultCarrierObj = drug.compatibleCarriers.find(c => c.isDefault) || drug.compatibleCarriers[0];
    setSelectedCarrier(defaultCarrierObj ? defaultCarrierObj.value : 'D5W');
    setIsCustomCarrier(false);
    setCustomCarrierText('');

    setTotalVolumeMl(String(drug.defaultVolumeMl));
    setFlowRateMlPerHour(String(drug.defaultFlowRate));
    setClinicalTargetDescription(drug.defaultTarget);
    setStatus(PumpStatus.RUNNING);
  };

  // Handle custom drug addition
  const handleSelectCustomDrug = () => {
    setSelectedDrugId('custom');
    setDrugNameEn('');
    setDrugNameAr('');
    setCountValue(1);
    setIsCustomCount(false);
    setCustomCountText('1');
    setSelectedCarrier('NS');
    setIsCustomCarrier(false);
    setCustomCarrierText('');
    setTotalVolumeMl('50');
    setFlowRateMlPerHour('5.0');
    setClinicalTargetDescription('');
    setStatus(PumpStatus.RUNNING);
  };

  // Populate data when editing an existing pump or opening fresh
  useEffect(() => {
    if (!isOpen) return;

    if (editingPump) {
      setDrugNameEn(editingPump.drugNameEn);
      setDrugNameAr(editingPump.drugNameAr || '');
      setPumpChannel(editingPump.pumpChannel || 'PUMP_A');
      setLineAccessType(editingPump.lineAccessType || 'CVC_LINE_1');
      setFlowRateMlPerHour(String(editingPump.flowRateMlPerHour || '0'));
      setTotalVolumeMl(String(editingPump.totalVolumeMl || '50'));
      setStatus(editingPump.status || PumpStatus.RUNNING);
      setClinicalTargetDescription(editingPump.clinicalTargetDescription || '');

      // Try matching with known drug knowledge
      const match = ICU_DRUG_KNOWLEDGE.find(d => 
        d.nameEn.toLowerCase().includes(editingPump.drugNameEn.toLowerCase().split(' ')[0]) ||
        editingPump.drugNameEn.toLowerCase().includes(d.id)
      );

      if (match) {
        setSelectedDrugId(match.id);
      } else {
        setSelectedDrugId('custom');
      }

      // Parse carrier
      if (editingPump.solutionCarrier) {
        const carrierStr = editingPump.solutionCarrier;
        if (carrierStr.includes('D5W')) setSelectedCarrier('D5W');
        else if (carrierStr.includes('NS')) setSelectedCarrier('NS');
        else if (carrierStr.includes('D5NS')) setSelectedCarrier('D5NS');
        else if (carrierStr.includes('Neat')) setSelectedCarrier('Neat');
        else {
          setIsCustomCarrier(true);
          setCustomCarrierText(carrierStr);
        }
      }
    } else {
      // Default to Noradrenaline
      applyDrugTemplate(ICU_DRUG_KNOWLEDGE[0]);
    }
  }, [editingPump, isOpen]);

  // Effective count
  const effectiveCount = isCustomCount ? (parseEnglishFloat(customCountText) || 1) : countValue;

  // Effective Carrier
  const effectiveCarrier = isCustomCarrier ? customCarrierText.trim() : selectedCarrier;

  // Total active drug amount in the solution
  const totalDrugAmount = effectiveCount * (currentKnowledge?.unitAmount || 1);
  const totalVolume = parseEnglishFloat(totalVolumeMl) || 50;
  const flowRate = parseEnglishFloat(flowRateMlPerHour) || 0;
  const patientWeight = (patient?.weightKg && patient.weightKg > 20) ? patient.weightKg : 70;

  // Background Automatic Calculation of Dose Rate & Unit
  const backgroundDoseCalculation = useMemo(() => {
    if (!currentKnowledge) {
      return { doseRate: flowRate, unit: 'ml/h' as const, label: `${flowRate} mL/h` };
    }

    const unit = currentKnowledge.dosingUnit;
    let doseRate = 0;

    if (unit === 'mcg/kg/min') {
      const totalAmountMcg = totalDrugAmount * 1000;
      const concMcgPerMl = totalVolume > 0 ? (totalAmountMcg / totalVolume) : 0;
      doseRate = patientWeight > 0 ? (flowRate * concMcgPerMl) / (patientWeight * 60) : 0;
    } else if (unit === 'mcg/kg/h') {
      const totalAmountMcg = totalDrugAmount;
      const concMcgPerMl = totalVolume > 0 ? (totalAmountMcg / totalVolume) : 0;
      doseRate = patientWeight > 0 ? (flowRate * concMcgPerMl) / patientWeight : 0;
    } else if (unit === 'mcg/min') {
      const totalAmountMcg = totalDrugAmount * 1000;
      const concMcgPerMl = totalVolume > 0 ? (totalAmountMcg / totalVolume) : 0;
      doseRate = (flowRate * concMcgPerMl) / 60;
    } else if (unit === 'Units/hr') {
      const concUnitsPerMl = totalVolume > 0 ? (totalDrugAmount / totalVolume) : 0;
      doseRate = flowRate * concUnitsPerMl;
    } else if (unit === 'mg/h') {
      const concMgPerMl = totalVolume > 0 ? (totalDrugAmount / totalVolume) : 0;
      doseRate = flowRate * concMgPerMl;
    } else if (unit === 'mcg/h') {
      const concMcgPerMl = totalVolume > 0 ? (totalDrugAmount / totalVolume) : 0;
      doseRate = flowRate * concMcgPerMl;
    } else {
      // ml/h
      doseRate = flowRate;
    }

    const rounded = Math.round(doseRate * 100) / 100;
    return {
      doseRate: rounded,
      unit,
      label: `${rounded} ${unit}`,
    };
  }, [currentKnowledge, totalDrugAmount, totalVolume, flowRate, patientWeight]);

  // Synthesize standard carrier dilution string
  const synthesizedCarrierString = useMemo(() => {
    if (isCustomCarrier && customCarrierText.trim()) {
      return customCarrierText.trim();
    }
    if (currentKnowledge.id === 'saline') {
      return `${totalVolume} mL IV Bag`;
    }
    if (currentKnowledge.id === 'propofol' && selectedCarrier === 'Neat') {
      return `${totalDrugAmount} mg in ${totalVolume} mL Neat (10 mg/mL)`;
    }
    const unitMeasure = currentKnowledge.unitMeasure;
    const conc = totalVolume > 0 ? Math.round((totalDrugAmount / totalVolume) * 100) / 100 : 0;
    return `${totalDrugAmount} ${unitMeasure} in ${totalVolume} mL ${selectedCarrier} (${conc} ${unitMeasure}/mL)`;
  }, [currentKnowledge, totalDrugAmount, totalVolume, selectedCarrier, isCustomCarrier, customCarrierText]);

  if (!isOpen) return null;

  // Flow rate fast adjustment handlers
  const handleAdjustFlowRate = (delta: number) => {
    const current = parseEnglishFloat(flowRateMlPerHour) || 0;
    const next = Math.max(0, Math.round((current + delta) * 10) / 10);
    setFlowRateMlPerHour(String(next));
  };

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
        solutionCarrier: synthesizedCarrierString,
        currentRate: backgroundDoseCalculation.doseRate,
        rateUnit: backgroundDoseCalculation.unit as any,
        flowRateMlPerHour: flowRate,
        status,
        clinicalTargetDescription: clinicalTargetDescription.trim(),
        remainingVolumeMl: totalVolume,
        totalVolumeMl: totalVolume,
      };

      // 1. Save to Dexie IndexedDB
      await db.infusionPumps.put(pumpRecord);

      // 2. Save to Firestore
      try {
        const pumpRef = doc(firestore, 'infusionPumps', pumpRecord.id);
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

    if (!canDeleteRecord(currentUser)) {
      alert(lang === 'ar' ? 'غير مصرح: حذف السجلات الطبية يتطلب صلاحيات إدارية خاصة.' : 'Unauthorized: Deleting medical records requires special administrative permissions.');
      return;
    }

    if (!window.confirm(lang === 'ar' ? `هل أنت متأكد من حذف مضخة المحلول لـ ${editingPump.drugNameAr || editingPump.drugNameEn}؟` : `Are you sure you want to remove the infusion pump for ${editingPump.drugNameEn}?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await db.infusionPumps.delete(editingPump.id);
      try {
        const pumpRef = doc(firestore, 'infusionPumps', editingPump.id);
        await deleteDoc(pumpRef);
      } catch (cloudErr) {
        console.warn('Firestore delete offline sync:', cloudErr);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="infusion-pump-input-modal w-full max-w-2xl bg-white dark:bg-[#091122] text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        dir={isRTL ? 'rtl' : 'ltr'}
        data-testid="infusion-pump-input-modal"
      >
        {/* Header - Streamlined, no subtitle or patient badges */}
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Droplet className="w-5 h-5" />
            </div>
            <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white">
              {editingPump 
                ? (lang === 'ar' ? `تعديل مضخة الحقن - سرير ${bedNumber}` : `Edit Infusion Pump - Bed ${bedNumber}`) 
                : (lang === 'ar' ? `إضافة مضخة / محلول وريدي جديد` : `Add New Infusion Pump Line`)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick ICU Drug Presets Toolbar (2 Compact Rows with '+ إضافة دواء' at the end) */}
        {!editingPump && (
          <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-100/90 dark:bg-[#060b17] border-b border-slate-200 dark:border-slate-800/80">
            {/* 2 Rows Grid for ICU Medications */}
            <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {ICU_DRUG_KNOWLEDGE.map((drug) => {
                const isSelected = selectedDrugId === drug.id;
                return (
                  <button
                    key={drug.id}
                    type="button"
                    onClick={() => applyDrugTemplate(drug)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-white dark:bg-amber-500/30 dark:text-amber-300 border-amber-500 dark:border-amber-500/60 shadow-sm ring-1 ring-amber-400/50'
                        : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-slate-800 hover:text-amber-700 dark:hover:text-white'
                    }`}
                  >
                    {lang === 'ar' ? drug.nameAr : drug.nameEn.split(' ')[0]}
                  </button>
                );
              })}

              {/* + إضافة دواء Button at the end of the grid */}
              <button
                type="button"
                onClick={handleSelectCustomDrug}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border flex items-center gap-1 transition-all cursor-pointer ${
                  selectedDrugId === 'custom'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-400/50'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? '+ إضافة دواء' : '+ Add Drug'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Medication Name - Hidden for presets, visible ONLY when choosing 'Add Custom Drug' or when editing */}
          {(selectedDrugId === 'custom' || editingPump) && (
            <div className="p-3 bg-amber-500/10 dark:bg-amber-950/25 border border-amber-400/40 dark:border-amber-500/40 rounded-xl space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  {lang === 'ar' ? 'اسم الدواء أو المحلول (Medication Name):' : 'Medication / Drug Name:'}
                </label>
                {!editingPump && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                    {lang === 'ar' ? 'إضافة دواء مخصص غير موجود بالقائمة' : 'Custom medication'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={drugNameEn}
                onChange={(e) => setDrugNameEn(e.target.value)}
                placeholder={lang === 'ar' ? 'اكتب اسم الدواء أو المحلول هنا...' : 'e.g. Noradrenaline, Propofol, Albumin...'}
                required
                autoFocus={selectedDrugId === 'custom'}
                className="w-full bg-white dark:bg-[#060b17] border border-amber-400 dark:border-amber-500/60 rounded-xl px-3.5 py-2 text-slate-900 dark:text-white font-mono text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-inner"
              />
            </div>
          )}

          {/* Row 1: "العدد" (Count) & "المحلول الحامل" (Carrier Solution) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-[#060d1d] p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            {/* Box 1: "العدد" */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <span>{lang === 'ar' ? 'العدد:' : 'Count / Units:'}</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold">
                    ({effectiveCount} × {currentKnowledge.unitAmount} {currentKnowledge.unitMeasure} = {totalDrugAmount} {currentKnowledge.unitMeasure})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCount(!isCustomCount)}
                  className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  {isCustomCount ? (lang === 'ar' ? 'قائمة 1-6' : 'Select 1-6') : (lang === 'ar' ? '+ تخصيص رقم' : '+ Custom')}
                </button>
              </div>

              {!isCustomCount ? (
                <select
                  value={countValue}
                  onChange={(e) => setCountValue(Number(e.target.value))}
                  className="w-full bg-white dark:bg-[#091122] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-white font-mono text-xs font-bold focus:border-amber-500 focus:outline-none"
                >
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <option key={num} value={num}>
                      {num} {lang === 'ar' ? (num === 1 ? 'أمبول / وحدة' : (num === 2 ? 'أمبولتان' : 'أمبولات / وحدات')) : 'Unit(s)'} - ({num * currentKnowledge.unitAmount} {currentKnowledge.unitMeasure})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customCountText}
                    onChange={(e) => setCustomCountText(toEnglishDigits(e.target.value))}
                    placeholder="Enter custom count..."
                    required
                    className="flex-1 bg-white dark:bg-[#091122] border border-amber-500/70 rounded-xl px-3 py-2 text-amber-700 dark:text-amber-300 font-mono text-xs font-bold focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono px-2 py-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-800">
                    {currentKnowledge.unitType}
                  </span>
                </div>
              )}
            </div>

            {/* Box 2: "المحلول الحامل" */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'ar' ? 'المحلول الحامل (Carrier Solution):' : 'Carrier Fluid:'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCarrier(!isCustomCarrier)}
                  className="text-[10px] text-cyan-700 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  {isCustomCarrier ? (lang === 'ar' ? 'قائمة المحاليل' : 'Standard list') : (lang === 'ar' ? 'تخصيص يدوي' : 'Custom text')}
                </button>
              </div>

              {!isCustomCarrier ? (
                <select
                  value={selectedCarrier}
                  onChange={(e) => setSelectedCarrier(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-[#091122] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-cyan-700 dark:text-cyan-300 font-mono text-xs font-bold focus:border-cyan-500 focus:outline-none"
                >
                  {currentKnowledge.compatibleCarriers.map(c => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                  <option value="D5NS">D5NS (Dextrose 5% in Normal Saline)</option>
                  <option value="RL">Ringer Lactate (RL)</option>
                  <option value="1/2 NS">1/2 NS (0.45% Saline)</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={customCarrierText}
                  onChange={(e) => setCustomCarrierText(e.target.value)}
                  placeholder="e.g. Sterile Water, D5 1/2NS..."
                  required
                  className="w-full bg-white dark:bg-[#091122] border border-cyan-500/70 rounded-xl px-3 py-2 text-cyan-700 dark:text-cyan-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Primary Control: التدفق الكلي (Flow Rate mL/h) - Enhanced for Day and Night modes */}
          <div className="p-3.5 sm:p-4 bg-amber-500/10 dark:bg-slate-900/90 border-2 border-amber-400/80 dark:border-amber-500/50 rounded-2xl shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{lang === 'ar' ? 'معدل التدفق الكلي (Flow Rate):' : 'Total Flow Rate:'}</span>
              </label>
              
              {/* Background Dose Rate calculated badge */}
              <div className="text-[11px] px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-mono flex items-center gap-1.5 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[10px]">{lang === 'ar' ? 'الجرعة المكافئة:' : 'Dose:'}</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">{backgroundDoseCalculation.label}</span>
              </div>
            </div>

            {/* Stepper & Clear Display Container */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleAdjustFlowRate(-1.0)}
                className="w-9 sm:w-11 h-11 rounded-xl bg-white hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                title="-1.0 mL/h"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => handleAdjustFlowRate(-0.1)}
                className="w-8 sm:w-9 h-11 rounded-xl bg-white hover:bg-amber-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                title="-0.1 mL/h"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* Centered Flow Rate Number & Unit Box */}
              <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#040813] border-2 border-amber-500 dark:border-amber-500/80 rounded-xl px-2 py-1 shadow-inner overflow-hidden">
                <input
                  type="text"
                  inputMode="decimal"
                  value={flowRateMlPerHour}
                  onChange={(e) => setFlowRateMlPerHour(toEnglishDigits(e.target.value))}
                  placeholder="0.0"
                  required
                  className="w-20 sm:w-28 text-center bg-transparent text-amber-700 dark:text-amber-300 font-mono font-black text-xl sm:text-2xl tracking-wider focus:outline-none"
                />
                <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-1 mr-1">
                  mL/h
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleAdjustFlowRate(+0.1)}
                className="w-8 sm:w-9 h-11 rounded-xl bg-white hover:bg-amber-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                title="+0.1 mL/h"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleAdjustFlowRate(+1.0)}
                className="w-9 sm:w-11 h-11 rounded-xl bg-white hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                title="+1.0 mL/h"
              >
                +1
              </button>
            </div>
          </div>

          {/* Row 2: الحجم الكلي (VTBI) & الهدف السريري (Titration Target) في نفس الصف */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* الحجم الكلي VTBI */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الحجم الكلي VTBI (mL):' : 'Total Volume VTBI (mL):'}
              </label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  inputMode="decimal"
                  value={totalVolumeMl}
                  onChange={(e) => setTotalVolumeMl(toEnglishDigits(e.target.value))}
                  placeholder="50"
                  required
                  className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono text-xs font-bold focus:border-amber-500 focus:outline-none"
                />
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  {[50, 100, 250, 500].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTotalVolumeMl(String(v))}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-all cursor-pointer ${
                        totalVolumeMl === String(v)
                          ? 'bg-amber-500 text-white dark:bg-amber-500/30 dark:text-amber-300 border-amber-500'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {v} mL
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* الهدف السريري للمعايرة */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'ar' ? 'الهدف السريري للمعايرة (Target):' : 'Titration Target / Goal:'}
              </label>
              <input
                type="text"
                value={clinicalTargetDescription}
                onChange={(e) => setClinicalTargetDescription(e.target.value)}
                placeholder="e.g. Target MAP ≥ 65 mmHg"
                className="w-full bg-white dark:bg-[#060b17] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-emerald-700 dark:text-emerald-300 text-xs focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1 truncate">
                {lang === 'ar' ? 'مثال: Target MAP ≥ 65 mmHg أو RASS: -2 to -3' : 'e.g. Target MAP ≥ 65 mmHg or RASS: -2'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-slate-200 dark:border-slate-800">
            {editingPump && canDeleteRecord(currentUser) ? (
              <button
                type="button"
                onClick={handleDeletePump}
                disabled={isSubmitting}
                className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                <span>{lang === 'ar' ? 'حذف المضخة' : 'Remove Line'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
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
