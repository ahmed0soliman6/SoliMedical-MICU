export interface SystemFeatureFlags {
  // Main Views & Tabs
  enableBedMatrix: boolean;          // لوحة الأسرة الستة (6-Bed Grid)
  enableSbarHandover: boolean;        // تسليم المناوبات SBAR
  enableClinicalNotes: boolean;       // الملاحظات الطبية المشفرة
  enableArchiveSearch: boolean;       // البحث في الأرشيف الطبي
  enableAdmissions: boolean;          // إدخال مرضى جدد

  // Bedside & Flowsheet Modules
  enableTelemetryVitals: boolean;     // العلامات الحيوية وحساب الضغط الشرياني الوسطي MAP
  enableVentilatorParameters: boolean;// إعدادات جهاز التنفس الصناعي (Ventilator)
  enableInfusionPumps: boolean;       // مضخات التسريب الوريدي والأدوية الحركية الوعائية
  enableFluidBalance: boolean;        // ميزان السوائل 24 ساعة (I/O Balance)
  enableAntibioticsCard: boolean;     // بطاقة ومضادات المريض الحيوية وبروتوكولات مكافحة العدوى
  enableLabFlowsheet: boolean;        // جدول ومسار التحاليل المتسلسلة التراكمية
  enableInvestigations: boolean;      // الفحوصات والأشعات وتصوير الموجات الصوتية
  enableAiLabScanner: boolean;        // التعرف البصري الذكي وقراءة التحاليل بالذكاء الاصطناعي (ABG & CBC OCR)
  enableBedTransferAndSwap: boolean;  // إجراءات نقل المرضى وتبديل الأسِرّة الآمنة
  enableBedIsolationControls: boolean;// إدارة العزل الطبي وحالة السرير
  enableAcuityLevels: boolean;        // تصنيفات الخطورة السريرية (Acuity Badges)
  enableCodeStatus: boolean;          // حالة الإنعاش القلبي الرئوي (Code Status: Full CPR / DNR)
  enableSha256Addendums: boolean;     // البصمات المشفرة SHA-256 للملاحظات

  // Alerts & Network Sync
  enableAudioAlarms: boolean;         // الإنذارات الصوتية الطبية IEC 60601-1-8
  enablePushNotifications: boolean;   // إشعارات الأندرويد والنظام الخارجية
  enableCloudSync: boolean;           // المزامنة السحابية اللحظية Firebase
  enableMortalityAutoPurge: boolean;  // بروتوكول الأرشفة التلقائية بعد 72 ساعة
}

export interface UnitCustomization {
  unitName: string;                  // اسم وحدة العناية (مثلاً: Soli Medical MICU)
  unitSubtitle: string;              // الوصف الفرعي (مثلاً: ICU-Sync 6-Pod)
  shiftName: string;                 // اسم المناوبة الحالية (مناوبة ليلية / صباحية)
  totalBedsCount: number;            // عدد الأسرة الفعالة (افتراضياً 6)
  refreshIntervalSeconds: number;    // فترة التحديث التلقائي بالثواني
}

export interface LabParameterTemplate {
  id: string; // unique ID / key, e.g. "hb"
  name: string; // e.g. "Hb Hemoglobin" or "HG"
  unit: string; // e.g. "g/dL"
  normalRange: string; // e.g. "12.0 - 16.0"
}

export interface LabCategoryTemplate {
  id: string; // e.g. "cbc", "chem"
  nameEn: string; // e.g. "Complete Blood Count (CBC)"
  nameAr: string; // e.g. "صورة الدم (CBC)"
  parameters: LabParameterTemplate[];
}

export interface InfusionDrugPreset {
  id: string;
  nameEn: string;
  nameAr: string;
  defaultCarrier: string;
  defaultUnit: 'mcg/kg/min' | 'mcg/h' | 'mg/h' | 'Units/hr' | 'ml/h';
  defaultRate: number;
  defaultFlowRate: number;
  defaultTarget: string;
}

