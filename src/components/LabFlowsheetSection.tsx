import React, { useState } from 'react';
import { 
  FlaskConical, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp,
  Activity,
  Droplet,
  Clock, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  Search,
  Filter,
  X,
  Camera,
  Sparkles,
  Sliders,
  Check,
  Trash2,
  Edit
} from 'lucide-react';
import { LabResultItem, StaffRole } from '../types/schema.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { db } from '../db/icuSyncDb.ts';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { firestore, setDoc } from '../services/firebase.ts';
import { COLLECTIONS } from '../types/contracts.ts';
import { AiLabScannerModal } from './AiLabScannerModal.tsx';
import { toEnglishDigits } from '../services/numberUtils.ts';

interface LabFlowsheetSectionProps {
  patientId: string;
  bedNumber: string;
  labResults: LabResultItem[];
  onLabAdded: () => void;
  onOpenCustomizePanels?: () => void;
  readOnly?: boolean;
}

const COMMON_LAB_PRESETS = [
  // CBC
  { name: 'Hb', category: 'CBC', unit: 'g/dL', normal: '12.0 - 16.0' },
  { name: 'HG', category: 'CBC', unit: 'g/dL', normal: '12.0 - 16.0' },
  { name: 'WBC', category: 'CBC', unit: 'x10^9/L', normal: '4.0 - 11.0' },
  { name: 'Platelets', category: 'CBC', unit: 'x10^9/L', normal: '150 - 450' },
  { name: 'Hematocrit (Hct)', category: 'CBC', unit: '%', normal: '36 - 48' },
  { name: 'Neutrophils', category: 'CBC', unit: '%', normal: '40 - 75' },
  { name: 'Lymphocytes', category: 'CBC', unit: '%', normal: '20 - 45' },
  { name: 'MCV', category: 'CBC', unit: 'fL', normal: '80 - 100' },

  // ABG
  { name: 'ABG - pH', category: 'ABG', unit: 'pH', normal: '7.35 - 7.45' },
  { name: 'ABG - pO2', category: 'ABG', unit: 'mmHg', normal: '80 - 100' },
  { name: 'ABG - pCO2', category: 'ABG', unit: 'mmHg', normal: '35 - 45' },
  { name: 'ABG - HCO3', category: 'ABG', unit: 'mmol/L', normal: '22 - 26' },
  { name: 'Lactate', category: 'ABG', unit: 'mmol/L', normal: '0.5 - 2.0' },
  { name: 'Base Excess (BE)', category: 'ABG', unit: 'mmol/L', normal: '-2.0 - +2.0' },
  { name: 'SaO2', category: 'ABG', unit: '%', normal: '95 - 100' },

  // INR & Coagulation
  { name: 'INR', category: 'Coagulation', unit: 'ratio', normal: '0.8 - 1.2' },
  { name: 'PT', category: 'Coagulation', unit: 'sec', normal: '11.0 - 13.5' },
  { name: 'PTT / aPTT', category: 'Coagulation', unit: 'sec', normal: '25 - 35' },
  { name: 'D-Dimer', category: 'Coagulation', unit: 'ug/mL', normal: '< 0.5' },
  { name: 'Fibrinogen', category: 'Coagulation', unit: 'mg/dL', normal: '200 - 400' },

  // Chemistry, Renal, Liver, Cardiac & Electrolytes
  // Renal (وظائف الكلى)
  { name: 'Creatinine', category: 'Biochemistry', unit: 'mg/dL', normal: '0.7 - 1.3' },
  { name: 'Urea', category: 'Biochemistry', unit: 'mg/dL', normal: '15 - 45' },
  { name: 'BUN', category: 'Biochemistry', unit: 'mg/dL', normal: '7 - 20' },
  { name: 'Uric Acid', category: 'Biochemistry', unit: 'mg/dL', normal: '3.5 - 7.2' },
  { name: 'eGFR', category: 'Biochemistry', unit: 'mL/min/1.73m2', normal: '> 90' },
  
  // Electrolytes (الأملاح والشوارد)
  { name: 'Sodium (Na)', category: 'Electrolytes', unit: 'mEq/L', normal: '135 - 145' },
  { name: 'Potassium (K)', category: 'Electrolytes', unit: 'mEq/L', normal: '3.5 - 5.0' },
  { name: 'Chloride (Cl)', category: 'Electrolytes', unit: 'mEq/L', normal: '98 - 106' },
  { name: 'Calcium (Ca)', category: 'Electrolytes', unit: 'mg/dL', normal: '8.5 - 10.5' },
  { name: 'Ionized Calcium', category: 'Electrolytes', unit: 'mmol/L', normal: '1.15 - 1.33' },
  { name: 'Magnesium (Mg)', category: 'Electrolytes', unit: 'mg/dL', normal: '1.7 - 2.2' },
  { name: 'Phosphorus (PO4)', category: 'Electrolytes', unit: 'mg/dL', normal: '2.5 - 4.5' },

  // Liver (وظائف الكبد)
  { name: 'ALT (SGPT)', category: 'Biochemistry', unit: 'U/L', normal: '7 - 56' },
  { name: 'AST (SGOT)', category: 'Biochemistry', unit: 'U/L', normal: '10 - 40' },
  { name: 'Total Bilirubin', category: 'Biochemistry', unit: 'mg/dL', normal: '0.2 - 1.2' },
  { name: 'Direct Bilirubin', category: 'Biochemistry', unit: 'mg/dL', normal: '0.0 - 0.3' },
  { name: 'Albumin', category: 'Biochemistry', unit: 'g/dL', normal: '3.5 - 5.0' },
  { name: 'Total Protein', category: 'Biochemistry', unit: 'g/dL', normal: '6.4 - 8.3' },
  { name: 'ALP (Alkaline Phosphatase)', category: 'Biochemistry', unit: 'U/L', normal: '44 - 147' },
  { name: 'GGT', category: 'Biochemistry', unit: 'U/L', normal: '9 - 48' },

  // Cardiac (وظائف وإنزيمات القلب)
  { name: 'Troponin I (hs-cTnI)', category: 'Biochemistry', unit: 'ng/mL', normal: '< 0.04' },
  { name: 'Troponin T (hs-cTnT)', category: 'Biochemistry', unit: 'ng/L', normal: '< 14' },
  { name: 'CK-MB', category: 'Biochemistry', unit: 'ng/mL', normal: '< 5.0' },
  { name: 'Total CK (CPK)', category: 'Biochemistry', unit: 'U/L', normal: '30 - 200' },
  { name: 'BNP / NT-proBNP', category: 'Biochemistry', unit: 'pg/mL', normal: '< 100' },
  { name: 'Myoglobin', category: 'Biochemistry', unit: 'ng/mL', normal: '25 - 72' },

  // Inflammatory, Metabolic & Pancreatic
  { name: 'CRP', category: 'Biochemistry', unit: 'mg/L', normal: '< 5.0' },
  { name: 'Procalcitonin (PCT)', category: 'Biochemistry', unit: 'ng/mL', normal: '< 0.5' },
  { name: 'Glucose (RBS / FBS)', category: 'Biochemistry', unit: 'mg/dL', normal: '70 - 140' },
  { name: 'HbA1c', category: 'Biochemistry', unit: '%', normal: '< 5.7' },
  { name: 'Amylase', category: 'Biochemistry', unit: 'U/L', normal: '28 - 100' },
  { name: 'Lipase', category: 'Biochemistry', unit: 'U/L', normal: '10 - 140' },
  { name: 'LDH (Lactate Dehydrogenase)', category: 'Biochemistry', unit: 'U/L', normal: '140 - 280' },
  { name: 'Ferritin', category: 'Biochemistry', unit: 'ng/mL', normal: '20 - 250' },
  { name: 'ESR', category: 'Biochemistry', unit: 'mm/hr', normal: '< 20' },
];

