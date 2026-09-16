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

export interface SystemSettings {
  language: 'en' | 'ar';
  features: SystemFeatureFlags;
  unit: UnitCustomization;
  labCategories?: LabCategoryTemplate[];
  lastUpdated: string;
}

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
  lastUpdated: new Date().toISOString(),
};