export interface VentilatorModePreset {
  id: string; // e.g. "SIMV_PC", "PRVC", "APRV"
  labelEn: string;
  labelAr: string;
  type: 'invasive' | 'non-invasive' | 'weaning';
}

export interface FluidCategoryPreset {
  id: string;
  type: 'intake' | 'output';
  labelEn: string;
  labelAr: string;
  defaultMl?: number;
}

export interface AntibioticPreset {
  id: string;
  nameEn: string;
  nameAr: string;
  defaultDose: string;
  defaultRoute: 'IV' | 'PO' | 'Inhalation' | 'Intrathecal' | 'IM';
  defaultFrequency: string;
  defaultDurationDays: number;
  category: 'Beta-Lactam / Carbapenem' | 'Glycopeptide / Lipopeptide' | 'Aminoglycoside' | 'Fluoroquinolone' | 'Macrolide' | 'Antifungal' | 'Polymyxin' | 'Other';
  renalAdjustmentNotes?: string;
  requiresTdm?: boolean;
  tdmTarget?: string;
  standardIndication?: string;
}

export interface SbarFieldConfig {
  id: string;
  labelEn: string;
  labelAr: string;
  section: 'S' | 'B' | 'A' | 'R';
  isRequired: boolean;
  order: number;
}

export interface SystemSettings {
  language: 'en' | 'ar';
  features: SystemFeatureFlags;
  unit: UnitCustomization;
  labCategories?: LabCategoryTemplate[];
  infusionDrugs?: InfusionDrugPreset[];
  ventilatorModes?: VentilatorModePreset[];
  fluidCategories?: FluidCategoryPreset[];
  antibioticsPresets?: AntibioticPreset[];
  sbarFields?: SbarFieldConfig[];
  lastUpdated: string;
}

