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

  // Imipenem/Cilastatin / Tienam / تينام / إيميبينيم
  if (norm.includes('imipenem') || norm.includes('tienam') || norm.includes('تينام') || norm.includes('تنام') || norm.includes('إيميبينيم')) {
    if (crCl === null) {
      return {
        drugMatch: 'Imipenem/Cilastatin (Tienam)',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl Pending',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q6H',
        note: 'Standard dose: 500 mg Q6H (or 1 g Q8H for severe sepsis). Awaiting creatinine for CrCl adjustment.',
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    }
    if (crCl > 70) {
      return {
        drugMatch: 'Imipenem/Cilastatin (Tienam)',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl > 70 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q6H',
        note: `CrCl ${crCl} mL/min: Normal renal function (500 mg Q6H or 1 g Q8H - No adjustment needed)`,
        requiresAdjustment: false,
        severityLevel: 'NORMAL',
      };
    } else if (crCl >= 41) {
      return {
        drugMatch: 'Imipenem/Cilastatin (Tienam)',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl 41–70 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q8H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 500 mg Q8H instead of Q6H`,
        requiresAdjustment: true,
        severityLevel: 'MILD',
      };
    } else if (crCl >= 21) {
      return {
        drugMatch: 'Imipenem/Cilastatin (Tienam)',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl 21–40 mL/min',
        recommendedDose: '500 mg',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 500 mg Q12H (or 250 mg Q6H) instead of 500 mg Q6H`,
        requiresAdjustment: true,
        severityLevel: 'MODERATE',
      };
    } else if (crCl >= 6) {
      return {
        drugMatch: 'Imipenem/Cilastatin (Tienam)',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl 6–20 mL/min',
        recommendedDose: '250 mg',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 250 mg Q12H instead of 500 mg Q6H`,
        requiresAdjustment: true,
        severityLevel: 'SEVERE',
      };
    } else {
      return {
        drugMatch: 'Imipenem/Cilastatin (Tienam)',
        category: 'Beta-Lactam / Carbapenem',
        crClRange: 'CrCl < 6 mL/min (or HD)',
        recommendedDose: '250 mg',
        recommendedFrequency: 'Q12H',
        note: `Dose adjusted for CrCl ${crCl} mL/min: 250 mg Q12H (give dose post-hemodialysis on HD days)`,
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
