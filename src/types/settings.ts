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

export interface SystemSettings {
  language: 'en' | 'ar';
  features: SystemFeatureFlags;
  unit: UnitCustomization;
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
  lastUpdated: new Date().toISOString(),
};