export const DEFAULT_INFUSION_DRUGS: InfusionDrugPreset[] = [
  { id: 'noradrenaline', nameEn: 'Noradrenaline (Norepinephrine)', nameAr: 'نورأدرينالين', defaultCarrier: '4 mg in 50 mL D5W (80 mcg/mL)', defaultUnit: 'mcg/kg/min', defaultRate: 0.1, defaultFlowRate: 3.8, defaultTarget: 'Target MAP ≥ 65 mmHg' },
  { id: 'adrenaline', nameEn: 'Adrenaline (Epinephrine)', nameAr: 'أدرينالين', defaultCarrier: '4 mg in 50 mL D5W (80 mcg/mL)', defaultUnit: 'mcg/kg/min', defaultRate: 0.05, defaultFlowRate: 2.0, defaultTarget: 'Inotropic support & SBP > 90' },
  { id: 'dopamine', nameEn: 'Dopamine', nameAr: 'دوبامين', defaultCarrier: '200 mg in 50 mL D5W (4 mg/mL)', defaultUnit: 'mcg/kg/min', defaultRate: 5.0, defaultFlowRate: 5.2, defaultTarget: 'Renal/Inotropic Support' },
  { id: 'dobutamine', nameEn: 'Dobutamine', nameAr: 'دوبيوتامين', defaultCarrier: '250 mg in 50 mL D5W (5 mg/mL)', defaultUnit: 'mcg/kg/min', defaultRate: 5.0, defaultFlowRate: 4.2, defaultTarget: 'Cardiac Index > 2.5 L/min' },
  { id: 'vasopressin', nameEn: 'Vasopressin', nameAr: 'فازوبريسين', defaultCarrier: '20 Units in 50 mL NS (0.4 U/mL)', defaultUnit: 'Units/hr', defaultRate: 0.03, defaultFlowRate: 4.5, defaultTarget: 'Refractory Septic Shock' },
  { id: 'insulin', nameEn: 'Regular Insulin (Actrapid)', nameAr: 'إنسولين عادي', defaultCarrier: '50 Units in 50 mL NS (1 U/mL)', defaultUnit: 'Units/hr', defaultRate: 3.0, defaultFlowRate: 3.0, defaultTarget: 'Target BG: 140-180 mg/dL' },
  { id: 'propofol', nameEn: 'Propofol 1%', nameAr: 'بروبوفول', defaultCarrier: '1000 mg in 100 mL Neat (10 mg/mL)', defaultUnit: 'mg/h', defaultRate: 100, defaultFlowRate: 10.0, defaultTarget: 'Target RASS: -2 to -3' },
  { id: 'fentanyl', nameEn: 'Fentanyl', nameAr: 'فنتانيل', defaultCarrier: '1000 mcg in 50 mL NS (20 mcg/mL)', defaultUnit: 'mcg/h', defaultRate: 50, defaultFlowRate: 2.5, defaultTarget: 'Analgesia (CPOT score < 2)' },
  { id: 'midazolam', nameEn: 'Midazolam (Dormicum)', nameAr: 'ميدازولام', defaultCarrier: '50 mg in 50 mL NS (1 mg/mL)', defaultUnit: 'mg/h', defaultRate: 3.0, defaultFlowRate: 3.0, defaultTarget: 'Sedation / Anxiolysis' },
  { id: 'furosemide', nameEn: 'Furosemide (Lasix)', nameAr: 'لازيكس', defaultCarrier: '200 mg in 50 mL NS (4 mg/mL)', defaultUnit: 'mg/h', defaultRate: 10.0, defaultFlowRate: 2.5, defaultTarget: 'Target Urine Output > 0.5 mL/kg/h' },
  { id: 'heparin', nameEn: 'Heparin Infusion', nameAr: 'هيبارين وريدي', defaultCarrier: '25,000 Units in 250 mL D5W (100 U/mL)', defaultUnit: 'Units/hr', defaultRate: 1000, defaultFlowRate: 10.0, defaultTarget: 'Target aPTT: 60-85 sec' },
  { id: 'kcl', nameEn: 'Potassium Chloride (KCl)', nameAr: 'بوتاسيوم وريدي', defaultCarrier: '40 mmol in 500 mL NS (Central)', defaultUnit: 'ml/h', defaultRate: 50, defaultFlowRate: 50.0, defaultTarget: 'Correction of Hypokalemia' },
  { id: 'saline', nameEn: 'Normal Saline 0.9%', nameAr: 'محلول ملحي عادي', defaultCarrier: '500 mL IV Bag', defaultUnit: 'ml/h', defaultRate: 80, defaultFlowRate: 80.0, defaultTarget: 'Hydration & Maintenance' },
];

export const DEFAULT_VENTILATOR_MODES: VentilatorModePreset[] = [
  { id: 'SIMV_PC', labelEn: 'SIMV-PC (Pressure Control)', labelAr: 'SIMV بالتحكم بالضغط', type: 'invasive' },
  { id: 'SIMV_VC', labelEn: 'SIMV-VC (Volume Control)', labelAr: 'SIMV بالتحكم بالحجم', type: 'invasive' },
  { id: 'PRVC', labelEn: 'PRVC (Pressure Regulated Vol)', labelAr: 'PRVC الحجم المنظم بالضغط', type: 'invasive' },
  { id: 'PSV_CPAP', labelEn: 'PSV / CPAP (Spontaneous)', labelAr: 'PSV / CPAP دعم الضغط العفوي', type: 'weaning' },
  { id: 'BIPAP', labelEn: 'BiPAP (Non-Invasive Mask)', labelAr: 'BiPAP قناع غير جائر', type: 'non-invasive' },
  { id: 'HIGH_FLOW_NC', labelEn: 'High-Flow Nasal Cannula (HFNC)', labelAr: 'قنية أنفية عالية التدفق HFNC', type: 'non-invasive' },
  { id: 'T_PIECE', labelEn: 'T-Piece Weaning Trial', labelAr: 'اختبار فطام T-Piece', type: 'weaning' },
  { id: 'APRV', labelEn: 'APRV (Airway Pressure Release)', labelAr: 'APRV تحرير ضغط مجرى الهواء', type: 'invasive' },
];

