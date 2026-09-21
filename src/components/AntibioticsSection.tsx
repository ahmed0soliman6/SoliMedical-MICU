import React, { useState, useEffect, useMemo } from 'react';
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
  Timer,
  Calculator,
  Zap,
  RotateCcw,
  Check
} from 'lucide-react';
import { PatientAntibiotic, PatientDossier, BedRecord, BedNumber, LabResultItem, Gender } from '../types/schema.ts';
import { AntibioticPreset, SystemSettings } from '../types/settings.ts';
import { useTranslation } from '../services/i18n.ts';
import { db } from '../db/icuSyncDb.ts';
import { doc, deleteDoc } from 'firebase/firestore';
import { firestore, setDoc } from '../services/firebase.ts';

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

/**
 * Cockcroft-Gault Equation for Creatinine Clearance (CrCl):
 * Males: CrCl (mL/min) = ((140 - Age) * Weight_kg) / (72 * Serum_Creatinine_mg_dL)
 * Females: CrCl (mL/min) = Result * 0.85
 */
export function calculateCockcroftGault(
  age: number,
  weightKg: number,
  gender: string | Gender,
  creatinineMgDl: number
): number | null {
  if (!age || age <= 0 || !weightKg || weightKg <= 0 || !creatinineMgDl || creatinineMgDl <= 0) {
    return null;
  }
  const isFemale = String(gender).toUpperCase() === 'FEMALE' || String(gender).toUpperCase() === 'أنثى';
  let crCl = ((140 - age) * weightKg) / (72 * creatinineMgDl);
  if (isFemale) {
    crCl *= 0.85;
  }
  return Math.round(crCl * 10) / 10;
}

export interface RenalDosingRecommendation {
  drugMatch: string;
  category: string;
  crClRange: string;
  recommendedDose?: string;
  recommendedFrequency?: string;
  note: string;
  requiresAdjustment: boolean;
  severityLevel: 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE' | 'ESRD';
}

/**
 * Clinical Renal Dosing Matrix for Standard ICU Antimicrobials
 */