const formatNumericDate = (dateVal?: string | Date | number): string => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

export const getCategoryForTest = (testName: string, items: LabResultItem[] = []): 'ABG' | 'CBC' | 'Chemistry' | 'INR' | 'Other' => {
  const norm = (testName || '').toLowerCase().trim();
  const cat = (items[0]?.category || '').toLowerCase().trim();

  // 1. ABG (غازات الدم الشرياني)
  if (
    cat === 'abg' || cat.includes('blood gas') || cat.includes('arterial') ||
    norm.startsWith('abg') ||
    norm === 'ph' || norm.startsWith('ph ') || norm.includes(' ph') || norm.includes('ph(') ||
    norm === 'pco2' || norm.includes('pco2') ||
    norm === 'po2' || norm === 'pao2' || norm.includes('po2') ||
    norm === 'hco3' || norm.includes('hco3') || norm.includes('bicarbonate') ||
    norm.includes('base excess') || norm === 'be' || norm.includes(' be') ||
    norm === 'cthb' || norm.includes('p/f') || norm.includes('pao2/fio2') ||
    norm.includes('lactate (abg)') || norm.includes('abg - lactate') ||
    norm === 'so2' || norm === 'sao2' || norm.includes('o2 sat')
  ) {
    return 'ABG';
  }

  // 2. CBC (صورة الدم الكاملة)
  if (
    cat === 'cbc' || cat.includes('hematology') || cat.includes('blood count') ||
    norm.startsWith('cbc') ||
    norm === 'wbc' || norm.includes('wbc') || norm.includes('white blood') || norm.includes('leukocyte') || norm === 'tlc' ||
    norm === 'hb' || norm === 'hg' || norm === 'hgb' || norm.includes('hemoglobin') ||
    norm === 'hct' || norm.includes('hematocrit') || norm === 'pcv' ||
    norm === 'plt' || norm.includes('platelet') || norm.includes('thrombocyte') ||
    norm.includes('neutrophil') || norm.includes('lymphocyte') ||
    norm.includes('monocyte') || norm.includes('eosinophil') ||
    norm.includes('basophil') || norm.includes('mcv') || norm.includes('mch') || norm.includes('mchc') ||
    norm.includes('rdw') || norm.includes('mpv') || norm === 'rbc' || norm.includes('red blood') ||
    norm.includes('reticulocyte') || norm.includes('anemia')
  ) {
    return 'CBC';
  }

  // 3. INR & Coagulation (السيولة وتخثر الدم)
  if (
    cat === 'coagulation' || cat === 'inr' || cat.includes('hemostasis') || cat.includes('clotting') ||
    norm === 'inr' || norm.includes('inr') ||
    norm === 'pt' || norm.includes('prothrombin') ||
    norm === 'ptt' || norm === 'aptt' || norm.includes('thromboplastin') ||
    norm.includes('fibrinogen') || norm === 'fib' ||
    norm.includes('d-dimer') || norm.includes('ddimer') ||
    norm.includes('act') || norm.includes('anti-xa') || norm.includes('thrombin time')
  ) {
    return 'INR';
  }

  // 4. Chemistry / Biochemistry, Electrolytes, Renal, Liver & Cardiac (كيمياء الدم والأملاح ووظائف الكبد والكلى والقلب)
  if (
    cat === 'biochemistry' || cat === 'electrolytes' || cat === 'chemistry' || 
    cat.includes('renal') || cat.includes('kidney') || 
    cat.includes('liver') || cat.includes('hepatic') || 
    cat.includes('cardiac') || cat.includes('heart') || cat.includes('enzymes') ||
    cat.includes('metabolic') || cat.includes('endocrine') || cat.includes('lipid') || cat.includes('inflammatory') ||
    // Renal Function (وظائف الكلى)
    norm.includes('creat') || norm.includes('urea') || norm.includes('bun') || norm.includes('uric') || norm.includes('gfr') || norm.includes('cystatin') || norm.includes('rft') || norm.includes('kft') ||
    // Electrolytes & Minerals (الأملاح والمعادن)
    norm.includes('sodium') || norm === 'na' || norm.startsWith('na ') || norm.includes('(na)') || norm.includes(' na') ||
    norm.includes('potassium') || norm === 'k' || norm.startsWith('k ') || norm.includes('(k)') || norm.includes(' k') ||
    norm.includes('chloride') || norm === 'cl' || norm.includes('(cl)') ||
    norm.includes('calcium') || norm === 'ca' || norm.includes('(ca)') || norm.includes('corrected ca') || norm.includes('ionized ca') ||
    norm.includes('magnesium') || norm === 'mg' || norm.includes('(mg)') ||
    norm.includes('phosphorus') || norm.includes('phosphate') || norm === 'po4' || norm.includes('(po4)') ||
    norm.includes('osmolality') || norm.includes('anion gap') ||
    // Liver Function (وظائف الكبد)
    norm.includes('alt') || norm.includes('sgpt') || norm.includes('ast') || norm.includes('sgot') ||
    norm.includes('bilirubin') || norm.includes('bili') || norm.includes('albumin') || norm === 'alb' ||
    norm.includes('total protein') || norm.includes('globulin') || norm.includes('alp') || norm.includes('alkaline phosphatase') ||
    norm.includes('ggt') || norm.includes('ammonia') || norm === 'nh3' || norm.includes('lft') ||
    // Cardiac Markers & Enzymes (وظائف وإنزيمات القلب)
    norm.includes('troponin') || norm.includes('trop') || norm.includes('ctn') ||
    norm.includes('ck') || norm.includes('cpk') || norm.includes('ck-mb') || norm.includes('ckmb') ||
    norm.includes('bnp') || norm.includes('probnp') || norm.includes('myoglobin') ||
    // Inflammatory, Metabolic, Pancreatic, Lipids & Endocrine
    norm.includes('crp') || norm.includes('procalcitonin') || norm === 'pct' || norm.includes('ferritin') || norm.includes('esr') ||
    norm.includes('glucose') || norm.includes('rbs') || norm.includes('fbs') || norm.includes('sugar') || norm.includes('hba1c') ||
    norm.includes('amylase') || norm.includes('lipase') || norm.includes('ldh') || norm.includes('lactate') ||
    norm.includes('cholesterol') || norm.includes('triglyceride') || norm.includes('hdl') || norm.includes('ldl') ||
    norm.includes('tsh') || norm.includes('ft3') || norm.includes('ft4') || norm.includes('cortisol') ||
    norm.includes('vitamin') || norm.includes('iron') || norm.includes('tibc')
  ) {
    return 'Chemistry';
  }

  // 5. Other Tests & Cultures (تحاليل ومزارع أخرى: مزارع الدم، البول، البلغم، السوائل، والفحوصات الخاصة)
  return 'Other';
};