export const DEFAULT_FLUID_CATEGORIES: FluidCategoryPreset[] = [
  { id: 'ivMaintenance', type: 'intake', labelEn: 'IV Maintenance Crystalloids', labelAr: 'المحاليل الوريدية الرئيسية', defaultMl: 1500 },
  { id: 'ivMedications', type: 'intake', labelEn: 'IV Medications & Infusions', labelAr: 'المضخات والأدوية الوريدية', defaultMl: 350 },
  { id: 'enteralFeed', type: 'intake', labelEn: 'Enteral Tube Feeding (NG/PEG)', labelAr: 'التغذية الأنبوبية المعوية', defaultMl: 0 },
  { id: 'bloodProducts', type: 'intake', labelEn: 'Blood Products (PRBC/FFP/Plt)', labelAr: 'مشتقات ونقل الدم والبلازما', defaultMl: 0 },
  { id: 'oralFluids', type: 'intake', labelEn: 'Oral / Sips Fluid Intake', labelAr: 'السوائل الفموية', defaultMl: 0 },
  { id: 'urineOutput', type: 'output', labelEn: 'Urine Output (Foley Catheter)', labelAr: 'كمية البول (قسطرة بولية)', defaultMl: 1200 },
  { id: 'ngDrainage', type: 'output', labelEn: 'Nasogastric (NG) Tube Drainage', labelAr: 'تصريف الأنبوب المعدي NG', defaultMl: 100 },
  { id: 'chestTube', type: 'output', labelEn: 'Chest Tube Drainage', labelAr: 'تصريف أنبوب الصدر', defaultMl: 0 },
  { id: 'surgicalDrain', type: 'output', labelEn: 'Surgical Drains (Jackson-Pratt/Hemovac)', labelAr: 'الدرانق الجراحية', defaultMl: 0 },
  { id: 'insensibleLoss', type: 'output', labelEn: 'Insensible Loss (Perspiration/Resp)', labelAr: 'الفقدان غير المحسوس (تنفس وعرق)', defaultMl: 500 },
];