export function evaluateRenalDosingMatrix(
  drugName: string,
  crCl: number | null
): RenalDosingRecommendation | null {
  if (!drugName) return null;
  const norm = drugName.toLowerCase().trim();

  // Meropenem / Meronem / ميرونام
  if (norm.includes('meropenem') || norm.includes('meronem') || norm.includes('ميرونام') || norm.includes('ميروبينيم')) {
    if (crCl === null) {
      return {
        drugMatch: 'Meropenem',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl Pending',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q8H',
        note: 'Standard dose: 1 g Q8H. Awaiting creatinine for CrCl adjustment.',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    }
    if (crCl > 50) {
      return {
        drugMatch: 'Meropenem',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl > 50 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q8H',
        note: `CrCl ${crCl} mL/min: Normal renal function (1 g Q8H - No adjustment needed)`,
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 26) {
      return {
        drugMatch: 'Meropenem',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl 26–50 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 500 mg Q12H instead of Q8H`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else if (crCl >= 10) {
      return {
        drugMatch: 'Meropenem',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl 10–25 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 500 mg Q12H instead of Q8H`,
        requiresAdjustment: true,
        severityLevel: 'SEVERE',
      };
    } else {
      return {
        drugMatch: 'Meropenem',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl < 10 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q24H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 500 mg Q24H instead of Q8H`,
        requiresAdjustment: true,
        severityLevel: 'ESRD',
      };
    }
  }

  // Levofloxacin / Tavanic / ليفوفلوكساسين
  if (norm.includes('levofloxacin') || norm.includes('tavanic') || norm.includes('ليفوفلوكساسين') || norm.includes('تافانيك')) {
    if (crCl === null || crCl >= 50) {
      return {
        drugMatch: 'Levofloxacin',
        category: 'Fluoroquinolones',
        crClRange: 'CrCl ≥ 50 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q24H',
        note: crCl ? `CrCl ${crCl} mL/min: Standard dose 500 mg Q24H (No adjustment needed)` : 'Standard dose: 500 mg Q24H',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 20) {
      return {
        drugMatch: 'Levofloxacin',
        category: 'Fluoroquinolones',
        crClRange: 'CrCl 20–49 mL/min',
        recommendedDose: '250 mg',
        recommendedFrequency: 'Q24H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 250 mg Q24H (or 500 mg Q48H) instead of 500 mg Q24H`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else {
      return {
        drugMatch: 'Levofloxacin',
        category: 'Fluoroquinolones',
        crClRange: 'CrCl < 20 mL/min',
        recommendedDose: '250 mg',
        recommendedFrequency: 'Q48H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 250 mg Q48H instead of Q24H`,
        requiresAdjustment: true,
        severityLevel: 'ESRD',
      };
    }
  }

  // Piperacillin/Tazobactam / Tazocin / تازوسين
  if (norm.includes('piperacillin') || norm.includes('tazocin') || norm.includes('تازوسين') || norm.includes('بيبراسيلين')) {
    if (crCl === null || crCl > 50) {
      return {
        drugMatch: 'Piperacillin/Tazobactam',
        category: 'Beta-Lactam / Penicillin',
        crClRange: 'CrCl > 50 mL/min',
        recommendedDose: '4.5 g',
        recommendedFrequency: 'Q6H',
        note: crCl ? `CrCl ${crCl} mL/min: Standard dose 4.5 g Q6H (No adjustment)` : 'Standard dose: 4.5 g Q6H',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 20) {
      return {
        drugMatch: 'Piperacillin/Tazobactam',
        category: 'Beta-Lactam / Penicillin',
        crClRange: 'CrCl 20–50 mL/min',
        recommendedDose: '3.375 g',
        recommendedFrequency: 'Q6H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 3.375 g Q6H instead of 4.5 g Q6H`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else {
      return {
        drugMatch: 'Piperacillin/Tazobactam',
        category: 'Beta-Lactam / Penicillin',
        crClRange: 'CrCl < 20 mL/min',
        recommendedDose: '2.25 g',
        recommendedFrequency: 'Q6H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 2.25 g Q6H (or 2.25 g Q8H) instead of 4.5 g Q6H`,
        requiresAdjustment: true,
        severityLevel: 'SEVERE',
      };
    }
  }

  // Vancomycin / فانكومايسين
  if (norm.includes('vancomycin') || norm.includes('vancocin') || norm.includes('فانكومايسين')) {
    if (crCl === null || crCl >= 50) {
      return {
        drugMatch: 'Vancomycin',
        category: 'Glycopeptide',
        crClRange: 'CrCl ≥ 50 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q12H',
        note: crCl ? `CrCl ${crCl} mL/min: Standard dose 1 g Q12H (Target trough 15-20 mcg/mL)` : 'Standard dose 1 g Q12H',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 30) {
      return {
        drugMatch: 'Vancomycin',
        category: 'Glycopeptide',
        crClRange: 'CrCl 30–49 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q24H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 1 g Q24H instead of Q12H (TDM trough monitoring mandatory)`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else {
      return {
        drugMatch: 'Vancomycin',
        category: 'Glycopeptide',
        crClRange: 'CrCl < 30 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q48H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 1 g Q48H (or guided by trough level < 15 mcg/mL)`,
        requiresAdjustment: true,
        severityLevel: 'SEVERE',
      };
    }
  }

  // Cefepime / سيفيبيم
  if (norm.includes('cefepime') || norm.includes('maxipime') || norm.includes('سيفيبيم')) {
    if (crCl === null || crCl > 50) {
      return {
        drugMatch: 'Cefepime',
        category: 'Beta-Lactam / Cephalosporin',
        crClRange: 'CrCl > 50 mL/min',
        recommendedDose: '2 g',
        recommendedFrequency: 'Q8H',
        note: crCl ? `CrCl ${crCl} mL/min: Standard dose 2 g Q8H (No adjustment)` : 'Standard dose: 2 g Q8H',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 30) {
      return {
        drugMatch: 'Cefepime',
        category: 'Beta-Lactam / Cephalosporin',
        crClRange: 'CrCl 30–50 mL/min',
        recommendedDose: '2 g',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 2 g Q12H instead of Q8H`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else if (crCl >= 11) {
      return {
        drugMatch: 'Cefepime',
        category: 'Beta-Lactam / Cephalosporin',
        crClRange: 'CrCl 11–29 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 1 g Q12H (or 2 g Q24H) instead of 2 g Q8H`,
        requiresAdjustment: true,
        severityLevel: 'SEVERE',
      };
    } else {
      return {
        drugMatch: 'Cefepime',
        category: 'Beta-Lactam / Cephalosporin',
        crClRange: 'CrCl < 11 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q24H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 1 g Q24H instead of 2 g Q8H`,
        requiresAdjustment: true,
        severityLevel: 'ESRD',
      };
    }
  }

  // Ceftriaxone / سفترياكسون (NO adjustment)
  if (norm.includes('ceftriaxone') || norm.includes('rocephin') || norm.includes('سفترياكسون')) {
    return {
      drugMatch: 'Ceftriaxone',
      category: 'Beta-Lactam / Cephalosporin',
      crClRange: 'Any CrCl',
      recommendedDose: '2 g',
      recommendedFrequency: 'Q24H',
      note: crCl !== null 
        ? `CrCl ${crCl} mL/min: No renal dose adjustment required (Dual biliary/renal clearance). Standard 2 g Q24H.`
        : 'No renal dose adjustment required (Dual biliary/renal clearance). Standard 2 g Q24H.',
      requiresAdjustment: false,
      severityLevel: 'NORMAL',
    };
  }

  // Colistin / كوليستين
  if (norm.includes('colistin') || norm.includes('colistimethate') || norm.includes('كوليستين')) {
    if (crCl === null || crCl >= 50) {
      return {
        drugMatch: 'Colistin',
        category: 'Polymyxin',
        crClRange: 'CrCl ≥ 50 mL/min',
        recommendedDose: '3 MIU',
        recommendedFrequency: 'Q12H',
        note: crCl ? `CrCl ${crCl} mL/min: Standard maintenance 3 MIU Q12H` : 'Standard maintenance: 3 MIU Q12H',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 30) {
      return {
        drugMatch: 'Colistin',
        category: 'Polymyxin',
        crClRange: 'CrCl 30–49 mL/min',
        recommendedDose: '2 MIU',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 2 MIU Q12H instead of 3 MIU Q12H`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else if (crCl >= 10) {
      return {
        drugMatch: 'Colistin',
        category: 'Polymyxin',
        crClRange: 'CrCl 10–29 mL/min',
        recommendedDose: '1.5 MIU',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 1.5 MIU Q12H (or 2 MIU Q24H)`,
        requiresAdjustment: true,
        severityLevel: 'SEVERE',
      };
    } else {
      return {
        drugMatch: 'Colistin',
        category: 'Polymyxin',
        crClRange: 'CrCl < 10 mL/min',
        recommendedDose: '1 MIU',
        recommendedFrequency: 'Q24H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 1 MIU Q24H`,
        requiresAdjustment: true,
        severityLevel: 'ESRD',
      };
    }
  }

  // Ciprofloxacin / سيبروفلوكساسين
  if (norm.includes('ciprofloxacin') || norm.includes('ciprobay') || norm.includes('سيبروفلوكساسين')) {
    if (crCl === null || crCl >= 50) {
      return {
        drugMatch: 'Ciprofloxacin',
        category: 'Fluoroquinolones',
        crClRange: 'CrCl ≥ 50 mL/min',
        recommendedDose: '400 mg',
        recommendedFrequency: 'Q12H',
        note: crCl ? `CrCl ${crCl} mL/min: Standard dose 400 mg Q12H` : 'Standard dose: 400 mg Q12H',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 30) {
      return {
        drugMatch: 'Ciprofloxacin',
        category: 'Fluoroquinolones',
        crClRange: 'CrCl 30–49 mL/min',
        recommendedDose: '400 mg',
        recommendedFrequency: 'Q24H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 400 mg Q24H instead of Q12H`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else {
      return {
        drugMatch: 'Ciprofloxacin',
        category: 'Fluoroquinolones',
        crClRange: 'CrCl < 30 mL/min',
        recommendedDose: '200 mg',
        recommendedFrequency: 'Q24H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 200 mg Q24H instead of 400 mg Q12H`,
        requiresAdjustment: true,
        severityLevel: 'SEVERE',
      };
    }
  }

  // Fluconazole / فلوكونازول
  if (norm.includes('fluconazole') || norm.includes('diflucan') || norm.includes('فلوكونازول')) {
    if (crCl === null || crCl > 50) {
      return {
        drugMatch: 'Fluconazole',
        category: 'Antifungal',
        crClRange: 'CrCl > 50 mL/min',
        recommendedDose: '400 mg',
        recommendedFrequency: 'Q24H',
        note: crCl ? `CrCl ${crCl} mL/min: Standard dose 400 mg Q24H (No adjustment)` : 'Standard dose: 400 mg Q24H',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else {
      return {
        drugMatch: 'Fluconazole',
        category: 'Antifungal',
        crClRange: 'CrCl ≤ 50 mL/min',
        recommendedDose: '200 mg',
        recommendedFrequency: 'Q24H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 200 mg Q24H (50% dose reduction) instead of 400 mg Q24H`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    }
  }

  // Amikacin / أميكاسين
  if (norm.includes('amikacin') || norm.includes('amikin') || norm.includes('أميكاسين')) {
    if (crCl === null || crCl >= 50) {
      return {
        drugMatch: 'Amikacin',
        category: 'Aminoglycoside',
        crClRange: 'CrCl ≥ 50 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q24H',
        note: crCl ? `CrCl ${crCl} mL/min: 15 mg/kg once daily (Q24H)` : '15 mg/kg once daily (Q24H)',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 30) {
      return {
        drugMatch: 'Amikacin',
        category: 'Aminoglycoside',
        crClRange: 'CrCl 30–49 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q36H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: Extended interval Q36H (TDM monitoring mandatory)`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else {
      return {
        drugMatch: 'Amikacin',
        category: 'Aminoglycoside',
        crClRange: 'CrCl < 30 mL/min',
        recommendedDose: '1 g',
        recommendedFrequency: 'Q48H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: Extended interval Q48H (guided by trough level < 5 mcg/mL)`,
        requiresAdjustment: true,
        severityLevel: 'SEVERE',
      };
    }
  }

  // Linezolid / لينزوليد (NO adjustment)
  if (norm.includes('linezolid') || norm.includes('zyvox') || norm.includes('لينزوليد')) {
    return {
      drugMatch: 'Linezolid',
      category: 'Oxazolidinone',
      crClRange: 'Any CrCl',
      recommendedDose: '600 mg',
      recommendedFrequency: 'Q12H',
      note: crCl !== null 
        ? `CrCl ${crCl} mL/min: No renal dose adjustment required. Standard 600 mg Q12H.`
        : 'No renal dose adjustment required. Standard 600 mg Q12H.',
      requiresAdjustment: false,
      severityLevel: 'NORMAL',
    };
  }

  // Metronidazole / فلاجيل
  if (norm.includes('metronidazole') || norm.includes('flagyl') || norm.includes('مترونيدازول') || norm.includes('فلاجيل')) {
    if (crCl === null || crCl >= 10) {
      return {
        drugMatch: 'Metronidazole',
        category: 'Nitroimidazole',
        crClRange: 'CrCl ≥ 10 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q8H',
        note: crCl ? `CrCl ${crCl} mL/min: Standard dose 500 mg Q8H (No adjustment)` : 'Standard dose 500 mg Q8H',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else {
      return {
        drugMatch: 'Metronidazole',
        category: 'Nitroimidazole',
        crClRange: 'CrCl < 10 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 500 mg Q12H (50% reduction for ESRD)`,
        requiresAdjustment: true,
        severityLevel: 'ESRD',
      };
    }
  }

  return null;
}

interface AntibioticsSectionProps {
  patient: PatientDossier;
  bed: BedRecord;
  settings: SystemSettings;
  antibiotics: PatientAntibiotic[];
  labResults?: LabResultItem[];
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
  labResults,
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

  // Renal & Cockcroft-Gault Calculation State
  const [latestCreatinine, setLatestCreatinine] = useState<{
    value: number;
    dateStr: string;
    source: 'LAB' | 'MANUAL';
  } | null>(null);
  const [manualCreatinineInput, setManualCreatinineInput] = useState<string>('');
  const [showManualCrEntry, setShowManualCrEntry] = useState<boolean>(false);
  const [isRenalAutoApplied, setIsRenalAutoApplied] = useState<boolean>(false);

  // Effective Serum Creatinine (manual input takes precedence if valid)
  const effectiveCr = useMemo(() => {
    if (manualCreatinineInput && !isNaN(parseFloat(manualCreatinineInput)) && parseFloat(manualCreatinineInput) > 0) {
      return parseFloat(manualCreatinineInput);
    }
    return latestCreatinine?.value ?? null;
  }, [manualCreatinineInput, latestCreatinine]);

  // Dynamic Cockcroft-Gault Creatinine Clearance (CrCl in mL/min)
  const currentCrCl = useMemo(() => {
    if (!patient || effectiveCr === null) return null;
    return calculateCockcroftGault(patient.age, patient.weightKg, patient.gender, effectiveCr);
  }, [patient?.age, patient?.weightKg, patient?.gender, effectiveCr]);

  // Current renal recommendation based on selected drug and CrCl
  const currentRenalRec = useMemo(() => {
    return evaluateRenalDosingMatrix(drugNameEn || drugNameAr, currentCrCl);
  }, [drugNameEn, drugNameAr, currentCrCl]);

  const presetsList = settings.antibioticsPresets || [];
  const availableDoses = getAvailableDosesForDrug(drugNameEn || drugNameAr, presetsList);

  // Unified helper to apply antibiotic dosing & Cockcroft-Gault renal adjustment
  const applyDrugAndRenalAdjustment = (
    drugName: string,
    crClVal: number | null,
    fallbackDose?: string,
    fallbackFreq?: string
  ) => {
    const rec = evaluateRenalDosingMatrix(drugName, crClVal);
    const matchedDoses = getAvailableDosesForDrug(drugName, presetsList);

    if (rec && rec.requiresAdjustment && crClVal !== null) {
      if (rec.recommendedDose) {
        setDose(rec.recommendedDose);
      } else if (matchedDoses.length > 0) {
        setDose(matchedDoses[0]);
      }
      if (rec.recommendedFrequency) {
        setFrequency(rec.recommendedFrequency);
        setIsCustomFrequency(!['Q6H', 'Q8H', 'Q12H', 'Q24H', 'Q48H', 'Q36H', 'Q72H', 'Continuous', 'Once / STAT', 'Post-HD'].includes(rec.recommendedFrequency));
      }
      setRenalAdjustment(rec.note);
      setIsRenalAutoApplied(true);
    } else {
      if (fallbackDose) {
        setDose(fallbackDose);
      } else if (rec?.recommendedDose) {
        setDose(rec.recommendedDose);
      } else if (matchedDoses.length > 0) {
        setDose(matchedDoses[0]);
      }

      if (fallbackFreq) {
        setFrequency(fallbackFreq);
        setIsCustomFrequency(!['Q6H', 'Q8H', 'Q12H', 'Q24H', 'Q48H', 'Q36H', 'Q72H', 'Continuous', 'Once / STAT', 'Post-HD'].includes(fallbackFreq));
      } else if (rec?.recommendedFrequency) {
        setFrequency(rec.recommendedFrequency);
        setIsCustomFrequency(!['Q6H', 'Q8H', 'Q12H', 'Q24H', 'Q48H', 'Q36H', 'Q72H', 'Continuous', 'Once / STAT', 'Post-HD'].includes(rec.recommendedFrequency));
      }

      if (rec?.note) {
        setRenalAdjustment(rec.note);
      }
      setIsRenalAutoApplied(false);
    }
  };

  // Fetch or resolve latest Creatinine lab result for this patient when modal opens
  useEffect(() => {
    if (!isAddModalOpen || !patient) return;

    let isMounted = true;
    const resolveCreatinine = async () => {
      try {
        const pool = (labResults && labResults.length > 0)
          ? labResults
          : await db.labResults.where('patientId').equals(patient.id).toArray();

        const creatLabs = pool.filter(l => {
          const name = (l.testName || '').toLowerCase().trim();
          return (name.includes('creat') || name.includes('كرياتين')) && !isNaN(parseFloat(l.value));
        });

        if (creatLabs.length > 0) {
          creatLabs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const latest = creatLabs[0];
          const val = parseFloat(latest.value);
          const d = new Date(latest.timestamp);
          const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
          if (isMounted) {
            setLatestCreatinine({
              value: val,
              dateStr,
              source: 'LAB',
            });
            // Only set showManualCrEntry to false on initial open if user hasn't typed anything
            if (!manualCreatinineInput) {
              setShowManualCrEntry(false);
            }
          }
        } else {
          if (isMounted) {
            setLatestCreatinine(null);
            setShowManualCrEntry(true);
          }
        }
      } catch (err) {
        console.error('Error fetching creatinine for patient:', err);
      }
    };

    resolveCreatinine();

    return () => {
      isMounted = false;
    };
  }, [isAddModalOpen, patient?.id]);

  const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Attending';

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
    setManualCreatinineInput('');
    setIsRenalAutoApplied(false);
    if (preset) {
      setSelectedPresetId(preset.id);
      setDrugNameEn(preset.nameEn);
      setDrugNameAr(preset.nameAr);
      setRoute(preset.defaultRoute || 'IV');
      setIndication(preset.standardIndication || '');
      setCategory(preset.category || 'Beta-Lactam / Carbapenem');
      setPlannedDurationDays(preset.defaultDurationDays || 7);
      setRequiresTdm(!!preset.requiresTdm);
      setTdmTarget(preset.tdmTarget || '');
      applyDrugAndRenalAdjustment(preset.nameEn, currentCrCl, preset.defaultDose, preset.defaultFrequency);
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
    setIsRenalAutoApplied(false);
    setIsAddModalOpen(true);
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const presets = settings.antibioticsPresets || [];
    const p = presets.find(x => x.id === presetId);
    if (p) {
      setDrugNameEn(p.nameEn);
      setDrugNameAr(p.nameAr);
      setRoute(p.defaultRoute || 'IV');
      setIndication(p.standardIndication || '');
      setCategory(p.category || 'Beta-Lactam / Carbapenem');
      setPlannedDurationDays(p.defaultDurationDays || 7);
      setRequiresTdm(!!p.requiresTdm);
      setTdmTarget(p.tdmTarget || '');
      applyDrugAndRenalAdjustment(p.nameEn, currentCrCl, p.defaultDose, p.defaultFrequency);
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
    <div 
      id="patient-antibiotics-card" 
      data-expanded={!isCollapsed ? "true" : "false"}
      className="icu-collapsible-section rounded-2xl p-4 shadow-sm dark:shadow-xl space-y-4 border transition-all animate-in fade-in duration-300"
    >
      {/* Header Bar */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="icu-card-header-toggle flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 cursor-pointer p-2 rounded-xl transition-all"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400">
            <Pill className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <h3 className="text-base font-bold text-slate-900 dark:text-white whitespace-nowrap">
              {lang === 'ar' ? 'المضادات الحيوية' : 'Antibiotics'}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-sm whitespace-nowrap">
              {activeCount} {lang === 'ar' ? 'نشط' : 'Active'}
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer flex items-center gap-1 text-xs border border-slate-300 dark:border-slate-700"
          >
            <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium hidden sm:inline">
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
            className="w-full max-w-xl bg-white dark:bg-[#091122] text-slate-900 dark:text-white border border-slate-200 dark:border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingAbx
                      ? (lang === 'ar' ? 'تعديل بيانات المضاد الحيوي' : 'Edit Antibiotic Regimen')
                      : (lang === 'ar' ? 'إضافة مضاد حيوي للمريض' : 'Prescribe New Antibiotic')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? `سرير ${bed.bedNumber} - المريض: ${patient.fullNameAr || patient.fullNameEn}` : `Bed ${bed.bedNumber} - Patient: ${patient.fullNameEn || patient.fullNameAr}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAntibiotic} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Presets Selection if Adding */}
              {!editingAbx && presetsList.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'اختر من قائمة المضادات الجاهزة في وحدة العناية:' : 'Load from Unit Antibiotic Presets:'}
                  </label>
                  <select
                    value={selectedPresetId}
                    onChange={(e) => handleApplyPreset(e.target.value)}
                    className="w-full bg-amber-50/60 dark:bg-[#070c18] border border-amber-400 dark:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-900 dark:text-amber-300 font-medium focus:outline-none focus:border-amber-500"
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'ar' ? 'اسم المضاد الحيوي (Drug Name) *' : 'Drug Name (Generic / Brand) *'}
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
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
                    applyDrugAndRenalAdjustment(newName, currentCrCl);
                  }}
                  placeholder="e.g. Meropenem, Levofloxacin, Vancomycin, Tazocin"
                  className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
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
                          applyDrugAndRenalAdjustment(chip.name, currentCrCl, chip.defDose, chip.defFreq);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                          drugNameEn.toLowerCase().includes(chip.name.toLowerCase()) || drugNameEn.includes(chip.ar)
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-400 dark:border-amber-500/60 font-semibold'
                            : 'bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/60 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
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
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === 'ar' ? 'الجرعة المتوفرة *' : 'Available Dose *'}
                    </label>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-medium">
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
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-amber-400 dark:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-900 dark:text-amber-300 font-bold font-mono focus:outline-none focus:border-amber-500 cursor-pointer shadow-inner"
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
                        className="w-full bg-slate-50 dark:bg-[#070c18] border border-amber-400 dark:border-amber-500/60 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'طريقة الإعطاء' : 'Route'}
                  </label>
                  <select
                    value={route}
                    onChange={(e) => setRoute(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
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
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold cursor-pointer hover:underline flex items-center gap-1"
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
                      className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
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
                        className="w-full bg-slate-50 dark:bg-[#070c18] border border-amber-400 dark:border-amber-500/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Indication & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'دواعي الاستخدام / مصدر العدوى' : 'Indication / Infection Source'}
                  </label>
                  <input
                    type="text"
                    value={indication}
                    onChange={(e) => setIndication(e.target.value)}
                    placeholder="e.g. VAP, Septic Shock, Intra-abdominal"
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'تصنيف المضاد' : 'Category'}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
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
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'تاريخ البدء' : 'Start Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'مدة الكورس (أيام)' : 'Course Duration (Days)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={plannedDurationDays}
                    onChange={(e) => setPlannedDurationDays(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'الحالة الحالية' : 'Regimen Status'}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="ACTIVE" className="text-emerald-600 dark:text-emerald-400">ACTIVE (جاري)</option>
                    <option value="PAUSED" className="text-amber-600 dark:text-yellow-400">PAUSED (مؤقت)</option>
                    <option value="COMPLETED" className="text-blue-600 dark:text-blue-400">COMPLETED (مكتمل)</option>
                    <option value="DISCONTINUED" className="text-rose-600 dark:text-rose-400">DISCONTINUED (ملغي)</option>
                  </select>
                </div>
              </div>

              {/* Renal Adjustments & Live Cockcroft-Gault Binding */}
              <div className="bg-cyan-50/80 dark:bg-[#0b1329] border border-cyan-300 dark:border-cyan-500/30 rounded-2xl p-4 shadow-sm dark:shadow-lg dark:shadow-cyan-950/20 space-y-3.5">
                {/* Header with Title & CrCl Status Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-200 dark:border-cyan-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-500/30">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{lang === 'ar' ? 'تعديل وظائف الكلى وحساب تصفية الكرياتينين' : 'Renal Adjustment & Cockcroft-Gault CrCl'}</span>
                        <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-mono bg-cyan-100 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-300 dark:border-cyan-800/60">
                          Cockcroft-Gault
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">
                        {lang === 'ar' 
                          ? 'ربط مباشر ومحسوب تلقائياً من بيانات المريض وآخر تحليل وظائف كلى'
                          : 'Live clinical binding from patient demographics & latest creatinine lab'}
                      </p>
                    </div>
                  </div>

                  {/* Impairment Status Badge */}
                  <div>
                    {currentCrCl === null ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                        <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                        {lang === 'ar' ? 'بانتظار تحليل الكرياتينين' : 'Awaiting Creatinine'}
                      </span>
                    ) : currentCrCl >= 50 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {lang === 'ar' ? 'وظائف كلى مقبولة (CrCl ≥ 50)' : 'Normal / Mild (CrCl ≥ 50)'}
                      </span>
                    ) : currentCrCl >= 30 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                        <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        {lang === 'ar' ? 'قصور كلوي متوسط (CrCl 30-49)' : 'Moderate Impairment (CrCl 30-49)'}
                      </span>
                    ) : currentCrCl >= 10 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40">
                        <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        {lang === 'ar' ? 'قصور كلوي شديد (CrCl 10-29)' : 'Severe Impairment (CrCl 10-29)'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-200 dark:bg-rose-950/90 text-rose-950 dark:text-rose-200 border border-rose-400 dark:border-rose-500/60 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-700 dark:text-rose-300" />
                        {lang === 'ar' ? 'قصور كلوي حرج / غسيل كلى (CrCl < 10)' : 'ESRD / Dialysis (CrCl < 10)'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Patient Live Clinical Parameters Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white dark:bg-[#070c18] p-2.5 rounded-xl border border-cyan-200 dark:border-slate-800/80 text-xs shadow-xs">
                  {/* Age */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 block font-medium">
                      {lang === 'ar' ? 'العمر (Age)' : 'Age'}
                    </span>
                    <span className="text-slate-900 dark:text-white font-mono font-bold">
                      {patient.age ? `${patient.age} ${lang === 'ar' ? 'سنة' : 'yrs'}` : (
                        <span className="text-amber-600 dark:text-amber-400 italic text-[11px]">{lang === 'ar' ? 'غير مسجل' : 'Missing'}</span>
                      )}
                    </span>
                  </div>

                  {/* Weight */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 block font-medium">
                      {lang === 'ar' ? 'الوزن (Weight)' : 'Weight'}
                    </span>
                    <span className="text-slate-900 dark:text-white font-mono font-bold">
                      {patient.weightKg ? `${patient.weightKg} kg` : (
                        <span className="text-amber-600 dark:text-amber-400 italic text-[11px]">{lang === 'ar' ? 'غير مسجل' : 'Missing'}</span>
                      )}
                    </span>
                  </div>

                  {/* Gender */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 block font-medium">
                      {lang === 'ar' ? 'الجنس (Gender)' : 'Gender'}
                    </span>
                    <span className="text-slate-900 dark:text-white font-mono font-bold">
                      {patient.gender === 'female' || (patient.gender as any) === 'F' ? (
                        <span className="text-pink-600 dark:text-pink-300">{lang === 'ar' ? 'أنثى (× 0.85)' : 'Female (× 0.85)'}</span>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-300">{lang === 'ar' ? 'ذكر' : 'Male'}</span>
                      )}
                    </span>
                  </div>

                  {/* Serum Creatinine with source & manual toggle */}
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 block font-medium">
                        {lang === 'ar' ? 'الكرياتينين (SCr)' : 'Serum Creatinine'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowManualCrEntry(prev => !prev)}
                        className="text-[9px] text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 underline font-mono cursor-pointer"
                        title={lang === 'ar' ? 'إدخال أو تعديل يدوي للكرياتينين' : 'Manual Creatinine Override'}
                      >
                        {showManualCrEntry ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'تعديل' : 'Edit')}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-cyan-700 dark:text-cyan-300 font-mono font-bold">
                        {effectiveCr !== null ? `${effectiveCr.toFixed(2)} mg/dL` : (
                          <span className="text-amber-600 dark:text-amber-400 italic text-[11px]">{lang === 'ar' ? 'غير متوفر' : 'No Lab'}</span>
                        )}
                      </span>
                      {latestCreatinine?.dateStr && !manualCreatinineInput && (
                        <span className="text-[9px] text-slate-500 font-mono">
                          ({latestCreatinine.dateStr})
                        </span>
                      )}
                      {manualCreatinineInput && (
                        <span className="text-[9px] px-1 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 font-semibold">
                          {lang === 'ar' ? 'يدوي' : 'Manual'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Manual Creatinine Entry Drawer if toggled or if no lab is available */}
                {showManualCrEntry && (
                  <div className="p-2.5 bg-cyan-100/80 dark:bg-slate-900/90 rounded-xl border border-cyan-300 dark:border-cyan-500/30 flex flex-wrap items-center gap-2">
                    <label className="text-xs text-slate-800 dark:text-slate-300 flex items-center gap-1.5 font-semibold">
                      <Edit3 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>{lang === 'ar' ? 'قيمة الكرياتينين يدوياً (mg/dL):' : 'Enter Serum Creatinine (mg/dL):'}</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      max="25"
                      value={manualCreatinineInput}
                      onChange={(e) => {
                        setManualCreatinineInput(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0 && patient) {
                          const crcl = calculateCockcroftGault(patient.age, patient.weightKg, patient.gender, val);
                          applyDrugAndRenalAdjustment(drugNameEn || drugNameAr, crcl);
                        }
                      }}
                      placeholder="e.g. 1.8"
                      className="w-24 bg-white dark:bg-[#070c18] border border-cyan-400 dark:border-cyan-500/40 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                    {latestCreatinine && manualCreatinineInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualCreatinineInput('');
                          if (patient && latestCreatinine.value) {
                            const crcl = calculateCockcroftGault(patient.age, patient.weightKg, patient.gender, latestCreatinine.value);
                            applyDrugAndRenalAdjustment(drugNameEn || drugNameAr, crcl);
                          }
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'استعادة قيمة المختبر' : 'Revert to Lab Value'}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* CrCl Calculation Display Box */}
                <div className="bg-white/90 dark:bg-[#070c18]/90 rounded-xl p-3 border border-cyan-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div>
                    <span className="text-[10px] text-slate-600 dark:text-slate-400 block font-medium">
                      {lang === 'ar' ? 'معدل تصفية الكرياتينين المحسوب (CrCl Result):' : 'Calculated Creatinine Clearance (Cockcroft-Gault):'}
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-lg font-bold font-mono text-cyan-700 dark:text-cyan-300">
                        {currentCrCl !== null ? `${currentCrCl} mL/min` : '-- mL/min'}
                      </span>
                      {currentCrCl !== null && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          ({lang === 'ar' ? 'المعادلة' : 'Eq'}: ((140 - {patient.age || 'Age'}) × {patient.weightKg || 'Wt'}) / (72 × {effectiveCr?.toFixed(2) || 'Cr'}) {patient.gender === 'female' || (patient.gender as any) === 'F' ? '× 0.85' : ''})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Recommendation Button if Adjustment is needed */}
                  {currentRenalRec && currentRenalRec.requiresAdjustment && currentCrCl !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        if (currentRenalRec.recommendedDose) setDose(currentRenalRec.recommendedDose);
                        if (currentRenalRec.recommendedFrequency) {
                          setFrequency(currentRenalRec.recommendedFrequency);
                          setIsCustomFrequency(!['Q6H', 'Q8H', 'Q12H', 'Q24H', 'Q48H', 'Q36H', 'Q72H', 'Continuous', 'Once / STAT', 'Post-HD'].includes(currentRenalRec.recommendedFrequency));
                        }
                        if (currentRenalRec.note) setRenalAdjustment(currentRenalRec.note);
                        setIsRenalAutoApplied(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-900/30 transition-all cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تطبيق الجرعة الموصى بها كلوياً' : 'Apply Renal Dosing'}</span>
                    </button>
                  )}
                </div>

                {/* Recommendation Guidance Alert Box */}
                {currentRenalRec && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    currentRenalRec.requiresAdjustment 
                      ? 'bg-amber-100/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-500/40 text-amber-950 dark:text-amber-200'
                      : 'bg-emerald-100/90 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-200'
                  }`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        {currentRenalRec.requiresAdjustment ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )}
                        <span>
                          {lang === 'ar' 
                            ? `توصية الجرعة لـ ${drugNameEn || drugNameAr || 'المضاد المحدد'}:`
                            : `Renal Recommendation for ${drugNameEn || drugNameAr || 'Selected Antibiotic'}:`}
                        </span>
                      </span>
                      {currentRenalRec.recommendedDose && currentRenalRec.recommendedFrequency && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/80 dark:bg-black/40 border border-current font-bold">
                          {currentRenalRec.recommendedDose} {currentRenalRec.recommendedFrequency}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                      {currentRenalRec.note}
                    </p>
                  </div>
                )}

                {/* Editable Notes Input Field (Preserving Manual Override for Attending Physician) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>{lang === 'ar' ? 'ملاحظات التعديل الكلوي النهائية للملف' : 'Renal Dosing & Adjustment Note (Editable)'}</span>
                    </label>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {lang === 'ar' ? 'يمكن تعديلها أو إضافة توصية الطبيب يدوياً' : 'Editable manual override'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={renalAdjustment}
                    onChange={(e) => {
                      setRenalAdjustment(e.target.value);
                      setIsRenalAutoApplied(false);
                    }}
                    placeholder={lang === 'ar' ? 'مثال: تم تعديل الجرعة لـ CrCl 28 mL/min إلى 500 mg Q12H' : 'e.g. Dose adjusted for CrCl 28 mL/min to 500 mg Q12H'}
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-sans"
                  />
                </div>
              </div>

              {/* TDM Section */}
              <div className="bg-purple-50/60 dark:bg-slate-950/60 p-3 rounded-xl border border-purple-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req-tdm"
                    checked={requiresTdm}
                    onChange={(e) => setRequiresTdm(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                  />
                  <label htmlFor="req-tdm" className="text-xs font-bold text-purple-900 dark:text-purple-300 cursor-pointer flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>{lang === 'ar' ? 'يتطلب مراقبة مستوى الدواء بالدم (TDM Required)' : 'Therapeutic Drug Monitoring (TDM) Required'}</span>
                  </label>
                </div>

                {requiresTdm && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                        {lang === 'ar' ? 'المستوى المستهدف (TDM Target)' : 'Target Range'}
                      </label>
                      <input
                        type="text"
                        value={tdmTarget}
                        onChange={(e) => setTdmTarget(e.target.value)}
                        placeholder="e.g. Trough: 15-20 mcg/mL"
                        className="w-full bg-white dark:bg-[#070c18] border border-purple-300 dark:border-purple-800/60 rounded-xl px-3 py-1.5 text-xs text-purple-900 dark:text-purple-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1">
                        {lang === 'ar' ? 'آخر قراءة مسجلة' : 'Latest Measured Level'}
                      </label>
                      <input
                        type="text"
                        value={latestTdmLevel}
                        onChange={(e) => setLatestTdmLevel(e.target.value)}
                        placeholder="e.g. 17.2 mcg/mL"
                        className="w-full bg-white dark:bg-[#070c18] border border-purple-300 dark:border-purple-800/60 rounded-xl px-3 py-1.5 text-xs text-purple-900 dark:text-purple-300 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes & Discontinue reason */}
              {status === 'DISCONTINUED' && (
                <div>
                  <label className="block text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                    {lang === 'ar' ? 'سبب إلغاء / إيقاف المضاد الحيوي' : 'Discontinue Reason'}
                  </label>
                  <input
                    type="text"
                    value={discontinueReason}
                    onChange={(e) => setDiscontinueReason(e.target.value)}
                    placeholder="e.g. Culture negative / De-escalated / Toxicity"
                    className="w-full bg-slate-50 dark:bg-[#070c18] border border-rose-300 dark:border-rose-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'ar' ? 'ملاحظات وتوجيهات تمريضية وسريرية' : 'Clinical & Nursing Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: تسريب ممتد على مدار 3 ساعات، متابعة نسبة الصفائح...' : 'e.g. Extended 3h infusion, monitor platelet count...'}
                  className="w-full bg-slate-50 dark:bg-[#070c18] border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
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