export const LabFlowsheetSection: React.FC<LabFlowsheetSectionProps> = ({
  patientId,
  bedNumber,
  labResults,
  onLabAdded,
  onOpenCustomizePanels,
  readOnly = false,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();

  const dynamicPresets = React.useMemo(() => {
    if (settings.labCategories && settings.labCategories.length > 0) {
      const list: Array<{ name: string; category: string; unit: string; normal: string }> = [];
      settings.labCategories.forEach((cat: any) => {
        cat.parameters?.forEach((p: any) => {
          list.push({
            name: p.name,
            category: cat.nameEn || cat.id,
            unit: p.unit || '',
            normal: p.normalRange || '--'
          });
        });
      });
      return list;
    }
    return [
      { name: 'HG', category: 'CBC', unit: 'g/dL', normal: '12.0 - 16.0' },
      { name: 'Hb', category: 'CBC', unit: 'g/dL', normal: '12.0 - 16.0' },
      { name: 'WBC', category: 'CBC', unit: 'x10^9/L', normal: '4.0 - 11.0' },
      { name: 'Platelets', category: 'CBC', unit: 'x10^9/L', normal: '150 - 450' },
      { name: 'Creatinine', category: 'Biochemistry', unit: 'mg/dL', normal: '0.7 - 1.3' },
      { name: 'Urea', category: 'Biochemistry', unit: 'mg/dL', normal: '15 - 45' },
      { name: 'Sodium (Na)', category: 'Electrolytes', unit: 'mEq/L', normal: '135 - 145' },
      { name: 'Potassium (K)', category: 'Electrolytes', unit: 'mEq/L', normal: '3.5 - 5.0' },
      { name: 'ABG - pH', category: 'ABG', unit: 'pH', normal: '7.35 - 7.45' },
      { name: 'ABG - pO2', category: 'ABG', unit: 'mmHg', normal: '80 - 100' },
      { name: 'ABG - pCO2', category: 'ABG', unit: 'mmHg', normal: '35 - 45' },
      { name: 'ABG - HCO3', category: 'ABG', unit: 'mmol/L', normal: '22 - 26' },
      { name: 'Lactate', category: 'Biochemistry', unit: 'mmol/L', normal: '0.5 - 2.0' },
      { name: 'CRP', category: 'Biochemistry', unit: 'mg/L', normal: '< 5.0' },
      { name: 'INR', category: 'Coagulation', unit: 'ratio', normal: '0.8 - 1.2' },
      { name: 'PT', category: 'Coagulation', unit: 'sec', normal: '11.0 - 13.5' },
      { name: 'PTT', category: 'Coagulation', unit: 'sec', normal: '25 - 35' },
    ];
  }, [settings.labCategories]);

  const availablePresetCategories = React.useMemo(() => {
    const set = new Set<string>();
    dynamicPresets.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [dynamicPresets]);

  const [selectedTestName, setSelectedTestName] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPresetCat, setSelectedPresetCat] = useState<string>('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [isAiScannerOpen, setIsAiScannerOpen] = useState(false);
  const [aiPreset, setAiPreset] = useState<'ABG' | 'CBC' | 'ALL'>('ALL');

  // Form State
  const [formTestName, setFormTestName] = useState('Hb');
  const [formCustomName, setFormCustomName] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formUnit, setFormUnit] = useState('g/dL');
  const [formNormalRange, setFormNormalRange] = useState('12.0 - 16.0');
  const [formCategory, setFormCategory] = useState('CBC');
  const [formStatus, setFormStatus] = useState<'ORDERED' | 'RESULTED'>('RESULTED');
  const [formNotes, setFormNotes] = useState('');
  const [formTimestamp, setFormTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [isSaving, setIsSaving] = useState(false);
  const [quickAddTest, setQuickAddTest] = useState<string | null>(null);
  const [quickAddValue, setQuickAddValue] = useState<string>('');

  // Collapsible category cards in main flowsheet (collapsed by default)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    ABG: true,
    CBC: true,
    Chemistry: true,
    INR: true,
    Other: true,
  });

  const toggleSection = (sec: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sec]: !prev[sec]
    }));
  };

  const collapseAllSections = () => {
    setCollapsedSections({
      ABG: true,
      CBC: true,
      Chemistry: true,
      INR: true,
      Other: true,
    });
  };

  const expandAllSections = () => {
    setCollapsedSections({
      ABG: false,
      CBC: false,
      Chemistry: false,
      INR: false,
      Other: false,
    });
  };

  // Delete & Edit states
  const [deleteConfirmTest, setDeleteConfirmTest] = useState<string | null>(null);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [editingNotes, setEditingNotes] = useState<string>('');

  // Group all results for this patient by testName
  const patientLabs = (labResults || []).filter(l => l && l.patientId === patientId);

  const groupedLabs = React.useMemo(() => {
    const map = new Map<string, LabResultItem[]>();

    patientLabs.forEach(item => {
      if (!item || !item.testName) return;
      const key = item.testName.trim();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    // Sort items chronologically inside each group (earliest to latest for trend)
    map.forEach((items) => {
      items.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
    });

    return map;
  }, [patientLabs]);

  // Open add modal with preset
  const handleOpenAddForTest = (presetName: string) => {
    const preset = dynamicPresets.find(p => p.name === presetName);
    if (preset) {
      setFormTestName(preset.name);
      setFormCustomName('');
      setFormUnit(preset.unit);
      setFormNormalRange(preset.normal);
      setFormCategory(preset.category);
    } else {
      setFormTestName('custom');
      setFormCustomName(presetName);
      setFormUnit('');
      setFormNormalRange('');
      setFormCategory('Other');
    }
    setFormValue('');
    setFormNotes('');
    setFormStatus('RESULTED');
    setFormTimestamp(new Date().toISOString().slice(0, 16));
    setIsAddModalOpen(true);
  };

  const handlePresetSelect = (presetName: string) => {
    setFormTestName(presetName);
    if (presetName === 'custom') {
      setFormCustomName('');
      setFormUnit('');
      setFormNormalRange('');
      setFormCategory('Other');
    } else {
      const p = dynamicPresets.find(x => x.name === presetName);
      if (p) {
        setFormCustomName('');
        setFormUnit(p.unit);
        setFormNormalRange(p.normal);
        setFormCategory(p.category);
      }
    }
  };

  const handleSaveLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formStatus === 'RESULTED' && !formValue.trim()) return;

    setIsSaving(true);
    try {
      const finalName = formTestName === 'custom' ? formCustomName.trim() : formTestName;
      if (!finalName) return;

      const userDisplay = currentUser?.nameAr || currentUser?.nameEn || 'الطبيب المناوب';
      const labId = `lab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const newRecord: LabResultItem = {
        id: labId,
        patientId,
        bedNumber,
        testName: finalName,
        category: formCategory,
        value: formStatus === 'ORDERED' ? '' : toEnglishDigits(formValue.trim()),
        unit: formUnit.trim(),
        normalRange: toEnglishDigits(formNormalRange.trim()),
        timestamp: new Date(formTimestamp).toISOString(),
        status: formStatus,
        notes: formNotes.trim() || undefined,
        recordedByName: userDisplay,
        recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
      };

      // 1. Write to local Dexie table
      await db.labResults.put(newRecord);

      // 2. Write to Firestore SSOT
      try {
        const docRef = doc(firestore, 'medical_records', labId);
        await setDoc(docRef, {
          ...newRecord,
          recordType: 'LAB',
          createdAt: Date.now(),
        });
      } catch (cloudErr) {
        console.warn('Firestore lab record sync:', cloudErr);
      }

      onLabAdded();
      setIsAddModalOpen(false);
      setFormValue('');
      setFormNotes('');
    } catch (err) {
      console.error('Error saving lab result:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickSubmit = async (testName: string, latestItem?: LabResultItem) => {
    if (!quickAddValue.trim()) return;
    setIsSaving(true);
    try {
      const userDisplay = currentUser?.nameAr || currentUser?.nameEn || 'الطبيب المناوب';
      const labId = `lab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const preset = dynamicPresets.find(p => (p?.name || '').toLowerCase() === (testName || '').toLowerCase());

      const newRecord: LabResultItem = {
        id: labId,
        patientId,
        bedNumber,
        testName,
        category: latestItem?.category || preset?.category || 'Other',
        value: toEnglishDigits(quickAddValue.trim()),
        unit: latestItem?.unit || preset?.unit || '',
        normalRange: latestItem?.normalRange || preset?.normal || '',
        timestamp: new Date().toISOString(),
        status: 'RESULTED',
        recordedByName: userDisplay,
        recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
      };

      await db.labResults.put(newRecord);

      try {
        const docRef = doc(firestore, 'medical_records', labId);
        await setDoc(docRef, {
          ...newRecord,
          recordType: 'LAB',
          createdAt: Date.now(),
        });
      } catch (cloudErr) {
        console.warn('Firestore lab quick sync:', cloudErr);
      }

      onLabAdded();
      setQuickAddTest(null);
      setQuickAddValue('');
    } catch (err) {
      console.error('Error quick saving lab:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const triggerDeleteLabType = (testName: string) => {
    const items = groupedLabs.get(testName) || [];
    const distinctDoctors = new Set(
      items
        .map(it => it.recordedByStaffId || it.recordedByName)
        .filter(Boolean)
    );
    const hasMultipleDoctors = distinctDoctors.size > 1;
    const canDelete = !hasMultipleDoctors || 
                      currentUser?.role === StaffRole.ADMIN || 
                      currentUser?.isSuperAdmin || 
                      currentUser?.role === StaffRole.CONSULTANT;

    if (!canDelete) {
      setDeleteErrorMsg(lang === 'ar' 
        ? 'عذراً، هذا التحليل يحتوي على قراءات مسجلة بواسطة أكثر من طبيب. لا يسمح بحذفه إلا لمدير النظام (Admin) أو الطبيب الاستشاري (Consultant).' 
        : 'Sorry, this lab contains readings recorded by multiple doctors. Only Admin or Consultant can delete it.'
      );
      return;
    }

    setDeleteConfirmTest(testName);
  };

  const executeDeleteLabType = async () => {
    if (!deleteConfirmTest) return;
    setIsSaving(true);
    try {
      const items = groupedLabs.get(deleteConfirmTest) || [];
      for (const item of items) {
        await db.labResults.delete(item.id);
        try {
          const docRef = doc(firestore, 'medical_records', item.id);
          await deleteDoc(docRef);
        } catch (cloudErr) {
          console.warn('Firestore deletion sync failed:', cloudErr);
        }
      }

      onLabAdded();
      setDeleteConfirmTest(null);
      if (selectedTestName === deleteConfirmTest) {
        setSelectedTestName(null);
      }
    } catch (err) {
      console.error('Error executing delete lab type:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const triggerEditRecord = (rec: LabResultItem) => {
    const isOwner = rec.recordedByStaffId === currentUser?.badgeId || rec.recordedByStaffId === currentUser?.uid;
    if (!isOwner) {
      setDeleteErrorMsg(lang === 'ar'
        ? 'عذراً، لا يمكنك تعديل هذا التحليل. يسمح لكل طبيب فقط بتعديل القراءات التي قام بإدخالها بنفسه.'
        : 'Sorry, you cannot edit this lab. Each doctor is only allowed to edit readings they entered themselves.'
      );
      return;
    }
    setEditingRecordId(rec.id);
    setEditingValue(rec.value);
    setEditingNotes(rec.notes || '');
  };

  const executeEditRecord = async (rec: LabResultItem) => {
    if (!editingValue.trim()) return;
    setIsSaving(true);
    try {
      const updatedRecord: LabResultItem = {
        ...rec,
        value: toEnglishDigits(editingValue.trim()),
        notes: rec.notes || undefined,
      };

      await db.labResults.put(updatedRecord);

      try {
        const docRef = doc(firestore, 'medical_records', rec.id);
        await setDoc(docRef, {
          ...updatedRecord,
          recordType: 'LAB',
          updatedAt: Date.now(),
        }, { merge: true });
      } catch (cloudErr) {
        console.warn('Firestore update sync failed:', cloudErr);
      }

      onLabAdded();
      setEditingRecordId(null);
    } catch (err) {
      console.error('Error saving edited lab record:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const testKeys = (Array.from(groupedLabs.keys()) as string[]).filter((key: string) => 
    Boolean(key) && key.toLowerCase().includes((filterQuery || '').toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header bar: Compact with Add Button placed right next to title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5 whitespace-nowrap">
              <span>{lang === 'ar' ? 'سجل التحاليل' : 'Lab Records'}</span>
              <span className="text-[10px] font-mono font-normal px-1.5 py-0.5 rounded bg-slate-800 text-teal-300">
                {patientLabs.length} {lang === 'ar' ? 'تسجيل' : 'entries'}
              </span>
            </h3>

            {/* زر إضافة تحليل جديد بجوار سجل التحاليل لتقليل المساحة الرأسية */}
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  setFormTestName('Hb');
                  handlePresetSelect('Hb');
                  setFormValue('');
                  setFormNotes('');
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة تحليل جديد' : 'Add Lab'}</span>
              </button>
            )}
          </div>
        </div>

        {settings.features.enableAiLabScanner && !readOnly && (
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => {
                setAiPreset('ALL');
                setIsAiScannerOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تصوير تحليل' : 'AI Lab Scan'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAiPreset('ABG');
                setIsAiScannerOpen(true);
              }}
              className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs transition-all border border-emerald-500/30 cursor-pointer shrink-0"
            >
              🫁 {lang === 'ar' ? 'غازات ABG' : 'ABG'}
            </button>

            <button
              type="button"
              onClick={() => {
                setAiPreset('CBC');
                setIsAiScannerOpen(true);
              }}
              className="px-2 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 font-bold text-xs transition-all border border-teal-500/30 cursor-pointer shrink-0"
            >
              🩸 {lang === 'ar' ? 'صورة دم CBC' : 'CBC'}
            </button>

            <button
              type="button"
              onClick={() => {
                setAiPreset('CHEMISTRY');
                setIsAiScannerOpen(true);
              }}
              className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-bold text-xs transition-all border border-cyan-500/30 cursor-pointer shrink-0"
            >
              🧪 {lang === 'ar' ? 'كيمياء' : 'Chem'}
            </button>
          </div>
        )}
      </div>

      {/* Quick search filter if there are many tests */}
      {groupedLabs.size > 4 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث في التحاليل المسجلة (مثل Hb, Creatinine)...' : 'Filter lab tests (e.g., Hb, Creatinine)...'}
            className="w-full px-9 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-500 shadow-sm"
          />
        </div>
      )}

      {/* Categorized Collapsible Lab Flowsheet View */}
      {testKeys.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <FlaskConical className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {lang === "ar" 
              ? "لم يتم تسجيل أي تحاليل لهذا المريض حتى الآن. اضغط على \"إضافة تحليل جديد\" للبدء." 
              : "No laboratory tests recorded yet. Click \"Add Lab Result\" to start."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {dynamicPresets.slice(0, 8).map(p => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleOpenAddForTest(p.name)}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Categories Quick Controls: Expand / Collapse All */}
          <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span>{lang === "ar" ? "أقسام التحاليل المصنفة:" : "Categorized Lab Panels:"}</span>
              <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">{testKeys.length}</span>
              <span>{lang === "ar" ? "تحليل مسجل" : "active tests"}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={expandAllSections}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shadow-sm"
                title={lang === "ar" ? "فتح وتوسيع كافة الأقسام" : "Expand all panels"}
              >
                <ChevronDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{lang === "ar" ? "فتح الكل" : "Expand All"}</span>
              </button>

              <button
                type="button"
                onClick={collapseAllSections}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shadow-sm"
                title={lang === "ar" ? "طي وإخفاء تفاصيل كافة الأقسام" : "Collapse all panels"}
              >
                <ChevronUp className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>{lang === "ar" ? "طي الكل" : "Collapse All"}</span>
              </button>
            </div>
          </div>

          {/* Render Categories */}
          {([
            {
              id: "ABG" as const,
              nameAr: "غازات الدم الشرياني (ABG)",
              nameEn: "Arterial Blood Gas (ABG)",
              icon: Activity,
              headerBg: "bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60",
              border: "border-emerald-300 dark:border-emerald-500/40",
              accentText: "text-emerald-900 dark:text-emerald-300",
              subText: "text-emerald-800/80 dark:text-slate-400",
              badgeBg: "bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
              iconBg: "bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-300",
            },
            {
              id: "CBC" as const,
              nameAr: "صورة الدم الكاملة (CBC)",
              nameEn: "Complete Blood Count (CBC)",
              icon: Droplet,
              headerBg: "bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:hover:bg-rose-950/60",
              border: "border-rose-300 dark:border-rose-500/40",
              accentText: "text-rose-900 dark:text-rose-300",
              subText: "text-rose-800/80 dark:text-slate-400",
              badgeBg: "bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
              iconBg: "bg-rose-600 text-white dark:bg-rose-500/20 dark:text-rose-300",
            },
            {
              id: "Chemistry" as const,
              nameAr: "كيمياء الدم والأملاح ووظائف الكبد والكلى والقلب (Chemistry, Renal, Liver & Cardiac)",
              nameEn: "Chemistry, Electrolytes, Renal, Liver & Cardiac",
              icon: FlaskConical,
              headerBg: "bg-cyan-50 hover:bg-cyan-100/80 dark:bg-cyan-950/40 dark:hover:bg-cyan-950/60",
              border: "border-cyan-300 dark:border-cyan-500/40",
              accentText: "text-cyan-950 dark:text-cyan-300",
              subText: "text-cyan-800/80 dark:text-slate-400",
              badgeBg: "bg-cyan-100 text-cyan-950 border border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30",
              iconBg: "bg-cyan-600 text-white dark:bg-cyan-500/20 dark:text-cyan-300",
            },
            {
              id: "INR" as const,
              nameAr: "السيولة وتخثر الدم (INR & Coagulation)",
              nameEn: "Coagulation Profile (INR / PT / PTT)",
              icon: Sparkles,
              headerBg: "bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-950/60",
              border: "border-amber-300 dark:border-amber-500/40",
              accentText: "text-amber-950 dark:text-amber-300",
              subText: "text-amber-800/80 dark:text-slate-400",
              badgeBg: "bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
              iconBg: "bg-amber-600 text-white dark:bg-amber-500/20 dark:text-amber-300",
            },
            {
              id: "Other" as const,
              nameAr: "تحاليل ومزارع أخرى (Other Tests & Cultures)",
              nameEn: "Other Tests & Cultures",
              icon: FileText,
              headerBg: "bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900/50 dark:hover:bg-slate-900/70",
              border: "border-slate-300 dark:border-slate-700/60",
              accentText: "text-slate-900 dark:text-slate-300",
              subText: "text-slate-700 dark:text-slate-400",
              badgeBg: "bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/50",
              iconBg: "bg-slate-700 text-white dark:bg-slate-800 dark:text-slate-300",
            },
          ]).map((cat) => {
            const categoryTestKeys = testKeys.filter(tKey => {
              const items = groupedLabs.get(tKey) || [];
              return getCategoryForTest(tKey, items) === cat.id;
            });

            if (categoryTestKeys.length === 0) return null;

            const isCollapsed = Boolean(collapsedSections[cat.id]);
            const Icon = cat.icon;

            return (
              <div 
                key={cat.id} 
                className={"rounded-2xl border transition-all duration-200 overflow-hidden " + cat.border + " bg-white dark:bg-[#070c18]/90 shadow-sm"}
              >
                {/* Collapsible Card Header */}
                <div
                  onClick={() => toggleSection(cat.id)}
                  className={"p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors select-none " + cat.headerBg}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={"w-8 h-8 rounded-xl flex items-center justify-center font-bold " + cat.iconBg}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={"text-xs sm:text-sm font-bold " + cat.accentText}>
                          {lang === "ar" ? cat.nameAr : cat.nameEn}
                        </h4>
                        <span className={"text-[10px] font-mono font-bold px-2 py-0.5 rounded-full " + cat.badgeBg}>
                          {categoryTestKeys.length} {lang === "ar" ? "تحليل" : "tests"}
                        </span>
                      </div>
                      <p className={"text-[11px] truncate max-w-md mt-0.5 font-mono " + cat.subText}>
                        {categoryTestKeys.join(" • ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 hidden sm:inline font-mono">
                      {isCollapsed ? (lang === "ar" ? "انقر للفتح" : "Click to expand") : (lang === "ar" ? "انقر للطي" : "Click to collapse")}
                    </span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-transparent flex items-center justify-center transition-colors shadow-sm"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Collapsible Body (Trend Cards Grid) */}
                {!isCollapsed && (
                  <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {categoryTestKeys.map((testName) => {
                        const items = groupedLabs.get(testName) || [];
                        const latest = items[items.length - 1];
                        const previous = items.length > 1 ? items[items.length - 2] : null;

                        // Trend calculation
                        const latestNum = parseFloat(latest.value);
                        const prevNum = previous ? parseFloat(previous.value) : null;
                        let trend: "UP" | "DOWN" | "EQUAL" | "NONE" = "NONE";
                        if (!isNaN(latestNum) && prevNum !== null && !isNaN(prevNum)) {
                          if (latestNum > prevNum) trend = "UP";
                          else if (latestNum < prevNum) trend = "DOWN";
                          else trend = "EQUAL";
                        }

                        // Progression chain: e.g. "5 > 7 > 8.5 > 8"
                        const trendChain = items.map(it => it.value);

                        return (
                          <div
                            key={testName}
                            onClick={() => setSelectedTestName(testName)}
                            className="group p-3.5 rounded-xl bg-white dark:bg-[#0d1527] hover:bg-slate-50 dark:hover:bg-[#111c34] border border-slate-200 dark:border-slate-800 hover:border-teal-500/60 dark:hover:border-teal-500/60 transition-all cursor-pointer shadow-sm flex flex-col justify-between"
                          >
                            <div>
                              {/* Top Bar: Name, Unit, and Total Count + Green Quick Add "+" Button */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* زر "+" باللون الأخضر لإضافة التحليل بسرعة */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (quickAddTest === testName) {
                                        setQuickAddTest(null);
                                        setQuickAddValue("");
                                      } else {
                                        setQuickAddTest(testName);
                                        setQuickAddValue("");
                                      }
                                    }}
                                    className="w-6 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 flex items-center justify-center font-bold shadow-sm transition-all cursor-pointer shrink-0"
                                    title={lang === "ar" ? `إضافة سريعة لقراءة ${testName}` : `Quick add ${testName}`}
                                  >
                                    <Plus className="w-4 h-4 stroke-[3]" />
                                  </button>

                                  <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-300 transition-colors font-mono">
                                    {testName}
                                  </span>
                                  {latest.unit && (
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                      ({latest.unit})
                                    </span>
                                  )}
                                  {latest.category && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-mono">
                                      {latest.category}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    {items.length} {lang === "ar" ? "قراءات" : "readings"}
                                  </span>
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                                </div>
                              </div>

                              {/* Inline Quick Add Input Box */}
                              {quickAddTest === testName && (
                                <div 
                                  onClick={(e) => e.stopPropagation()} 
                                  className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-500/60 mb-2.5 shadow-sm animate-in fade-in zoom-in-95 duration-150"
                                >
                                  <span className="text-[11px] text-emerald-900 dark:text-emerald-300 font-bold whitespace-nowrap">
                                    {lang === "ar" ? "قيمة جديدة:" : "New Value:"}
                                  </span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    autoFocus
                                    placeholder={latest.unit ? `e.g. 1.8 (${latest.unit})` : "e.g. 1.8"}
                                    value={quickAddValue}
                                    onChange={(e) => setQuickAddValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleQuickSubmit(testName, latest);
                                      } else if (e.key === "Escape") {
                                        setQuickAddTest(null);
                                        setQuickAddValue("");
                                      }
                                    }}
                                    className="flex-1 bg-white dark:bg-[#070c18] border border-emerald-400 dark:border-emerald-500/50 rounded px-2 py-1 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleQuickSubmit(testName, latest)}
                                    disabled={isSaving || !quickAddValue.trim()}
                                    className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                                    title={lang === "ar" ? "حفظ فوري" : "Save instantly"}
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>{lang === "ar" ? "حفظ" : "Save"}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickAddTest(null);
                                      setQuickAddValue("");
                                    }}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* Flow progression: e.g. "5 > 7 > 8.5 > 8" */}
                              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 mb-2.5 overflow-x-auto">
                                <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                                  {trendChain.map((val, idx) => {
                                    const isLast = idx === trendChain.length - 1;
                                    return (
                                      <React.Fragment key={idx}>
                                        <span className={`px-2 py-0.5 rounded ${
                                          isLast 
                                            ? "bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 shadow-sm" 
                                            : "text-slate-500 dark:text-slate-400"
                                        }`}>
                                          {val || (lang === "ar" ? "معلق" : "Pending")}
                                        </span>
                                        {!isLast && (
                                          <span className="text-slate-400 dark:text-slate-600 font-bold select-none">&gt;</span>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Footer details: Only Trend indicator and date/time */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-800/50">
                              <div className="flex items-center gap-1.5 font-mono">
                                {trend === "UP" && (
                                  <span className="text-amber-800 dark:text-amber-400 flex items-center gap-1 text-[10px] font-bold bg-amber-100 dark:bg-amber-500/10 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-500/30">
                                    <TrendingUp className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    <span>{lang === "ar" ? "مؤشر تصاعدي" : "Rising trend"}</span>
                                  </span>
                                )}
                                {trend === "DOWN" && (
                                  <span className="text-blue-800 dark:text-blue-400 flex items-center gap-1 text-[10px] font-bold bg-blue-100 dark:bg-blue-500/10 px-2 py-0.5 rounded border border-blue-300 dark:border-blue-500/30">
                                    <TrendingDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                    <span>{lang === "ar" ? "مؤشر تنازلي" : "Declining trend"}</span>
                                  </span>
                                )}
                                {trend === "EQUAL" && (
                                  <span className="text-slate-700 dark:text-slate-400 flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700/50">
                                    <Minus className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                                    <span>{lang === "ar" ? "مؤشر مستقر" : "Stable"}</span>
                                  </span>
                                )}
                              </div>

                              <span className="text-slate-500 dark:text-slate-500 font-mono text-[10px]">
                                {formatNumericDate(latest.timestamp)} {new Date(latest.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drill-down Modal for a Selected Test (Shows ALL previous history) */}
      {selectedTestName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedTestName}</span>
                    <span className="text-xs font-mono font-normal text-slate-400">
                      ({groupedLabs.get(selectedTestName)?.length || 0} {lang === 'ar' ? 'تسجيلات سابقة' : 'records'})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' 
                      ? 'السجل التاريخي الشامل وتطور القراءات مع هوية المسجل والتوقيت' 
                      : 'Complete historical logs with recorder identity and timestamp'}
                  </p>
                </div>
              </div>

              {!readOnly && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAddForTest(selectedTestName);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة قراءة جديدة' : 'Add Reading'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerDeleteLabType(selectedTestName);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                    title={lang === 'ar' ? 'حذف هذا التحليل بالكامل' : 'Delete this lab type completely'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'حذف بالكامل' : 'Delete All'}</span>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto rtl:ml-0 rtl:mr-auto">
                <button
                  onClick={() => setSelectedTestName(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content: Full History Table & Sequence */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Trend Chain Banner */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 font-semibold">
                  {lang === 'ar' ? 'المسار الزمني للقراءات:' : 'Chronological Progression:'}
                </div>
                <div className="flex items-center gap-2 flex-wrap font-mono text-sm font-bold">
                  {(groupedLabs.get(selectedTestName) || []).map((it, idx, arr) => (
                    <React.Fragment key={it.id}>
                      <span className={`px-2.5 py-1 rounded-lg ${
                        idx === arr.length - 1
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 ring-1 ring-teal-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {it.value ? `${it.value} ${it.unit}` : (lang === 'ar' ? 'طلب معلق' : 'Pending Order')}
                      </span>
                      {idx < arr.length - 1 && (
                        <span className="text-teal-500 font-bold">&gt;</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* History Table */}
              <div className="rounded-xl border border-slate-800 overflow-x-auto">
                <table className="w-full text-xs text-left rtl:text-right">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">{lang === 'ar' ? 'التاريخ والوقت' : 'Timestamp'}</th>
                      <th className="p-2.5">{lang === 'ar' ? 'القيمة' : 'Value'}</th>
                      <th className="p-2.5 text-teal-300">{lang === 'ar' ? 'اسم الطبيب' : 'Doctor Name'}</th>
                      <th className="p-2.5">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="p-2.5">{lang === 'ar' ? 'الملاحظات' : 'Notes'}</th>
                      <th className="p-2.5 text-center">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#0d1527]">
                    {[...(groupedLabs.get(selectedTestName) || [])].reverse().map((rec) => {
                      const isEditing = editingRecordId === rec.id;
                      const isOwner = rec.recordedByStaffId === currentUser?.badgeId || rec.recordedByStaffId === currentUser?.uid;

                      return (
                        <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 font-mono text-slate-300 whitespace-nowrap">
                            {formatNumericDate(rec.timestamp)} {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-white whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  className="w-16 bg-slate-950 border border-teal-500/50 rounded px-1.5 py-0.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                                />
                                <span className="text-[10px] text-slate-400 font-normal">{rec.unit}</span>
                              </div>
                            ) : rec.value ? (
                              <>
                                <span className="text-teal-300">{rec.value}</span> {rec.unit}
                              </>
                            ) : (
                              <span className="text-amber-400 font-normal italic text-[11px]">
                                {lang === 'ar' ? 'طلب معلق (قيد التحليل)' : 'Pending (No Result Yet)'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                              <span className="text-teal-300 font-bold">{rec.recordedByName || (lang === 'ar' ? 'الطبيب المناوب' : 'Attending Physician')}</span>
                            </div>
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.status === 'RESULTED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {rec.status === 'RESULTED' 
                                ? (lang === 'ar' ? 'نتيجة معتمدة' : 'Resulted') 
                                : (lang === 'ar' ? 'طلب معلق' : 'Ordered')}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400 max-w-xs">
                            <div className="truncate">{rec.notes || '—'}</div>
                          </td>
                          <td className="p-2.5 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => executeEditRecord(rec)}
                                  className="px-2 py-0.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 text-[10px] font-bold cursor-pointer transition-colors"
                                >
                                  {lang === 'ar' ? 'حفظ' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRecordId(null)}
                                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer transition-colors"
                                >
                                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                              </div>
                            ) : isOwner ? (
                              <button
                                type="button"
                                onClick={() => triggerEditRecord(rec)}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 text-[11px] font-bold transition-all cursor-pointer shadow-sm active:scale-95 mx-auto"
                                title={lang === 'ar' ? 'تعديل هذا التحليل' : 'Edit my recorded reading'}
                              >
                                <Edit className="w-3 h-3 text-indigo-400 shrink-0" />
                                <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-600 font-medium italic">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Lab Result Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'تسجيل تحليل مخبري جديد' : 'Record Laboratory Test Result'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' ? 'يتم حفظ النتيجة في سجل دائم دون استبدال القراءات السابقة' : 'Appended to permanent chronological history'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLab} className="p-5 space-y-4">
              {/* Presets Grid with Category Filter */}
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    {lang === 'ar' ? 'اختر صندوق ونوع التحليل:' : 'Select Lab Panel & Test:'}
                  </label>
                  {/* Category Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedPresetCat('all')}
                      className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-all ${
                        selectedPresetCat === 'all'
                          ? 'bg-teal-500 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lang === 'ar' ? 'الكل' : 'All'}
                    </button>
                    {availablePresetCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedPresetCat(cat)}
                        className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-all ${
                          selectedPresetCat === cat
                            ? 'bg-teal-500 text-slate-950 shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-900/80 rounded-xl border border-slate-800">
                  {dynamicPresets
                    .filter(p => selectedPresetCat === 'all' || p.category === selectedPresetCat)
                    .map(p => (
                      <button
                        type="button"
                        key={p.name}
                        onClick={() => handlePresetSelect(p.name)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all ${
                          formTestName === p.name
                            ? 'bg-teal-500 text-slate-950 font-bold shadow'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('custom')}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                      formTestName === 'custom'
                        ? 'bg-teal-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {lang === 'ar' ? '+ تحليل مخصص' : '+ Custom Test'}
                  </button>
                </div>
              </div>

              {/* Custom Test Name Input if 'custom' is selected */}
              {formTestName === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'اسم التحليل المخصص' : 'Custom Test Name'}
                  </label>
                  <input
                    type="text"
                    value={formCustomName}
                    onChange={(e) => setFormCustomName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: Troponin I, D-Dimer, Procalcitonin...' : 'e.g., Troponin I, D-Dimer, Procalcitonin...'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              )}

              {/* Status & Timestamp */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'حالة التحليل' : 'Status'}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500 font-bold"
                  >
                    <option value="RESULTED">{lang === 'ar' ? 'نتيجة (Resulted)' : 'Resulted'}</option>
                    <option value="ORDERED">{lang === 'ar' ? 'طلب معلق (Ordered)' : 'Ordered'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}
                  </label>
                  <input
                    type="datetime-local"
                    value={formTimestamp}
                    onChange={(e) => setFormTimestamp(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Value Input (Only when status is RESULTED) or Pending Notice (When status is ORDERED) */}
              {formStatus === 'RESULTED' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      {lang === 'ar' ? 'القيمة (Value)' : 'Value'}
                    </label>
                    {formUnit && (
                      <span className="text-[11px] text-teal-400 font-mono">
                        {lang === 'ar' ? `الوحدة: ${formUnit}` : `Unit: ${formUnit}`}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="e.g. 7.5"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-teal-500"
                    required
                    autoFocus
                  />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                  <span>
                    {lang === 'ar' 
                      ? 'طلب معلق بالمختبر - يتم تسجيل طلب تحليل جديد فقط بدون قيمة نتيجة.' 
                      : 'Pending Lab Order - Creating order request without a result value.'}
                  </span>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'ملاحظات سريرية (اختياري)' : 'Clinical Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: عينة مكررة، تم التأكيد بعد نقل كيس دم...' : 'e.g., Repeat sample, post-transfusion check...'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={
                    isSaving || 
                    (formStatus === 'RESULTED' && !formValue.trim()) || 
                    (formTestName === 'custom' && !formCustomName.trim())
                  }
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving 
                    ? (lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...') 
                    : formStatus === 'ORDERED'
                      ? (lang === 'ar' ? 'إرسال الطلب' : 'Submit Order')
                      : (lang === 'ar' ? 'حفظ النتيجة' : 'Save Result')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Lab OCR Scanner Modal */}
      {settings.features.enableAiLabScanner && (
        <AiLabScannerModal
          isOpen={isAiScannerOpen}
          onClose={() => setIsAiScannerOpen(false)}
          patientId={patientId}
          bedNumber={bedNumber}
          targetPreset={aiPreset}
          onDirectSave={async (data) => {
            const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Guest';
            const newItems: LabResultItem[] = (data.items || []).map((it, idx) => {
              const resolvedCat = getCategoryForTest(it.testName, [{ testName: it.testName, category: it.category } as any]);
              return {
                id: `lab-${Date.now()}-${idx}`,
                patientId,
                bedNumber,
                testName: it.testName,
                category: resolvedCat,
                value: it.value,
                unit: it.unit || '',
                normalRange: it.normalRange || '',
                status: 'RESULTED',
                timestamp: new Date(data.timestamp || new Date()).toISOString(),
                notes: `AI Optical OCR - ${data.summaryEn || ''}`,
                recordedByName: doctorName,
                recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
              };
            });

            if (newItems.length > 0) {
              await db.labResults.bulkPut(newItems);
              for (const item of newItems) {
                try {
                  const docRef = doc(firestore, COLLECTIONS.MEDICAL_RECORDS, item.id);
                  await setDoc(docRef, {
                    ...item,
                    recordType: 'LAB',
                    createdAt: Date.now(),
                  });
                } catch (e) {
                  console.warn('Sync lab result to cloud failed:', e);
                }
              }
            }
            onLabAdded();
          }}
        />
      )}

      {/* Custom Lab Deletion Confirmation Modal */}
      {deleteConfirmTest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl p-6 space-y-4"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'تأكيد حذف التحليل بالكامل' : 'Confirm Lab Type Deletion'}
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {deleteConfirmTest}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              {lang === 'ar' 
                ? `هل أنت متأكد تماماً من رغبتك في حذف تحليل "${deleteConfirmTest}"؟ سيؤدي هذا الإجراء إلى حذف جميع القراءات والنتائج التاريخية السابقة المسجلة في هذا القسم نهائياً من قاعدة البيانات.` 
                : `Are you absolutely sure you want to delete "${deleteConfirmTest}"? This action will permanently wipe out all previously recorded results, values, and comments for this test from the database.`}
            </p>

            <div className="flex items-center justify-end gap-3.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmTest(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeDeleteLabType}
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-red-500/10 cursor-pointer"
              >
                {lang === 'ar' ? 'تأكيد الحذف النهائي' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Security & Permissions Alert Modal */}
      {deleteErrorMsg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-6 space-y-4"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'تنبيه الأمان والصلاحيات' : 'Security & Permissions Notice'}
                </h3>
                <p className="text-xs text-amber-500 font-mono mt-0.5">
                  {lang === 'ar' ? 'إجراء غير مصرح به' : 'Unauthorized Action'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              {deleteErrorMsg}
            </p>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteErrorMsg(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                {lang === 'ar' ? 'حسناً، فهمت' : 'Okay, Understood'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