export const DEFAULT_ANTIBIOTIC_PRESETS: AntibioticPreset[] = [
  {
    id: 'meropenem',
    nameEn: 'Meropenem',
    nameAr: 'ميروبينيم',
    defaultDose: '1 g',
    defaultRoute: 'IV',
    defaultFrequency: 'Q8H (Extended 3h Infusion)',
    defaultDurationDays: 7,
    category: 'Beta-Lactam / Carbapenem',
    renalAdjustmentNotes: 'eGFR 26-50: 1g Q12H; eGFR 10-25: 500mg Q12H; eGFR < 10: 500mg Q24H',
    requiresTdm: false,
    standardIndication: 'Severe Sepsis, VAP, Intra-abdominal MDR Gram-Negative Coverage',
  },
  {
    id: 'tazocin',
    nameEn: 'Piperacillin / Tazobactam (Tazocin)',
    nameAr: 'بيبراسيلين / تازوباكتام (تازوسين)',
    defaultDose: '4.5 g',
    defaultRoute: 'IV',
    defaultFrequency: 'Q6H (or 4.5g Q8H 4h infusion)',
    defaultDurationDays: 7,
    category: 'Beta-Lactam / Carbapenem',
    renalAdjustmentNotes: 'CrCl 20-50: 3.375g Q6H; CrCl < 20: 2.25g Q6H; HD: 2.25g Q8H + 0.75g post-HD',
    requiresTdm: false,
    standardIndication: 'Hospital Acquired Pneumonia, Pseudomonal Sepsis, Intra-abdominal',
  },
  {
    id: 'vancomycin',
    nameEn: 'Vancomycin',
    nameAr: 'فانكومايسين',
    defaultDose: '1 g (15-20 mg/kg)',
    defaultRoute: 'IV',
    defaultFrequency: 'Q12H (Slow 2h infusion)',
    defaultDurationDays: 7,
    category: 'Glycopeptide / Lipopeptide',
    renalAdjustmentNotes: 'Strict TDM required. Adjust interval based on trough and eGFR (Q24H or Q48H in renal impairment)',
    requiresTdm: true,
    tdmTarget: 'Trough: 15 - 20 mcg/mL (AUC/MIC: 400 - 600)',
    standardIndication: 'MRSA Sepsis, Catheter-Related Bloodstream Infection (CRBSI), Meningitis',
  },
  {
    id: 'colistin',
    nameEn: 'Colistin (Colistimethate Sodium)',
    nameAr: 'كوليستين (مضاد البكتيريا المقاومة)',
    defaultDose: '3 MIU (Loading: 9 MIU)',
    defaultRoute: 'IV',
    defaultFrequency: 'Q8H',
    defaultDurationDays: 10,
    category: 'Polymyxin',
    renalAdjustmentNotes: 'CrCl 30-50: 2-3 MIU Q12H; CrCl 10-30: 1.5-2 MIU Q12-24H; Monitor Nephrotoxicity',
    requiresTdm: false,
    standardIndication: 'Carbapenem-Resistant Acinetobacter baumannii (CRAB) / CRE Sepsis',
  },
  {
    id: 'ceftriaxone',
    nameEn: 'Ceftriaxone (Rocephin)',
    nameAr: 'سيفترياكسون',
    defaultDose: '2 g',
    defaultRoute: 'IV',
    defaultFrequency: 'Q24H (Q12H for CNS/Meningitis)',
    defaultDurationDays: 5,
    category: 'Beta-Lactam / Carbapenem',
    renalAdjustmentNotes: 'No adjustment needed in renal failure (biliary excretion). Max 2g/day if combined renal+hepatic failure',
    requiresTdm: false,
    standardIndication: 'Community-Acquired Pneumonia, Pyelonephritis, Meningitis, Biliary Sepsis',
  },
  {
    id: 'levofloxacin',
    nameEn: 'Levofloxacin (Tavanic)',
    nameAr: 'ليفوفلوكساسين',
    defaultDose: '750 mg',
    defaultRoute: 'IV',
    defaultFrequency: 'Q24H',
    defaultDurationDays: 7,
    category: 'Fluoroquinolone',
    renalAdjustmentNotes: 'CrCl 20-49: 750mg Q48H or 500mg initial then 250mg Q24H; CrCl < 20: 750mg initial then 500mg Q48H',
    requiresTdm: false,
    standardIndication: 'Atypical & Legionella Pneumonia, Complicated UTI, Severe CAP',
  },
  {
    id: 'linezolid',
    nameEn: 'Linezolid (Zyvox)',
    nameAr: 'لينيزوليد (زيفوكس)',
    defaultDose: '600 mg',
    defaultRoute: 'IV',
    defaultFrequency: 'Q12H',
    defaultDurationDays: 7,
    category: 'Other',
    renalAdjustmentNotes: 'No dose adjustment required for renal impairment. Monitor platelets for myelosuppression if > 14 days',
    requiresTdm: false,
    standardIndication: 'MRSA / VRE Pneumonia, Skin & Soft Tissue Infection with Vancomycin intolerance',
  },
  {
    id: 'amikacin',
    nameEn: 'Amikacin',
    nameAr: 'أميكاسين',
    defaultDose: '1 g (15-20 mg/kg once daily)',
    defaultRoute: 'IV',
    defaultFrequency: 'Q24H',
    defaultDurationDays: 5,
    category: 'Aminoglycoside',
    renalAdjustmentNotes: 'Dose by extended interval. Trough level < 5 mcg/mL; Peak 20-30 mcg/mL. High nephro/ototoxicity vigilance',
    requiresTdm: true,
    tdmTarget: 'Trough < 2.5 - 5 mcg/mL, Peak 25 - 35 mcg/mL',
    standardIndication: 'Synergistic therapy for Gram-Negative Septic Shock / MDR Pseudomonas',
  },
  {
    id: 'fluconazole',
    nameEn: 'Fluconazole (Diflucan)',
    nameAr: 'فلوكونازول (ديفلوكان)',
    defaultDose: '400 mg (Loading: 800 mg)',
    defaultRoute: 'IV',
    defaultFrequency: 'Q24H',
    defaultDurationDays: 14,
    category: 'Antifungal',
    renalAdjustmentNotes: 'CrCl ≤ 50 mL/min (no HD): reduce dose by 50% (200mg Q24H); HD: full dose after dialysis',
    requiresTdm: false,
    standardIndication: 'Invasive Candidiasis, Candidemia, Fungal Prophylaxis in high-risk ICU',
  },
  {
    id: 'caspofungin',
    nameEn: 'Caspofungin (Cancidas)',
    nameAr: 'كاسبوفنجين',
    defaultDose: '50 mg (Loading: 70 mg Day 1)',
    defaultRoute: 'IV',
    defaultFrequency: 'Q24H',
    defaultDurationDays: 14,
    category: 'Antifungal',
    renalAdjustmentNotes: 'No renal dose adjustment. Moderate hepatic impairment (Child-Pugh 7-9): 35 mg Q24H after 70mg loading',
    requiresTdm: false,
    standardIndication: 'Empirical treatment in febrile neutropenic patients, Invasive Aspergillosis / Candidiasis',
  },
  {
    id: 'tigecycline',
    nameEn: 'Tigecycline (Tygacil)',
    nameAr: 'تيجيسيكلين (تايجاسيل)',
    defaultDose: '50 mg (Loading: 100 mg Day 1)',
    defaultRoute: 'IV',
    defaultFrequency: 'Q12H',
    defaultDurationDays: 7,
    category: 'Other',
    renalAdjustmentNotes: 'No renal adjustment needed. Avoid in bacteremia (rapid tissue distribution / low serum levels)',
    requiresTdm: false,
    standardIndication: 'Complicated Intra-Abdominal Infections, MDR Acinetobacter & ESBL soft tissue coverage',
  },
  {
    id: 'metronidazole',
    nameEn: 'Metronidazole (Flagyl)',
    nameAr: 'مترونيدازول (فلاجيل)',
    defaultDose: '500 mg',
    defaultRoute: 'IV',
    defaultFrequency: 'Q8H',
    defaultDurationDays: 7,
    category: 'Other',
    renalAdjustmentNotes: 'CrCl < 10: 50% dose. Severe hepatic impairment: reduce dose by 50%',
    requiresTdm: false,
    standardIndication: 'Anaerobic coverage, Intra-abdominal sepsis, Clostridioides difficile, Aspiration pneumonia',
  },
  {
    id: 'cefepime',
    nameEn: 'Cefepime (Maxipime)',
    nameAr: 'سيفيبيم',
    defaultDose: '2 g',
    defaultRoute: 'IV',
    defaultFrequency: 'Q8H',
    defaultDurationDays: 7,
    category: 'Beta-Lactam / Carbapenem',
    renalAdjustmentNotes: 'CrCl 30-50: 2g Q12H; CrCl 11-29: 1g Q12H; CrCl < 11: 500mg Q24H. Watch for Cefepime neurotoxicity!',
    requiresTdm: false,
    standardIndication: 'Pseudomonas Aeruginosa, Febrile Neutropenia, Nosocomial Sepsis',
  },
  {
    id: 'azithromycin',
    nameEn: 'Azithromycin (Zithromax)',
    nameAr: 'أزيثروميسين',
    defaultDose: '500 mg',
    defaultRoute: 'IV',
    defaultFrequency: 'Q24H',
    defaultDurationDays: 3,
    category: 'Macrolide',
    renalAdjustmentNotes: 'No dose adjustment in renal impairment. Monitor QTc interval on telemetry monitor',
    requiresTdm: false,
    standardIndication: 'Atypical coverage for Severe CAP (Legionella, Mycoplasma, Chlamydia)',
  },
];

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  language: 'en',
  features: {
    enableBedMatrix: true,
    enableSbarHandover: true,
    enableClinicalNotes: true,
    enableArchiveSearch: true,
    enableAdmissions: true,
    enableTelemetryVitals: true,
    enableVentilatorParameters: true,
    enableInfusionPumps: true,
    enableFluidBalance: true,
    enableAntibioticsCard: true,
    enableLabFlowsheet: true,
    enableInvestigations: true,
    enableAiLabScanner: true,
    enableBedTransferAndSwap: true,
    enableBedIsolationControls: true,
    enableAcuityLevels: true,
    enableCodeStatus: true,
    enableSha256Addendums: true,
    enableAudioAlarms: true,
    enablePushNotifications: true,
    enableCloudSync: true,
    enableMortalityAutoPurge: true,
  },
  unit: {
    unitName: 'Soli Medical MICU',
    unitSubtitle: 'ICU-Sync 6-Pod',
    shiftName: 'Night Shift (07:00 - 19:00)',
    totalBedsCount: 6,
    refreshIntervalSeconds: 15,
  },
  labCategories: [
    {
      id: 'cbc',
      nameEn: 'Complete Blood Count (CBC)',
      nameAr: 'صورة الدم كاملة (CBC)',
      parameters: [
        { id: 'hb', name: 'Hb Hemoglobin', unit: 'g/dL', normalRange: '12.0 - 16.0' },
        { id: 'plt', name: 'Platelets PLT', unit: 'k/uL', normalRange: '150 - 450' },
        { id: 'wbc', name: 'WBCs', unit: 'k/uL', normalRange: '4.0 - 11.0' },
        { id: 'hct', name: 'Hematocrit Hct', unit: '%', normalRange: '36.0 - 50.0' },
        { id: 'diff', name: 'WBC Differential', unit: '%', normalRange: '--' },
        { id: 'typeAnemia', name: 'Type of Anemia', unit: '', normalRange: '--' },
      ],
    },
    {
      id: 'chemistry',
      nameEn: 'Chemistry & Kidney Profile',
      nameAr: 'الكيمياء ووظائف الكلى',
      parameters: [
        { id: 'urea', name: 'Urea', unit: 'mg/dL', normalRange: '15 - 45' },
        { id: 'creat', name: 'Creatinine', unit: 'mg/dL', normalRange: '0.7 - 1.3' },
        { id: 'uricAcid', name: 'Uric Acid', unit: 'mg/dL', normalRange: '3.5 - 7.2' },
        { id: 'bun', name: 'BUN', unit: 'mg/dL', normalRange: '7 - 20' },
      ],
    },
    {
      id: 'electrolytes',
      nameEn: 'Serum Electrolytes',
      nameAr: 'الأملاح والأيونات',
      parameters: [
        { id: 'na', name: 'Sodium Na', unit: 'mEq/L', normalRange: '135 - 145' },
        { id: 'k', name: 'Potassium K', unit: 'mEq/L', normalRange: '3.5 - 5.0' },
        { id: 'ca', name: 'Calcium Ca', unit: 'mg/dL', normalRange: '8.5 - 10.5' },
        { id: 'phos', name: 'Phos', unit: 'mg/dL', normalRange: '2.5 - 4.5' },
        { id: 'mg', name: 'Magnesium Mg', unit: 'mg/dL', normalRange: '1.5 - 2.5' },
      ],
    },
    {
      id: 'abg',
      nameEn: 'Arterial Blood Gas (ABG)',
      nameAr: 'غازات الدم الشرياني (ABG)',
      parameters: [
        { id: 'ph', name: 'pH', unit: '', normalRange: '7.35 - 7.45' },
        { id: 'pco2', name: 'pCO₂', unit: 'mmHg', normalRange: '35 - 45' },
        { id: 'po2', name: 'pO₂', unit: 'mmHg', normalRange: '80 - 100' },
        { id: 'hco3', name: 'HCO₃', unit: 'mmol/L', normalRange: '22 - 26' },
        { id: 'be', name: 'Base Excess', unit: 'mmol/L', normalRange: '-2 to +2' },
        { id: 'lactate', name: 'Lactate', unit: 'mmol/L', normalRange: '0.5 - 2.0' },
      ],
    },
    {
      id: 'coagulation',
      nameEn: 'Coagulation Panel',
      nameAr: 'تخثر الدم والسيولة',
      parameters: [
        { id: 'inr', name: 'INR', unit: 'ratio', normalRange: '0.8 - 1.2' },
        { id: 'fib', name: 'Fibrinogen', unit: 'mg/dL', normalRange: '200 - 400' },
        { id: 'pt', name: 'PT', unit: 'sec', normalRange: '11.0 - 13.5' },
        { id: 'ptt', name: 'PTT', unit: 'sec', normalRange: '25 - 35' },
      ],
    },
    {
      id: 'lfts',
      nameEn: 'Liver Function Tests (LFTs)',
      nameAr: 'وظائف الكبد والأنزيمات (LFTs)',
      parameters: [
        { id: 'totalBili', name: 'Tot Bilirubin', unit: 'mg/dL', normalRange: '0.2 - 1.2' },
        { id: 'alb', name: 'Albumin', unit: 'g/dL', normalRange: '3.5 - 5.0' },
        { id: 'alt', name: 'ALT', unit: 'U/L', normalRange: '7 - 56' },
        { id: 'ast', name: 'AST', unit: 'U/L', normalRange: '5 - 40' },
        { id: 'alp', name: 'ALP', unit: 'U/L', normalRange: '44 - 147' },
        { id: 'ggt', name: 'GGT', unit: 'U/L', normalRange: '9 - 48' },
      ],
    },
    {
      id: 'biomarkers',
      nameEn: 'Pancreatic & Cardiac Biomarkers',
      nameAr: 'أنزيمات البنكرياس والقلب والمؤشرات',
      parameters: [
        { id: 'troponin', name: 'Troponin', unit: 'ng/mL', normalRange: '< 0.04' },
        { id: 'crp', name: 'CRP', unit: 'mg/L', normalRange: '< 5.0' },
        { id: 'amylase', name: 'Amylase', unit: 'U/L', normalRange: '30 - 110' },
        { id: 'lipase', name: 'Lipase', unit: 'U/L', normalRange: '10 - 140' },
      ],
    }
  ],
  infusionDrugs: DEFAULT_INFUSION_DRUGS,
  ventilatorModes: DEFAULT_VENTILATOR_MODES,
  fluidCategories: DEFAULT_FLUID_CATEGORIES,
  antibioticsPresets: DEFAULT_ANTIBIOTIC_PRESETS,
  sbarFields: [], // We'll leave it empty to use hardcoded defaults if not overridden, or populate it
  lastUpdated: new Date().toISOString(),
};

