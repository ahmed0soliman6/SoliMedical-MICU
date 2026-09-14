import { useSystemSettings } from './SettingsContext.tsx';

export type Language = 'en' | 'ar';

export const translations = {
  // Navigation & Core Titles
  appTitle: {
    en: 'Soli Medical MICU',
    ar: 'وحدة العناية المركزة الباطنية Soli Medical',
  },
  appSubtitle: {
    en: 'ICU-Sync Central Telemetry Station',
    ar: 'محطة المراقبة السريرية والقياس عن بعد ICU-Sync',
  },
  bedMatrix: {
    en: 'Bed Matrix',
    ar: 'شبكة الأسِرّة (Bed Matrix)',
  },
  sbarHandover: {
    en: 'Shift Handover (SBAR)',
    ar: 'تسليم المناوبة (SBAR Handover)',
  },
  clinicalNotes: {
    en: 'Clinical Notes',
    ar: 'الملاحظات السريرية (Clinical Notes)',
  },
  archiveSearch: {
    en: 'Patient Archive',
    ar: 'أرشيف المرضى (Archive Search)',
  },
  settings: {
    en: 'System Settings',
    ar: 'إعدادات النظام (Settings)',
  },
  admitPatient: {
    en: 'Admit Patient',
    ar: 'إدخال مريض جديد (Admit Patient)',
  },

  // Bed Status
  available: {
    en: 'Available',
    ar: 'شاغر ومتاح (Available)',
  },
  occupied: {
    en: 'Occupied',
    ar: 'مشغول (Occupied)',
  },
  decontaminating: {
    en: 'Decontaminating',
    ar: 'قيد التعقيم والتطهير (Decontaminating)',
  },
  transferPending: {
    en: 'Transfer Pending',
    ar: 'بانتظار النقل (Transfer Pending)',
  },
  maintenance: {
    en: 'Maintenance',
    ar: 'صيانة (Maintenance)',
  },

  // Clinical Metrics & Acronyms
  mapBp: {
    en: 'MAP / BP',
    ar: 'الضغط الشرياني MAP / BP',
  },
  heartRate: {
    en: 'HR',
    ar: 'نبض القلب HR',
  },
  spo2Fio2: {
    en: 'SpO₂ / FiO₂',
    ar: 'الأكسجة SpO₂ / FiO₂',
  },
  gcsRass: {
    en: 'GCS / RASS',
    ar: 'الوعي GCS / RASS',
  },
  ventilator: {
    en: 'Mechanical Vent & ABG',
    ar: 'التنفس الصناعي وغازات الدم (Vent & ABG)',
  },
  infusionPumps: {
    en: 'Infusion Pumps & Lines',
    ar: 'مضخات المحاليل والأدوية (Infusion Pumps)',
  },
  fluidBalance: {
    en: 'Fluid Balance & MTP (24h)',
    ar: 'ميزان السوائل ونقل الدم (Fluids & MTP)',
  },
  disposition: {
    en: 'Discharge / Transfer',
    ar: 'إنهاء الإقامة / النقل (Disposition)',
  },

  // Actions & Buttons
  openFlowsheet: {
    en: 'Open Bedside Flowsheet',
    ar: 'فتح السجل السريري للسرير',
  },
  quickVitals: {
    en: 'Quick Vitals Entry',
    ar: 'تسجيل علامات حيوية سريعة',
  },
  recordVitals: {
    en: 'Record Vitals',
    ar: 'تسجيل علامات حيوية',
  },
  signHandover: {
    en: 'Sign SBAR Handover',
    ar: 'توقيع وتسليم SBAR',
  },
  addNote: {
    en: 'Add Clinical Note',
    ar: 'إضافة ملاحظة طبية',
  },
  addAddendum: {
    en: 'Sign Addendum',
    ar: 'إضافة ملحق مشفر SHA-256',
  },
  saveChanges: {
    en: 'Save Changes',
    ar: 'حفظ التعديلات',
  },
  cancel: {
    en: 'Cancel',
    ar: 'إلغاء',
  },
  close: {
    en: 'Close',
    ar: 'إغلاق',
  },
  exportPdf: {
    en: 'Export SBAR PDF',
    ar: 'تصدير تقرير SBAR بصيغة PDF',
  },
  search: {
    en: 'Search by MRN, Name, or Diagnosis...',
    ar: 'بحث برقم الملف الطبي MRN أو الاسم أو التشخيص...',
  },

  // Alarms & Badges
  criticalMapWarning: {
    en: 'CRITICAL HYPOTENSION: MAP < 65 mmHg',
    ar: 'تنبيه حرج: هبوط الضغط الشرياني MAP < 65 mmHg',
  },
  criticalSpo2Warning: {
    en: 'CRITICAL HYPOXEMIA: SpO2 < 88%',
    ar: 'تنبيه حرج: نقص أكسجة حاد SpO2 < 88%',
  },
  waitingVitals: {
    en: 'Awaiting initial telemetry stream...',
    ar: 'في انتظار أول قراءة للعلامات الحيوية...',
  },
  noActivePatients: {
    en: 'No occupied beds currently in this pod.',
    ar: 'لا يوجد مرضى منومين حالياً في هذا الجناح.',
  },

  // Code Status & Acuity
  fullCpr: {
    en: 'FULL CODE (CPR)',
    ar: 'إنعاش كامل (Full CPR)',
  },
  dnr: {
    en: 'DO NOT RESUSCITATE (DNR)',
    ar: 'عدم إنعاش (DNR)',
  },
  criticalStat: {
    en: 'CRITICAL STAT',
    ar: 'حالة حرجة جداً (CRITICAL STAT)',
  },
  urgent: {
    en: 'URGENT',
    ar: 'عاجل (URGENT)',
  },
  stableIcu: {
    en: 'STABLE ICU',
    ar: 'مستقر بالعناية (STABLE ICU)',
  },
  stepdownReady: {
    en: 'STEPDOWN READY',
    ar: 'جاهز للنقل للعناية المتوسطة (STEPDOWN)',
  },

  // SBAR Sections
  situation: {
    en: 'S - Situation',
    ar: 'S - الوضع السريري الحالي (Situation)',
  },
  background: {
    en: 'B - Background',
    ar: 'B - الخلفية المرضية والتاريخ (Background)',
  },
  assessment: {
    en: 'A - Assessment',
    ar: 'A - التقييم السريري الحالي (Assessment)',
  },
  recommendation: {
    en: 'R - Recommendation',
    ar: 'R - الخطة والتوصيات (Recommendation)',
  },

  // Settings & Features
  settingsTitle: {
    en: 'System & Feature Flags Configuration',
    ar: 'تكوين النظام والتحكم بالميزات (Feature Flags)',
  },
  languageSelection: {
    en: 'System Language',
    ar: 'لغة النظام (Language)',
  },
  englishLanguage: {
    en: 'English (Pure Medical & Abbreviations)',
    ar: 'الإنجليزية (English)',
  },
  arabicLanguage: {
    en: 'Arabic (العربية مع الاختصارات الطبية)',
    ar: 'العربية (مع الاختصارات الإنجليزية)',
  },
  unitCustomization: {
    en: 'Unit & Station Customization',
    ar: 'تخصيص بيانات وحدة العناية',
  },
  featureControl: {
    en: 'Dynamic Clinical Feature Flags',
    ar: 'التحكم بالميزات والوحدات السريرية (Feature Flags)',
  },
  resetDefaults: {
    en: 'Reset to Factory Defaults',
    ar: 'استعادة الإعدادات الافتراضية',
  },
};

export type TranslationKey = keyof typeof translations;

export function useTranslation() {
  const { settings, updateSettings } = useSystemSettings();
  const lang: Language = settings.language || 'en';

  const t = (key: TranslationKey): string => {
    const item = translations[key];
    if (!item) return key;
    return item[lang] || item.en || key;
  };

  const setLanguage = (newLang: Language) => {
    updateSettings({ language: newLang });
  };

  const isRTL = lang === 'ar';

  return { t, lang, setLanguage, isRTL };
}
