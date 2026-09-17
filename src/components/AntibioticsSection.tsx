import React, { useState } from 'react';
import { 
  Pill, 
  Plus, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  FileText, 
  X, 
  Save, 
  Trash2, 
  Edit3, 
  PauseCircle, 
  PlayCircle, 
  CheckCheck, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  ShieldAlert, 
  Info,
  Timer
} from 'lucide-react';
import { PatientAntibiotic, PatientDossier, BedRecord, BedNumber } from '../types/schema.ts';
import { AntibioticPreset, SystemSettings } from '../types/settings.ts';
import { useTranslation } from '../services/i18n.ts';
import { db } from '../db/icuSyncDb.ts';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase.ts';

// Dictionary of standard ICU antimicrobial doses & parameters
export const COMMON_ANTIBIOTIC_DOSES_MAP: Record<string, { doses: string[]; defaultRoute?: string; defaultFreq?: string; category?: string }> = {
  'meropenem': { doses: ['500 mg', '1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Carbapenem' },
  'meronem': { doses: ['500 mg', '1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Carbapenem' },
  'ميرونام': { doses: ['500 mg', '1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Carbapenem' },
  'ميروبينيم': { doses: ['500 mg', '1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Carbapenem' },

  'levofloxacin': { doses: ['250 mg', '500 mg', '750 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Fluoroquinolones' },
  'tavanic': { doses: ['250 mg', '500 mg', '750 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Fluoroquinolones' },
  'ليفوفلوكساسين': { doses: ['250 mg', '500 mg', '750 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Fluoroquinolones' },
  'تافانيك': { doses: ['250 mg', '500 mg', '750 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Fluoroquinolones' },

  'piperacillin/tazobactam': { doses: ['2.25 g', '3.375 g', '4.5 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },
  'piperacillin-tazobactam': { doses: ['2.25 g', '3.375 g', '4.5 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },
  'piperacillin': { doses: ['2.25 g', '3.375 g', '4.5 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },
  'tazocin': { doses: ['2.25 g', '3.375 g', '4.5 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },
  'تازوسين': { doses: ['2.25 g', '3.375 g', '4.5 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },
  'بيبراسيلين': { doses: ['2.25 g', '3.375 g', '4.5 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },

  'vancomycin': { doses: ['500 mg', '750 mg', '1 g', '1.25 g', '1.5 g', '1.75 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycopeptide' },
  'vancocin': { doses: ['500 mg', '750 mg', '1 g', '1.25 g', '1.5 g', '1.75 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycopeptide' },
  'فانكومايسين': { doses: ['500 mg', '750 mg', '1 g', '1.25 g', '1.5 g', '1.75 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycopeptide' },

  'colistin': { doses: ['1 MIU', '2 MIU', '3 MIU', '4.5 MIU', '9 MIU (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Polymyxins' },
  'colistimethate': { doses: ['1 MIU', '2 MIU', '3 MIU', '4.5 MIU', '9 MIU (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Polymyxins' },
  'كوليستين': { doses: ['1 MIU', '2 MIU', '3 MIU', '4.5 MIU', '9 MIU (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Polymyxins' },

  'ceftriaxone': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Beta-Lactam / Cephalosporin' },
  'rocephin': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Beta-Lactam / Cephalosporin' },
  'سفترياكسون': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Beta-Lactam / Cephalosporin' },
  'روسيفين': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Beta-Lactam / Cephalosporin' },

  'cefepime': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'maxipime': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'سيفيبيم': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'ماكسيبيم': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },

  'ceftazidime': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'fortum': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'سيفتازيديم': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'فورتام': { doses: ['1 g', '2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },

  'ceftazidime/avibactam': { doses: ['2.5 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'zavicefta': { doses: ['2.5 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'زافيسيفتا': { doses: ['2.5 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },

  'amikacin': { doses: ['500 mg', '750 mg', '1 g', '1.5 g', '15 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Aminoglycoside' },
  'amikin': { doses: ['500 mg', '750 mg', '1 g', '1.5 g', '15 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Aminoglycoside' },
  'أميكاسين': { doses: ['500 mg', '750 mg', '1 g', '1.5 g', '15 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Aminoglycoside' },

  'gentamicin': { doses: ['80 mg', '120 mg', '160 mg', '240 mg', '5 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Aminoglycoside' },
  'جنتامايسين': { doses: ['80 mg', '120 mg', '160 mg', '240 mg', '5 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Aminoglycoside' },

  'linezolid': { doses: ['600 mg'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Oxazolidinone' },
  'zyvox': { doses: ['600 mg'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Oxazolidinone' },
  'لينزوليد': { doses: ['600 mg'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Oxazolidinone' },
  'زيفوكس': { doses: ['600 mg'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Oxazolidinone' },

  'metronidazole': { doses: ['500 mg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Nitroimidazole' },
  'flagyl': { doses: ['500 mg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Nitroimidazole' },
  'مترونيدازول': { doses: ['500 mg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Nitroimidazole' },
  'فلاجيل': { doses: ['500 mg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Nitroimidazole' },

  'fluconazole': { doses: ['100 mg', '200 mg', '400 mg', '800 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },
  'diflucan': { doses: ['100 mg', '200 mg', '400 mg', '800 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },
  'فلوكونازول': { doses: ['100 mg', '200 mg', '400 mg', '800 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },
  'ديفلوكان': { doses: ['100 mg', '200 mg', '400 mg', '800 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },

  'caspofungin': { doses: ['50 mg', '70 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },
  'cancidas': { doses: ['50 mg', '70 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },
  'كاسبوفنجين': { doses: ['50 mg', '70 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },

  'anidulafungin': { doses: ['100 mg', '200 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },
  'eraxis': { doses: ['100 mg', '200 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },

  'micafungin': { doses: ['50 mg', '100 mg', '150 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },
  'mycamine': { doses: ['50 mg', '100 mg', '150 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Antifungal' },

  'tigecycline': { doses: ['50 mg', '100 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycylcycline' },
  'tygacil': { doses: ['50 mg', '100 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycylcycline' },
  'تيجيسيكلين': { doses: ['50 mg', '100 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycylcycline' },

  'daptomycin': { doses: ['350 mg', '500 mg', '6 mg/kg', '8 mg/kg', '10 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Lipopeptide' },
  'cubicin': { doses: ['350 mg', '500 mg', '6 mg/kg', '8 mg/kg', '10 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Lipopeptide' },
  'دابتوميسين': { doses: ['350 mg', '500 mg', '6 mg/kg', '8 mg/kg', '10 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Lipopeptide' },

  'ciprofloxacin': { doses: ['200 mg', '400 mg', '500 mg', '750 mg'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Fluoroquinolones' },
  'ciprobay': { doses: ['200 mg', '400 mg', '500 mg', '750 mg'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Fluoroquinolones' },
  'سيبروفلوكساسين': { doses: ['200 mg', '400 mg', '500 mg', '750 mg'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Fluoroquinolones' },

  'azithromycin': { doses: ['250 mg', '500 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Macrolide' },
  'zithromax': { doses: ['250 mg', '500 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Macrolide' },
  'أزيثرومايسين': { doses: ['250 mg', '500 mg'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Macrolide' },

  'imipenem/cilastatin': { doses: ['500 mg', '1 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Carbapenem' },
  'imipenem': { doses: ['500 mg', '1 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Carbapenem' },
  'tienam': { doses: ['500 mg', '1 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Carbapenem' },
  'تنام': { doses: ['500 mg', '1 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Carbapenem' },

  'ertapenem': { doses: ['1 g'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Beta-Lactam / Carbapenem' },
  'invanz': { doses: ['1 g'], defaultRoute: 'IV', defaultFreq: 'Q24H', category: 'Beta-Lactam / Carbapenem' },

  'ampicillin/sulbactam': { doses: ['1.5 g', '3 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },
  'unasyn': { doses: ['1.5 g', '3 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },
  'يوناسين': { doses: ['1.5 g', '3 g'], defaultRoute: 'IV', defaultFreq: 'Q6H', category: 'Beta-Lactam / Penicillin' },

  'amoxicillin/clavulanic': { doses: ['625 mg', '1 g', '1.2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Penicillin' },
  'augmentin': { doses: ['625 mg', '1 g', '1.2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Penicillin' },
  'أوجمنتين': { doses: ['625 mg', '1 g', '1.2 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Penicillin' },

  'clindamycin': { doses: ['300 mg', '600 mg', '900 mg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Lincosamide' },
  'dalacin': { doses: ['300 mg', '600 mg', '900 mg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Lincosamide' },
  'كليندامايسين': { doses: ['300 mg', '600 mg', '900 mg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Lincosamide' },

  'teicoplanin': { doses: ['200 mg', '400 mg', '600 mg', '800 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycopeptide' },
  'targocid': { doses: ['200 mg', '400 mg', '600 mg', '800 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycopeptide' },
  'تارجوسيد': { doses: ['200 mg', '400 mg', '600 mg', '800 mg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Glycopeptide' },

  'voriconazole': { doses: ['200 mg', '300 mg', '400 mg', '6 mg/kg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Antifungal' },
  'vfend': { doses: ['200 mg', '300 mg', '400 mg', '6 mg/kg (Loading)'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Antifungal' },

  'polymyxin b': { doses: ['500,000 IU', '1,000,000 IU', '25,000 IU/kg/day'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Polymyxins' },
  'بوليميكسين': { doses: ['500,000 IU', '1,000,000 IU'], defaultRoute: 'IV', defaultFreq: 'Q12H', category: 'Polymyxins' },

  'trimethoprim/sulfamethoxazole': { doses: ['1 amp (480 mg)', '2 amps (960 mg)', 'TMP 15-20 mg/kg/day'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Sulfonamide' },
  'bactrim': { doses: ['1 amp (480 mg)', '2 amps (960 mg)', 'TMP 15-20 mg/kg/day'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Sulfonamide' },
  'septrin': { doses: ['1 amp (480 mg)', '2 amps (960 mg)', 'TMP 15-20 mg/kg/day'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Sulfonamide' },
  'باكتريم': { doses: ['1 amp (480 mg)', '2 amps (960 mg)'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Sulfonamide' },

  'ceftolozane/tazobactam': { doses: ['1.5 g', '3 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },
  'zerbaxa': { doses: ['1.5 g', '3 g'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Beta-Lactam / Cephalosporin' },

  'acyclovir': { doses: ['250 mg', '500 mg', '10 mg/kg', '15 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Antiviral' },
  'zovirax': { doses: ['250 mg', '500 mg', '10 mg/kg', '15 mg/kg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Antiviral' },
  'أسيكلوفير': { doses: ['250 mg', '500 mg'], defaultRoute: 'IV', defaultFreq: 'Q8H', category: 'Antiviral' },
};

export const getAvailableDosesForDrug = (drugName: string, presets: AntibioticPreset[] = []): string[] => {
  const norm = (drugName || '').toLowerCase().trim();
  if (!norm) return ['250 mg', '500 mg', '750 mg', '1 g', '1.5 g', '2 g', '3 g', '4.5 g'];

  // Check preset first
  const matchedPreset = presets.find(p => 
    p.nameEn.toLowerCase() === norm || 
    p.nameAr.toLowerCase() === norm ||
    norm.includes(p.nameEn.toLowerCase())
  );

  // Check dictionary exact and substring matches
  for (const [key, val] of Object.entries(COMMON_ANTIBIOTIC_DOSES_MAP)) {
    if (norm === key || norm.includes(key) || key.includes(norm)) {
      const list = [...val.doses];
      if (matchedPreset?.defaultDose && !list.includes(matchedPreset.defaultDose)) {
        list.unshift(matchedPreset.defaultDose);
      }
      return list;
    }
  }

  if (matchedPreset?.defaultDose) {
    return [matchedPreset.defaultDose, '250 mg', '500 mg', '750 mg', '1 g', '1.5 g', '2 g', '3 g', '4.5 g'];
  }

  return ['250 mg', '500 mg', '750 mg', '1 g', '1.5 g', '2 g', '3 g', '4.5 g'];
};

interface AntibioticsSectionProps {
  patient: PatientDossier;
  bed: BedRecord;
  settings: SystemSettings;
  antibiotics: PatientAntibiotic[];
  onDataUpdated: () => void;
  currentUser?: {
    id?: string;
    email?: string;
    nameEn?: string;
    nameAr?: string;
    role?: string;
  };
}

export const AntibioticsSection: React.FC<AntibioticsSectionProps> = ({
  patient,
  bed,
  settings,
  antibiotics,
  onDataUpdated,
  currentUser,
}) => {
  const { lang, isRTL } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED_DISCONTINUED'>('ACTIVE');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAbx, setEditingAbx] = useState<PatientAntibiotic | null>(null);

  // Form State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [drugNameEn, setDrugNameEn] = useState('');
  const [drugNameAr, setDrugNameAr] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState<string>('IV');
  const [frequency, setFrequency] = useState<string>('Q8H');
  const [isCustomFrequency, setIsCustomFrequency] = useState<boolean>(false);
  const [indication, setIndication] = useState('');
  const [category, setCategory] = useState('Beta-Lactam / Carbapenem');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [plannedDurationDays, setPlannedDurationDays] = useState(7);
  const [status, setStatus] = useState<'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCONTINUED'>('ACTIVE');
  const [renalAdjustment, setRenalAdjustment] = useState('');
  const [requiresTdm, setRequiresTdm] = useState(false);
  const [tdmTarget, setTdmTarget] = useState('');
  const [latestTdmLevel, setLatestTdmLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [discontinueReason, setDiscontinueReason] = useState('');

  const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Attending';

  const presetsList = settings.antibioticsPresets || [];
  const availableDoses = getAvailableDosesForDrug(drugNameEn || drugNameAr, presetsList);

  // Calculate Day of Therapy (DOT)
  const calculateDot = (startStr: string, plannedDays: number) => {
    try {
      const start = new Date(startStr);
      const now = new Date();
      // Difference in days (1-indexed for clinical days)
      const diffTime = Math.max(0, now.getTime() - start.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const currentDay = Math.min(Math.max(1, diffDays), plannedDays + 5); // Allow slight overdue
      const isCompleted = diffDays > plannedDays;
      const progressPercent = Math.min(100, Math.round((diffDays / plannedDays) * 100));
      return { currentDay, plannedDays, isCompleted, progressPercent, rawDays: diffDays };
    } catch {
      return { currentDay: 1, plannedDays: plannedDays || 7, isCompleted: false, progressPercent: 14, rawDays: 1 };
    }
  };

  const handleOpenAddModal = (preset?: AntibioticPreset) => {
    setEditingAbx(null);
    setIsCustomFrequency(false);
    if (preset) {
      setSelectedPresetId(preset.id);
      setDrugNameEn(preset.nameEn);
      setDrugNameAr(preset.nameAr);
      setDose(preset.defaultDose);
      setRoute(preset.defaultRoute || 'IV');
      setFrequency(preset.defaultFrequency || 'Q8H');
      setIndication(preset.standardIndication || '');
      setCategory(preset.category || 'Beta-Lactam / Carbapenem');
      setPlannedDurationDays(preset.defaultDurationDays || 7);
      setRenalAdjustment(preset.renalAdjustmentNotes || '');
      setRequiresTdm(!!preset.requiresTdm);
      setTdmTarget(preset.tdmTarget || '');
    } else {
      setSelectedPresetId('');
      setDrugNameEn('');
      setDrugNameAr('');
      setDose('1 g');
      setRoute('IV');
      setFrequency('Q8H');
      setIndication('Severe Sepsis');
      setCategory('Beta-Lactam / Carbapenem');
      setPlannedDurationDays(7);
      setRenalAdjustment('');
      setRequiresTdm(false);
      setTdmTarget('');
    }
    setStartDate(new Date().toISOString().slice(0, 10));
    setStatus('ACTIVE');
    setLatestTdmLevel('');
    setNotes('');
    setDiscontinueReason('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (abx: PatientAntibiotic) => {
    setEditingAbx(abx);
    setSelectedPresetId('');
    setDrugNameEn(abx.drugNameEn);
    setDrugNameAr(abx.drugNameAr);
    setDose(abx.dose);
    setRoute(abx.route);
    setFrequency(abx.frequency);
    setIsCustomFrequency(!['Q6H', 'Q8H', 'Q12H', 'Q24H', 'Q48H', 'Q36H', 'Q72H', 'Continuous', 'Once / STAT', 'Post-HD'].includes(abx.frequency));
    setIndication(abx.indication);
    setCategory(abx.category || 'Beta-Lactam / Carbapenem');
    setStartDate(abx.startDate ? abx.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setPlannedDurationDays(abx.plannedDurationDays || 7);
    setStatus(abx.status);
    setRenalAdjustment(abx.renalAdjustment || '');
    setRequiresTdm(!!abx.requiresTdm);
    setTdmTarget(abx.tdmTarget || '');
    setLatestTdmLevel(abx.latestTdmLevel || '');
    setNotes(abx.notes || '');
    setDiscontinueReason(abx.discontinueReason || '');
    setIsAddModalOpen(true);
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const presets = settings.antibioticsPresets || [];
    const p = presets.find(x => x.id === presetId);
    if (p) {
      setDrugNameEn(p.nameEn);
      setDrugNameAr(p.nameAr);
      setDose(p.defaultDose);
      setRoute(p.defaultRoute);
      setFrequency(p.defaultFrequency);
      setIsCustomFrequency(!['Q6H', 'Q8H', 'Q12H', 'Q24H', 'Q48H', 'Q36H', 'Q72H', 'Continuous', 'Once / STAT', 'Post-HD'].includes(p.defaultFrequency));
      setIndication(p.standardIndication || '');
      setCategory(p.category);
      setPlannedDurationDays(p.defaultDurationDays);
      setRenalAdjustment(p.renalAdjustmentNotes || '');
      setRequiresTdm(!!p.requiresTdm);
      setTdmTarget(p.tdmTarget || '');
    }
  };

  const handleSaveAntibiotic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugNameEn.trim()) return;

    const abxId = editingAbx ? editingAbx.id : `abx-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const record: PatientAntibiotic = {
      id: abxId,
      patientId: patient.id,
      bedNumber: bed.bedNumber,
      drugNameEn: drugNameEn.trim(),
      drugNameAr: drugNameAr.trim() || drugNameEn.trim(),
      dose: dose.trim(),
      route: route.trim(),
      frequency: frequency.trim(),
      indication: indication.trim(),
      category: category.trim(),
      startDate: startDate,
      plannedDurationDays: Number(plannedDurationDays) || 7,
      status: status,
      renalAdjustment: renalAdjustment.trim() || undefined,
      requiresTdm: requiresTdm,
      tdmTarget: tdmTarget.trim() || undefined,
      latestTdmLevel: latestTdmLevel.trim() || undefined,
      latestTdmTimestamp: latestTdmLevel.trim() ? (editingAbx?.latestTdmTimestamp || nowIso) : undefined,
      prescribedByDoctorName: editingAbx?.prescribedByDoctorName || doctorName,
      notes: notes.trim() || undefined,
      discontinueReason: status === 'DISCONTINUED' ? (discontinueReason.trim() || 'Discontinued by MD') : undefined,
      discontinuedAt: status === 'DISCONTINUED' ? (editingAbx?.discontinuedAt || nowIso) : undefined,
      createdAt: editingAbx?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    try {
      await db.patientAntibiotics.put(record);
      try {
        const abxRef = doc(firestore, 'patientAntibiotics', record.id);
        await setDoc(abxRef, record, { merge: true });
      } catch (err) {
        console.warn('Firestore antibiotic sync notice:', err);
      }
      setIsAddModalOpen(false);
      onDataUpdated();
    } catch (err) {
      console.error('Failed to save antibiotic:', err);
    }
  };

  const handleUpdateStatus = async (abx: PatientAntibiotic, newStatus: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCONTINUED') => {
    try {
      const updated: PatientAntibiotic = {
        ...abx,
        status: newStatus,
        updatedAt: new Date().toISOString(),
        discontinuedAt: newStatus === 'DISCONTINUED' ? new Date().toISOString() : abx.discontinuedAt,
        discontinueReason: newStatus === 'DISCONTINUED' ? (abx.discontinueReason || 'Discontinued by Attending') : abx.discontinueReason,
      };
      await db.patientAntibiotics.put(updated);
      try {
        const abxRef = doc(firestore, 'patientAntibiotics', abx.id);
        await setDoc(abxRef, updated, { merge: true });
      } catch (e) {
        console.warn('Firestore update antibiotic status error:', e);
      }
      onDataUpdated();
    } catch (err) {
      console.error('Failed to update antibiotic status:', err);
    }
  };

  const handleDelete = async (abx: PatientAntibiotic) => {
    if (!window.confirm(lang === 'ar' ? `هل أنت متأكد من حذف ${abx.drugNameAr || abx.drugNameEn}؟` : `Are you sure you want to delete ${abx.drugNameEn}?`)) {
      return;
    }
    try {
      await db.patientAntibiotics.delete(abx.id);
      try {
        const abxRef = doc(firestore, 'patientAntibiotics', abx.id);
        await deleteDoc(abxRef);
      } catch (e) {
        console.warn('Firestore delete antibiotic sync error:', e);
      }
      onDataUpdated();
    } catch (err) {
      console.error('Failed to delete antibiotic:', err);
    }
  };

  const filteredAntibiotics = antibiotics.filter(abx => {
    if (activeFilter === 'ACTIVE') return abx.status === 'ACTIVE' || abx.status === 'PAUSED';
    if (activeFilter === 'COMPLETED_DISCONTINUED') return abx.status === 'COMPLETED' || abx.status === 'DISCONTINUED';
    return true;
  });

  const activeCount = antibiotics.filter(a => a.status === 'ACTIVE').length;

  return (
    <div id="patient-antibiotics-card" className="bg-[#0b1224] border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-4 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between border-b border-slate-800 pb-3 cursor-pointer hover:bg-slate-800/40 p-2 rounded-xl transition-all"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Pill className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <h3 className="text-base font-bold text-white whitespace-nowrap">
              {lang === 'ar' ? 'المضادات الحيوية' : 'Antibiotics'}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-950/80 text-amber-300 border border-amber-700/60 shadow-sm whitespace-nowrap">
              {activeCount} {lang === 'ar' ? 'نشط' : 'Active'}
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1 text-xs"
          >
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              {isCollapsed ? (lang === 'ar' ? 'عرض السجل' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}
            </span>
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-4">
          {/* Card Action Bar: Add Antibiotic Button & Responsive Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#070c18] border border-slate-800/80 p-2.5 rounded-xl">
            {/* Add Antibiotic Button positioned cleanly below header */}
            <button
              onClick={() => handleOpenAddModal()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة مضاد حيوي' : 'Add Antibiotic'}</span>
            </button>

            {/* Quick Filter Tabs for Mobile & Desktop */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-1 text-xs font-medium w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveFilter('ACTIVE')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                  activeFilter === 'ACTIVE'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{lang === 'ar' ? 'النشطة' : 'Active'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${activeFilter === 'ACTIVE' ? 'bg-slate-950/25 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  {activeCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                  activeFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{lang === 'ar' ? 'الكل' : 'All'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${activeFilter === 'ALL' ? 'bg-slate-950/25 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  {antibiotics.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('COMPLETED_DISCONTINUED')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                  activeFilter === 'COMPLETED_DISCONTINUED'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{lang === 'ar' ? 'السابقة' : 'Ended'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${activeFilter === 'COMPLETED_DISCONTINUED' ? 'bg-slate-950/25 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  {antibiotics.filter(a => a.status === 'COMPLETED' || a.status === 'DISCONTINUED').length}
                </span>
              </button>
            </div>
          </div>
          {/* Quick Presets Bar (Fast 1-click prescribing from unit library) */}
          {presetsList.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-slate-400 font-bold text-[11px] whitespace-nowrap flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {lang === 'ar' ? 'وصفات سريعة شائعة:' : 'ICU Quick Presets:'}
              </span>
              <div className="flex items-center gap-1.5">
                {presetsList.slice(0, 6).map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handleOpenAddModal(preset)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-950/60 hover:text-amber-300 hover:border-amber-600/50 border border-slate-700 text-slate-300 text-[11px] whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>{lang === 'ar' ? preset.nameAr : preset.nameEn}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({preset.defaultDose})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Antibiotics List */}
          {filteredAntibiotics.length === 0 ? (
            <div className="text-center py-10 bg-[#070c18] border border-dashed border-slate-800 rounded-2xl p-6">
              <Pill className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-400">
                {lang === 'ar' ? 'لا توجد مضادات حيوية مسجلة حالياً' : 'No active antibiotic regimens recorded'}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {lang === 'ar'
                  ? 'يمكنك إضافة مضاد حيوي للمريض لتتبع الجرعات، التعديل الكلوي، ومدة العلاج ومستويات TDM.'
                  : 'Start tracking antimicrobial courses, day-of-therapy counters, and renal dosing adjustments.'}
              </p>
              <button
                onClick={() => handleOpenAddModal()}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'ar' ? 'إضافة أول مضاد حيوي للمريض' : 'Prescribe Antibiotic'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredAntibiotics.map(abx => {
                const dot = calculateDot(abx.startDate, abx.plannedDurationDays);
                const isActive = abx.status === 'ACTIVE';
                const isPaused = abx.status === 'PAUSED';
                const isCompleted = abx.status === 'COMPLETED';
                const isDiscontinued = abx.status === 'DISCONTINUED';

                return (
                  <div
                    key={abx.id}
                    className={`bg-[#070c18] border rounded-2xl p-4 transition-all flex flex-col justify-between ${
                      isActive
                        ? 'border-amber-500/40 shadow-lg shadow-amber-950/20 hover:border-amber-400/70'
                        : isPaused
                        ? 'border-yellow-600/40 opacity-80'
                        : 'border-slate-800 opacity-65 bg-slate-950/40'
                    }`}
                  >
                    <div>
                      {/* Top Row: Drug Name + Status Badge */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-white tracking-wide">
                              {lang === 'ar' ? abx.drugNameAr || abx.drugNameEn : abx.drugNameEn}
                            </h4>
                            {abx.category && (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                {abx.category}
                              </span>
                            )}
                          </div>
                          {lang === 'ar' && abx.drugNameEn !== abx.drugNameAr && (
                            <div className="text-xs font-mono text-slate-400 mt-0.5">{abx.drugNameEn}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isActive && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              {lang === 'ar' ? 'نشط' : 'Active'}
                            </span>
                          )}
                          {isPaused && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-yellow-950/80 text-yellow-400 border border-yellow-700/60 flex items-center gap-1">
                              <PauseCircle className="w-3.5 h-3.5" />
                              {lang === 'ar' ? 'مؤقت' : 'Paused'}
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-950/80 text-blue-400 border border-blue-700/60 flex items-center gap-1">
                              <CheckCheck className="w-3.5 h-3.5" />
                              {lang === 'ar' ? 'مكتمل' : 'Completed'}
                            </span>
                          )}
                          {isDiscontinued && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-950/80 text-rose-400 border border-rose-700/60 flex items-center gap-1">
                              <X className="w-3.5 h-3.5" />
                              {lang === 'ar' ? 'ملغي' : 'Discontinued'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Main Prescription Badge: Dose, Route, Frequency */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between mb-3 text-xs">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-amber-400 font-bold text-sm">{abx.dose}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                            {abx.route}
                          </span>
                          <span className="text-teal-300 font-bold">{abx.frequency}</span>
                        </div>
                        {abx.indication && (
                          <span className="text-[11px] text-slate-400 font-medium truncate max-w-[150px] bg-slate-800/80 px-2 py-0.5 rounded" title={abx.indication}>
                            {abx.indication}
                          </span>
                        )}
                      </div>

                      {/* Day of Therapy (DOT) Progress */}
                      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 mb-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                            <Timer className="w-3.5 h-3.5 text-amber-400" />
                            <span>{lang === 'ar' ? 'مدة العلاج (Day of Therapy):' : 'Therapy Course (DOT):'}</span>
                          </div>
                          <div className="font-mono font-bold">
                            <span className={dot.currentDay > dot.plannedDays ? 'text-rose-400' : 'text-amber-400'}>
                              {lang === 'ar' ? `اليوم ${dot.currentDay}` : `Day ${dot.currentDay}`}
                            </span>
                            <span className="text-slate-500"> / {lang === 'ar' ? `${dot.plannedDays} أيام` : `${dot.plannedDays} days`}</span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              dot.currentDay > dot.plannedDays
                                ? 'bg-rose-500'
                                : 'bg-gradient-to-r from-amber-500 to-teal-400'
                            }`}
                            style={{ width: `${Math.min(100, dot.progressPercent)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                          <span>{lang === 'ar' ? 'البدء:' : 'Start:'} {abx.startDate}</span>
                          {dot.currentDay >= dot.plannedDays && isActive && (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {lang === 'ar' ? 'تاريخ المراجعة مستحق!' : 'Stewardship Review Due'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Clinical Details: Renal & TDM */}
                      <div className="space-y-1.5 text-xs mb-3">
                        {abx.renalAdjustment && (
                          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 flex items-start gap-1.5 text-[11px] text-cyan-300">
                            <ShieldAlert className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">{lang === 'ar' ? 'تعديل وظائف الكلى: ' : 'Renal Adjustment: '}</span>
                              <span className="text-slate-300">{abx.renalAdjustment}</span>
                            </div>
                          </div>
                        )}

                        {abx.requiresTdm && (
                          <div className="bg-purple-950/30 p-2 rounded-lg border border-purple-800/50 flex items-start gap-1.5 text-[11px] text-purple-300">
                            <Activity className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                            <div className="w-full">
                              <div className="flex items-center justify-between">
                                <span className="font-bold">{lang === 'ar' ? 'مراقبة مستوى الدواء TDM:' : 'TDM Therapeutic Target:'}</span>
                                {abx.latestTdmLevel && (
                                  <span className="font-mono font-bold text-white bg-purple-900/60 px-1.5 py-0.5 rounded border border-purple-700 text-[10px]">
                                    {lang === 'ar' ? 'آخر قياس:' : 'Latest:'} {abx.latestTdmLevel}
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-300 text-[10px] mt-0.5">{abx.tdmTarget}</div>
                            </div>
                          </div>
                        )}

                        {abx.notes && (
                          <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 flex items-start gap-1.5">
                            <FileText className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                            <span>{abx.notes}</span>
                          </div>
                        )}

                        {isDiscontinued && abx.discontinueReason && (
                          <div className="text-[11px] text-rose-300 bg-rose-950/30 p-2 rounded-lg border border-rose-800/50">
                            <span className="font-bold">{lang === 'ar' ? 'سبب الإيقاف: ' : 'Discontinued reason: '}</span>
                            <span>{abx.discontinueReason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions Bar */}
                    <div className="border-t border-slate-800/80 pt-2.5 flex items-center justify-between text-xs">
                      <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                        {abx.prescribedByDoctorName ? (
                          <span>{lang === 'ar' ? 'بواسطة: ' : 'By: '}{abx.prescribedByDoctorName}</span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1">
                        {isActive && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(abx, 'PAUSED')}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-yellow-950 text-yellow-400 hover:border-yellow-700 border border-slate-700 text-[11px] transition-all cursor-pointer"
                              title={lang === 'ar' ? 'إيقاف مؤقت' : 'Pause'}
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(abx, 'COMPLETED')}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-emerald-950 text-emerald-400 hover:border-emerald-700 border border-slate-700 text-[11px] transition-all cursor-pointer flex items-center gap-1"
                              title={lang === 'ar' ? 'إكمال الكورس' : 'Mark Completed'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{lang === 'ar' ? 'إكمال' : 'Complete'}</span>
                            </button>
                          </>
                        )}

                        {isPaused && (
                          <button
                            onClick={() => handleUpdateStatus(abx, 'ACTIVE')}
                            className="px-2 py-1 rounded-lg bg-emerald-900/50 text-emerald-300 border border-emerald-700 text-[11px] transition-all cursor-pointer flex items-center gap-1"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'استئناف' : 'Resume'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEditModal(abx)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] transition-all cursor-pointer flex items-center gap-1"
                          title={lang === 'ar' ? 'تعديل' : 'Edit'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDelete(abx)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 text-[11px] transition-all cursor-pointer"
                          title={lang === 'ar' ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Antibiotic Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-xl bg-[#091122] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingAbx
                      ? (lang === 'ar' ? 'تعديل بيانات المضاد الحيوي' : 'Edit Antibiotic Regimen')
                      : (lang === 'ar' ? 'إضافة مضاد حيوي للمريض' : 'Prescribe New Antibiotic')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' ? `سرير ${bed.bedNumber} - المريض: ${patient.fullNameAr || patient.fullNameEn}` : `Bed ${bed.bedNumber} - Patient: ${patient.fullNameEn || patient.fullNameAr}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAntibiotic} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Presets Selection if Adding */}
              {!editingAbx && presetsList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'اختر من قائمة المضادات الجاهزة في وحدة العناية:' : 'Load from Unit Antibiotic Presets:'}
                  </label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => handleApplyPreset(e.target.value)}
                    className="w-full bg-[#070c18] border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 font-medium focus:outline-none focus:border-amber-400"
                  >
                    <option value="">{lang === 'ar' ? '-- إدخال يدوي مخصص --' : '-- Custom Manual Entry --'}</option>
                    {presetsList.map(p => (
                      <option key={p.id} value={p.id}>
                        {lang === 'ar' ? `${p.nameAr} (${p.nameEn}) - ${p.defaultDose} ${p.defaultFrequency}` : `${p.nameEn} (${p.defaultDose} ${p.defaultFrequency})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drug Name with fast suggestions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    {lang === 'ar' ? 'اسم المضاد الحيوي (Drug Name) *' : 'Drug Name (Generic / Brand) *'}
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {lang === 'ar' ? 'اكتب أو اختر المضاد لتحديث الجرعات المتاحة' : 'Type or pick to load standard doses'}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={drugNameEn}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setDrugNameEn(newName);
                    const matchedDoses = getAvailableDosesForDrug(newName, presetsList);
                    if (matchedDoses.length > 0 && (!dose || !matchedDoses.includes(dose))) {
                      setDose(matchedDoses[0]);
                    }
                  }}
                  placeholder="e.g. Meropenem, Levofloxacin, Vancomycin, Tazocin"
                  className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />

                {/* Fast Drug Chips */}
                {!editingAbx && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      { name: 'Meropenem', ar: 'ميرونام', defDose: '1 g', defFreq: 'Q8H' },
                      { name: 'Levofloxacin', ar: 'ليفوفلوكساسين', defDose: '500 mg', defFreq: 'Q24H' },
                      { name: 'Piperacillin/Tazobactam', ar: 'تازوسين', defDose: '4.5 g', defFreq: 'Q6H' },
                      { name: 'Vancomycin', ar: 'فانكومايسين', defDose: '1 g', defFreq: 'Q12H' },
                      { name: 'Colistin', ar: 'كوليستين', defDose: '3 MIU', defFreq: 'Q12H' },
                      { name: 'Ceftriaxone', ar: 'سفترياكسون', defDose: '2 g', defFreq: 'Q24H' },
                      { name: 'Cefepime', ar: 'سيفيبيم', defDose: '2 g', defFreq: 'Q8H' },
                      { name: 'Linezolid', ar: 'لينزوليد', defDose: '600 mg', defFreq: 'Q12H' },
                      { name: 'Amikacin', ar: 'أميكاسين', defDose: '1 g', defFreq: 'Q24H' },
                      { name: 'Metronidazole', ar: 'فلاجيل', defDose: '500 mg', defFreq: 'Q8H' },
                      { name: 'Fluconazole', ar: 'فلوكونازول', defDose: '400 mg', defFreq: 'Q24H' },
                    ].map((chip) => (
                      <button
                        key={chip.name}
                        type="button"
                        onClick={() => {
                          setDrugNameEn(chip.name);
                          setDrugNameAr(chip.ar);
                          setDose(chip.defDose);
                          setFrequency(chip.defFreq);
                          const matchedDoses = getAvailableDosesForDrug(chip.name, presetsList);
                          if (matchedDoses.length > 0) setDose(matchedDoses[0] || chip.defDose);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                          drugNameEn.toLowerCase().includes(chip.name.toLowerCase()) || drugNameEn.includes(chip.ar)
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-semibold'
                            : 'bg-slate-900/80 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        {lang === 'ar' ? `${chip.ar} (${chip.name})` : chip.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dose, Route, Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Dynamic Dose Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      {lang === 'ar' ? 'الجرعة المتوفرة *' : 'Available Dose *'}
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono font-medium">
                      {availableDoses.length} {lang === 'ar' ? 'خيارات' : 'options'}
                    </span>
                  </div>
                  <select
                    value={availableDoses.includes(dose) ? dose : 'CUSTOM'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== 'CUSTOM') {
                        setDose(val);
                      } else {
                        if (availableDoses.includes(dose)) {
                          setDose('');
                        }
                      }
                    }}
                    className="w-full bg-[#070c18] border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold font-mono focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
                  >
                    <option value="" disabled>{lang === 'ar' ? '-- اختر الجرعة المتوفرة --' : '-- Select Available Dose --'}</option>
                    {availableDoses.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="CUSTOM">{lang === 'ar' ? '✏️ إدخال جرعة مخصصة أخرى...' : '✏️ Custom / Other Dose...'}</option>
                  </select>

                  {/* Custom manual dose entry input if chosen or not in predefined list */}
                  {(!availableDoses.includes(dose) || dose === '') && (
                    <div className="mt-1.5 animate-in fade-in duration-200">
                      <input
                        type="text"
                        required
                        value={dose}
                        onChange={(e) => setDose(e.target.value)}
                        placeholder={lang === 'ar' ? 'اكتب الجرعة (مثال: 500 mg أو 1 g)' : 'Enter custom dose (e.g. 500 mg or 1 g)'}
                        className="w-full bg-[#070c18] border border-amber-500/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'طريقة الإعطاء' : 'Route'}
                  </label>
                  <select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="IV">IV (Intravenous)</option>
                    <option value="PO">PO (Oral)</option>
                    <option value="Inhalation">Inhalation / Nebulizer</option>
                    <option value="Intrathecal">Intrathecal</option>
                    <option value="IM">IM (Intramuscular)</option>
                    <option value="Topical">Topical</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      {lang === 'ar' ? 'التكرار / الجدول' : 'Frequency / Interval'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomFrequency(!isCustomFrequency);
                        if (!isCustomFrequency && ['Q6H', 'Q8H', 'Q12H', 'Q24H', 'Q48H', 'Q36H', 'Q72H', 'Continuous', 'Once / STAT', 'Post-HD'].includes(frequency)) {
                          setFrequency('');
                        }
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer hover:underline flex items-center gap-1"
                    >
                      {isCustomFrequency ? (lang === 'ar' ? '📋 قائمة جاهزة' : '📋 Presets') : (lang === 'ar' ? '✏️ مخصص' : '✏️ Custom')}
                    </button>
                  </div>

                  {!isCustomFrequency ? (
                    <select
                      value={['Q6H', 'Q8H', 'Q12H', 'Q24H', 'Q48H', 'Q36H', 'Q72H', 'Continuous', 'Once / STAT', 'Post-HD'].includes(frequency) ? frequency : 'CUSTOM'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'CUSTOM') {
                          setIsCustomFrequency(true);
                          setFrequency('');
                        } else {
                          setFrequency(val);
                        }
                      }}
                      className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
                    >
                      <option value="Q6H">{lang === 'ar' ? 'كل 6 س (Q6H)' : 'Every 6 hrs (Q6H)'}</option>
                      <option value="Q8H">{lang === 'ar' ? 'كل 8 س (Q8H)' : 'Every 8 hrs (Q8H)'}</option>
                      <option value="Q12H">{lang === 'ar' ? 'كل 12 س (Q12H)' : 'Every 12 hrs (Q12H)'}</option>
                      <option value="Q24H">{lang === 'ar' ? 'كل 24 س (Q24H / Daily)' : 'Every 24 hrs (Q24H / Daily)'}</option>
                      <option value="Q48H">{lang === 'ar' ? 'كل 48 س (Q48H)' : 'Every 48 hrs (Q48H)'}</option>
                      <option value="Q36H">{lang === 'ar' ? 'كل 36 س (Q36H)' : 'Every 36 hrs (Q36H)'}</option>
                      <option value="Q72H">{lang === 'ar' ? 'كل 72 س (Q72H)' : 'Every 72 hrs (Q72H)'}</option>
                      <option value="Continuous">{lang === 'ar' ? 'تسريب مستمر (Continuous Infusion)' : 'Continuous Infusion'}</option>
                      <option value="Once / STAT">{lang === 'ar' ? 'جرعة واحدة (Stat / Single Dose)' : 'Once / STAT'}</option>
                      <option value="Post-HD">{lang === 'ar' ? 'بعد الغسيل الكلوي (Post-HD)' : 'Post-Hemodialysis (Post-HD)'}</option>
                      <option value="CUSTOM">{lang === 'ar' ? '✏️ توقيت مخصص آخر...' : '✏️ Custom Interval...'}</option>
                    </select>
                  ) : (
                    <div className="animate-in fade-in duration-200">
                      <input
                        type="text"
                        required
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        placeholder={lang === 'ar' ? 'اكتب التكرار المخصص (مثال: كل 4 س أو كل 18 س أو يوم بعد يوم)' : 'Enter custom frequency (e.g. Q4H, Q18H, or Alternate days)'}
                        className="w-full bg-[#070c18] border border-amber-500/60 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Indication & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'دواعي الاستخدام / مصدر العدوى' : 'Indication / Infection Source'}
                  </label>
                  <input
                    type="text"
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                    placeholder="e.g. VAP, Septic Shock, Intra-abdominal"
                    className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'تصنيف المضاد' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Beta-Lactam / Carbapenem">Beta-Lactam / Carbapenem</option>
                    <option value="Glycopeptide / Lipopeptide">Glycopeptide / Lipopeptide</option>
                    <option value="Aminoglycoside">Aminoglycoside</option>
                    <option value="Fluoroquinolone">Fluoroquinolone</option>
                    <option value="Macrolide">Macrolide</option>
                    <option value="Antifungal">Antifungal</option>
                    <option value="Polymyxin">Polymyxin</option>
                    <option value="Other">Other / Miscellaneous</option>
                  </select>
                </div>
              </div>

              {/* Dates & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'تاريخ البدء' : 'Start Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'مدة الكورس (أيام)' : 'Course Duration (Days)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={plannedDurationDays}
                    onChange={(e) => setPlannedDurationDays(Number(e.target.value))}
                    className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'الحالة الحالية' : 'Regimen Status'}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-bold"
                  >
                    <option value="ACTIVE" className="text-emerald-400">ACTIVE (جاري)</option>
                    <option value="PAUSED" className="text-yellow-400">PAUSED (مؤقت)</option>
                    <option value="COMPLETED" className="text-blue-400">COMPLETED (مكتمل)</option>
                    <option value="DISCONTINUED" className="text-rose-400">DISCONTINUED (ملغي)</option>
                  </select>
                </div>
              </div>

              {/* Renal Adjustments */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{lang === 'ar' ? 'تعديل وظائف الكلى (Renal Adjustment)' : 'Renal Dosing / CrCl Adjustment Notes'}</span>
                </label>
                <input
                  type="text"
                  value={renalAdjustment}
                  onChange={(e) => setRenalAdjustment(e.target.value)}
                  placeholder="e.g. Dose adjusted for CrCl 25 mL/min (Q12H instead of Q8H)"
                  className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* TDM Section */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req-tdm"
                    checked={requiresTdm}
                    onChange={(e) => setRequiresTdm(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="req-tdm" className="text-xs font-bold text-purple-300 cursor-pointer flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    <span>{lang === 'ar' ? 'يتطلب مراقبة مستوى الدواء بالدم (TDM Required)' : 'Therapeutic Drug Monitoring (TDM) Required'}</span>
                  </label>
                </div>

                {requiresTdm && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        {lang === 'ar' ? 'المستوى المستهدف (TDM Target)' : 'Target Range'}
                      </label>
                      <input
                        type="text"
                        value={tdmTarget}
                        onChange={(e) => setTdmTarget(e.target.value)}
                        placeholder="e.g. Trough: 15-20 mcg/mL"
                        className="w-full bg-[#070c18] border border-purple-800/60 rounded-xl px-3 py-1.5 text-xs text-purple-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        {lang === 'ar' ? 'آخر قراءة مسجلة' : 'Latest Measured Level'}
                      </label>
                      <input
                        type="text"
                        value={latestTdmLevel}
                        onChange={(e) => setLatestTdmLevel(e.target.value)}
                        placeholder="e.g. 17.2 mcg/mL"
                        className="w-full bg-[#070c18] border border-purple-800/60 rounded-xl px-3 py-1.5 text-xs text-purple-300 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes & Discontinue reason */}
              {status === 'DISCONTINUED' && (
                <div>
                  <label className="block text-xs font-semibold text-rose-400 mb-1">
                    {lang === 'ar' ? 'سبب إلغاء / إيقاف المضاد الحيوي' : 'Discontinue Reason'}
                  </label>
                  <input
                    type="text"
                    value={discontinueReason}
                    onChange={(e) => setDiscontinueReason(e.target.value)}
                    placeholder="e.g. Culture negative / De-escalated / Toxicity"
                    className="w-full bg-[#070c18] border border-rose-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'ملاحظات وتوجيهات تمريضية وسريرية' : 'Clinical & Nursing Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: تسريب ممتد على مدار 3 ساعات، متابعة نسبة الصفائح...' : 'e.g. Extended 3h infusion, monitor platelet count...'}
                  className="w-full bg-[#070c18] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حفظ المضاد الحيوي' : 'Save Antibiotic'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