export const DEFAULT_SBAR_FIELDS: SbarFieldConfig[] = [
  { id: 'situation', labelEn: 'Situation (Patient, Bed, Diagnosis)', labelAr: 'الموقف الحالي، السرير والتشخيص', section: 'S', isRequired: true, order: 1 },
  { id: 'background', labelEn: 'Background (History, Hospital Course)', labelAr: 'الخلفية الطبية، التاريخ المرضي', section: 'B', isRequired: true, order: 2 },
  { id: 'hemodynamics', labelEn: 'Hemodynamics & Cardiovascular', labelAr: 'الدورة الدموية والقلب', section: 'A', isRequired: true, order: 3 },
  { id: 'pulmonary', labelEn: 'Pulmonary & Airway', labelAr: 'التنفس والمجرى الهوائي', section: 'A', isRequired: true, order: 4 },
  { id: 'metabolic', labelEn: 'Metabolic & Renal', labelAr: 'الأيض والكلى (السوائل)', section: 'A', isRequired: true, order: 5 },
  { id: 'neurology', labelEn: 'Neurology, Pain & Sedation', labelAr: 'الأعصاب، الألم والتهدئة', section: 'A', isRequired: true, order: 6 },
  { id: 'infectious', labelEn: 'Infectious & GI', labelAr: 'العدوى والجهاز الهضمي', section: 'A', isRequired: true, order: 7 },
  { id: 'recommendation', labelEn: 'Recommendation & Plan', labelAr: 'التوصيات والخطة العلاجية', section: 'R', isRequired: true, order: 8 },
];
