import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sliders, 
  Layers, 
  Activity, 
  ShieldCheck, 
  BellRing, 
  Cloud, 
  RotateCcw, 
  Check, 
  Wind, 
  Syringe, 
  Droplet, 
  Search, 
  UserPlus,
  Save,
  Languages,
  ChevronDown,
  ChevronUp,
  Settings,
  Users,
  FlaskConical,
  Microscope,
  ArrowRightLeft,
  ShieldAlert,
  FolderOpen,
  FolderMinus,
  Sparkles,
  Scan,
  CheckCircle2,
  Camera,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Pill,
  FileCheck2,
  Database,
  RefreshCw,
  Loader2,
  CloudOff,
  Bell,
  Wrench,
  MessageSquare
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { StaffRole } from '../types/schema.ts';
import { SystemFeatureFlags } from '../types/settings.ts';
import { ClinicalOptionsManager } from './ClinicalOptionsManager.tsx';
import { NotificationSettingsCard } from './NotificationSettingsCard.tsx';
import { BedOperationsSettingsCard } from './BedOperationsSettingsCard.tsx';
import { SoliLogo } from './SoliLogo.tsx';
import { clearLocalBrowserDataAndSyncFromCloud, clearAllCloudAndLocalDataAndReset } from '../services/firebase.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUserManagement: () => void;
  onBedUpdated?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpenUserManagement, onBedUpdated }) => {
  const { settings, toggleFeature, updateSettings, resetToDefaults } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  
  // Only system admin or super admin can see and trigger cloud reset / purge
  const isAdmin = currentUser?.role === StaffRole.ADMIN || currentUser?.isSuperAdmin === true;
  
  // All cards are folded/collapsed by default (مطوية أسفل بعضها)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    modules: false,
    bedside: false,
    alerts: false,
    rbac: false,
    clinicalCatalogs: false,
    labsConfig: false,
    language: false,
    unit: false,
    databaseGov: false,
  });

  const [unitForm, setUnitForm] = useState(settings.unit);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [isResettingCloud, setIsResettingCloud] = useState(false);
  const [dbActionResult, setDbActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [confirmModalType, setConfirmModalType] = useState<'CLEAR_LOCAL' | 'RESET_CLOUD' | null>(null);

  if (!isOpen) return null;

  const handleClearLocalBrowserData = async () => {
    setIsSyncingLocal(true);
    setDbActionResult(null);
    try {
      const res = await clearLocalBrowserDataAndSyncFromCloud();
      setDbActionResult(res);
      setConfirmModalType(null);
      if (res.success) {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      setDbActionResult({ success: false, message: err.message || 'Error occurred' });
    } finally {
      setIsSyncingLocal(false);
    }
  };

  const handleResetCloudAndLocalData = async () => {
    setIsResettingCloud(true);
    setDbActionResult(null);
    try {
      const res = await clearAllCloudAndLocalDataAndReset();
      setDbActionResult(res);
      setConfirmModalType(null);
      if (res.success) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      setDbActionResult({ success: false, message: err.message || 'Error occurred' });
    } finally {
      setIsResettingCloud(false);
    }
  };

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = () => {
    setOpenSections({
      modules: true,
      bedside: true,
      alerts: true,
      notificationsHub: true,
      rbac: true,
      clinicalCatalogs: true,
      labsConfig: true,
      language: true,
      unit: true,
      databaseGov: true,
    });
  };

  const collapseAll = () => {
    setOpenSections({
      modules: false,
      bedside: false,
      alerts: false,
      rbac: false,
      clinicalCatalogs: false,
      labsConfig: false,
      language: false,
      unit: false,
      databaseGov: false,
    });
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ unit: unitForm });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const featureItems: {
    key: keyof SystemFeatureFlags;
    category: 'modules' | 'bedside' | 'alerts';
    labelAr: string;
    labelEn: string;
    descriptionAr: string;
    descriptionEn: string;
    icon: any;
    color: string;
  }[] = [
    {
      key: 'enableBedMatrix',
      category: 'modules',
      labelAr: 'شبكة الأسِرّة الستة (Central 6-Bed Grid)',
      labelEn: 'Bed Matrix Console',
      descriptionAr: 'لوحة المراقبة المركزية لحالة جميع أسِرّة العناية الستة.',
      descriptionEn: 'Main central telemetry overview of all 6 ICU beds.',
      icon: Layers,
      color: 'text-teal-400',
    },
    {
      key: 'enableArchiveSearch',
      category: 'modules',
      labelAr: 'أرشيف المرضى والبحث الطبي (MRN Patient Archive)',
      labelEn: 'Patient & MRN Archive Search',
      descriptionAr: 'محرك بحث متقدم وسجل أرشيف المرضى الدائم برقم الملف الطبي (MRN) أو الاسم.',
      descriptionEn: 'Fast historical query and permanent clinical archive by Medical Record Number (MRN) or patient name.',
      icon: Search,
      color: 'text-blue-400',
    },
    {
      key: 'enableClinicalChat',
      category: 'modules',
      labelAr: 'الدردشة والاتصال السريري (Clinical Team Chat)',
      labelEn: 'Clinical Team Chat & Consultations',
      descriptionAr: 'قناة المحادثات والتواصل اللحظي الآمن بين أطباء وتمريض العناية المركزة.',
      descriptionEn: 'Real-time encrypted messaging channel between ICU clinical staff and physicians.',
      icon: MessageSquare,
      color: 'text-cyan-400',
    },
    {
      key: 'enableSystemSettingsPage',
      category: 'modules',
      labelAr: 'لوحة إعدادات وتخصيص النظام (System Settings)',
      labelEn: 'System Settings & Customization',
      descriptionAr: 'التحكم في إظهار أو إخفاء زر وقائمة الإعدادات والتخصيصات العامة.',
      descriptionEn: 'Control the visibility of system settings and configuration shortcuts.',
      icon: Sliders,
      color: 'text-amber-400',
    },
    {
      key: 'enableAdmissions',
      category: 'modules',
      labelAr: 'إدخال مرضى جدد (Patient Admission)',
      labelEn: 'Patient Admission Wizard',
      descriptionAr: 'إمكانية تسكين وتوزيع مرضى جدد مباشرة على الأسِرّة الشاغرة.',
      descriptionEn: 'Direct clinical intake and bed allocation workflows.',
      icon: UserPlus,
      color: 'text-emerald-400',
    },
    {
      key: 'enableBedTransferAndSwap',
      category: 'modules',
      labelAr: 'نقل المرضى وتبديل الأسِرّة (Safe Transfer & Swap)',
      labelEn: 'Atomic Bed Transfer & Bed Swap',
      descriptionAr: 'عمليات نقل المريض وتبديل سريرين مشغولين بأمان عبر معاملات ذرية مشفرة.',
      descriptionEn: 'Atomic Firestore operations for safe patient relocation and cross-bed exchanges.',
      icon: ArrowRightLeft,
      color: 'text-purple-400',
    },
    {
      key: 'enableBedIsolationControls',
      category: 'modules',
      labelAr: 'تدابير العزل الطبي وحالة السرير (Isolation & Status)',
      labelEn: 'Isolation Precautions & Bed Availability',
      descriptionAr: 'التحكم بحالات العزل (تلامس، رذاذ، عزل هوائي) أو إخراج السرير للصيانة.',
      descriptionEn: 'Contact, droplet, and airborne isolation controls or scheduled maintenance lockout.',
      icon: ShieldAlert,
      color: 'text-amber-400',
    },
    {
      key: 'enableLabFlowsheet',
      category: 'bedside',
      labelAr: 'جدول ومسار التحاليل اليومية (Lab Flowsheet & Trends)',
      labelEn: 'Daily Lab Flowsheet & Trend History',
      descriptionAr: 'عرض تسلسل التحاليل التراكمي (مثل HG 5>7>8.5>8) وعرض السجلات عند النقر.',
      descriptionEn: 'Cumulative chronological trend display for all lab panels with drill-down audit history.',
      icon: FlaskConical,
      color: 'text-emerald-400',
    },
    {
      key: 'enableAiLabScanner',
      category: 'bedside',
      labelAr: 'المسح الضوئي الذكي للتحاليل (AI Lab OCR Scanner)',
      labelEn: 'AI Optical Lab Scanner (ABG & CBC)',
      descriptionAr: 'تصوير وقراءة أوراق وتحاليل غازات الدم ABG وصورة الدم CBC بالذكاء الاصطناعي وتعبئة الخانات تلقائياً.',
      descriptionEn: 'Photograph lab printouts or slips to extract ABG, CBC and biochemistry automatically into flowsheet records.',
      icon: Camera,
      color: 'text-fuchsia-400',
    },
    {
      key: 'enableInvestigations',
      category: 'bedside',
      labelAr: 'الفحوصات والأشعات وموجات POCUS الصوتية',
      labelEn: 'Radiology, Investigations & POCUS',
      descriptionAr: 'متابعة وتوثيق أشعة الصدر المتنقلة، السونار القلبي والـ ECG.',
      descriptionEn: 'Bedside imaging studies, portable radiographs, echocardiograms, and ECGs.',
      icon: Microscope,
      color: 'text-indigo-400',
    },
    {
      key: 'enableAiInvestigationScanner',
      category: 'bedside',
      labelAr: 'المسح الضوئي الذكي للأشعة والتقارير (AI Radiology Scanner)',
      labelEn: 'AI Smart Radiology & Investigation Scanner',
      descriptionAr: 'مسح وتصوير تقارير الأشعة والـ ECG والموجات الصوتية واستخراج النتائج والانطباع الطبي وتسجيلها تلقائياً.',
      descriptionEn: 'Scan radiology reports, ECG strips, and ultrasound printouts with Gemini AI to auto-extract and log findings.',
      icon: Scan,
      color: 'text-teal-400',
    },
    {
      key: 'enableTelemetryVitals',
      category: 'bedside',
      labelAr: 'العلامات الحيوية والضغط الشرياني (Telemetry & MAP)',
      labelEn: 'Telemetry Vitals & MAP Monitoring',
      descriptionAr: 'مراقبة النبض، الضغط، الأكسجين، وحساب MAP تلقائياً.',
      descriptionEn: 'Realtime arterial pressure, heart rate, rhythm, SpO2, and MAP calculations.',
      icon: Activity,
      color: 'text-teal-400',
    },
    {
      key: 'enableSbarHandover',
      category: 'bedside',
      labelAr: 'بطاقة تسليم واستلام المناوبة (SBAR Shift Handover)',
      labelEn: 'SBAR Shift Handover Module',
      descriptionAr: 'بطاقة لتسجيل واستلام المناوبات الطبية للمريض وفق بروتوكول SBAR.',
      descriptionEn: 'Clinical shift handover management with mandatory SBAR protocol review.',
      icon: ShieldCheck,
      color: 'text-amber-400',
    },
    {
      key: 'enableClinicalNotes',
      category: 'bedside',
      labelAr: 'بطاقة الملاحظات الطبية وملحقاتها (Clinical Notes)',
      labelEn: 'Clinical Notes & Addendums',
      descriptionAr: 'بطاقة لتوثيق الملاحظات الطبية، والملحقات الموقعة إلكترونياً بختم SHA-256.',
      descriptionEn: 'Document and authenticate medical notes and immutable signed addendums.',
      icon: FileCheck2,
      color: 'text-blue-400',
    },
    {
      key: 'enableVentilatorParameters',
      category: 'bedside',
      labelAr: 'معايير التنفس الصناعي (Ventilator Parameters)',
      labelEn: 'Mechanical Ventilation Module',
      descriptionAr: 'متابعة أوضاع التهوية الميكانيكية (SIMV, PRVC, PSV) ومعايير FiO2 و PEEP.',
      descriptionEn: 'Ventilation modes, PEEP, FiO2, tidal volumes, and respiratory mechanics.',
      icon: Wind,
      color: 'text-cyan-400',
    },
    {
      key: 'enableInfusionPumps',
      category: 'bedside',
      labelAr: 'مضخات التسريب والأدوية الوعائية (Infusion Pumps)',
      labelEn: 'Vasoactive Infusion Lines',
      descriptionAr: 'متابعة خطوط أدوية الدورة الدموية ومضخات التسريب بالجرعات الدقيقة.',
      descriptionEn: 'Continuous vasoactive infusions, titration logs, and syringe pump tracking.',
      icon: Syringe,
      color: 'text-amber-400',
    },
    {
      key: 'enableFluidBalance',
      category: 'bedside',
      labelAr: 'ميزان السوائل 24 ساعة (24h Fluid Balance)',
      labelEn: '24-Hour Fluid Intake & Output',
      descriptionAr: 'حساب ومراقبة مدخلات ومخرجات السوائل والصافي اليومي.',
      descriptionEn: 'Hourly intake vs. output calculation with cumulative 24h balance.',
      icon: Droplet,
      color: 'text-sky-400',
    },
    {
      key: 'enableAntibioticsCard',
      category: 'bedside',
      labelAr: 'سجل وبروتوكول المضادات الحيوية (Antibiotics & Regimens)',
      labelEn: 'Antibiotics & Antimicrobial Stewardship',
      descriptionAr: 'بطاقة متابعة المضادات الحيوية، مدة العلاج DOT، وظائف الكلى، ومستويات الدواء TDM.',
      descriptionEn: 'Active antimicrobial courses, Day of Therapy counters, and TDM monitoring.',
      icon: Pill,
      color: 'text-amber-400',
    },
    {
      key: 'enableAcuityLevels',
      category: 'bedside',
      labelAr: 'شارة مستوى الخطورة السريرية (Acuity Badges)',
      labelEn: 'Clinical Acuity Badges (STAT / High / Stable)',
      descriptionAr: 'عرض مستويات الخطورة الملونة (STAT، مستقر، مراقبة مشددة).',
      descriptionEn: 'Visual triage indicators highlighting critical patients.',
      icon: ShieldCheck,
      color: 'text-red-400',
    },
    {
      key: 'enableCodeStatus',
      category: 'bedside',
      labelAr: 'حالة الإنعاش القلبي الرئوي (Code Status Badges)',
      labelEn: 'Resuscitation Code Status (CPR / DNR)',
      descriptionAr: 'إظهار شارات الإنعاش (Full CPR / DNR) لضمان الامتثال الطبي.',
      descriptionEn: 'Clear CPR and DNR indicators to ensure legal and clinical compliance.',
      icon: Activity,
      color: 'text-purple-400',
    },
    {
      key: 'enableSha256Addendums',
      category: 'bedside',
      labelAr: 'التشفير الرقمي للملحقات (SHA-256 Audit Trail)',
      labelEn: 'Cryptographic SHA-256 Audit Trail',
      descriptionAr: 'توليد بصمات تجزئة مشفرة لكل تعديل أو ملحق إكلينيكي.',
      descriptionEn: 'Zero-tamper immutable hashing for all clinical addendums.',
      icon: ShieldCheck,
      color: 'text-emerald-400',
    },
    {
      key: 'enableAudioAlarms',
      category: 'alerts',
      labelAr: 'الإنذارات الصوتية الطبية (IEC 60601-1-8 Alarms)',
      labelEn: 'Audible Medical Warning Alarms',
      descriptionAr: 'تشغيل نغمة إنذار الطوارئ الطبية عند تدهور المعايير الحيوية الحرجة.',
      descriptionEn: 'Synthesized ICU bedside audio tone triggers for STAT emergencies.',
      icon: BellRing,
      color: 'text-red-400',
    },
    {
      key: 'enablePushNotifications',
      category: 'alerts',
      labelAr: 'إشعارات النظام والأندرويد (Push Notifications)',
      labelEn: 'System & Android Push Notifications',
      descriptionAr: 'إرسال إشعارات طارئة لنظام التشغيل والهواتف الذكية.',
      descriptionEn: 'Browser and mobile notification triggers for critical telemetry alerts.',
      icon: BellRing,
      color: 'text-amber-400',
    },
    {
      key: 'enableCloudSync',
      category: 'alerts',
      labelAr: 'المزامنة السحابية اللحظية (Firebase Cloud Sync)',
      labelEn: 'Realtime Cloud Synchronization',
      descriptionAr: 'مزامنة السجلات والبيانات الحيوية سحابياً وفورياً بين جميع الأجهزة.',
      descriptionEn: 'Instant multi-device database synchronization powered by Firestore.',
      icon: Cloud,
      color: 'text-teal-400',
    },
    {
      key: 'enableExitProtection',
      category: 'alerts',
      labelAr: 'حماية منع الخروج العرضي (Accidental Exit Guard)',
      labelEn: 'Accidental Exit Protection',
      descriptionAr: 'تنبيه المستخدم وطلب التأكيد عند محاولة الرجوع بالمتصفح أو مغادرة المنظومة بالخطأ لحماية شاشات المراقبة السريرية الحية.',
      descriptionEn: 'Intercept accidental browser back exits with a confirmation modal to protect active telemetry monitoring.',
      icon: ShieldAlert,
      color: 'text-amber-400',
    },
  ];

  const sections = [
    {
      id: 'modules',
      labelAr: 'الموديولات والشاشات الرئيسية',
      labelEn: 'Core System Modules',
      badgeAr: '5 موديولات',
      badgeEn: '5 Modules',
      icon: Layers,
      items: featureItems.filter(f => f.category === 'modules')
    },
    {
      id: 'bedside',
      labelAr: 'خصائص ومكونات ملف السرير (Flowsheet)',
      labelEn: 'Bedside Clinical Flowsheet',
      badgeAr: '9 خصائص',
      badgeEn: '9 Features',
      icon: Activity,
      items: featureItems.filter(f => f.category === 'bedside')
    },
    {
      id: 'alerts',
      labelAr: 'الإنذارات، الإشعارات والمزامنة السحابية',
      labelEn: 'Alarms & Cloud Infrastructure',
      badgeAr: '4 ميزات',
      badgeEn: '4 Features',
      icon: BellRing,
      items: featureItems.filter(f => f.category === 'alerts')
    },
    {
      id: 'notificationsHub',
      labelAr: 'إدارة وتخصيص التنبيهات المرئية والصوتية (Notification Center)',
      labelEn: 'Visual & Audio Notifications Hub',
      badgeAr: 'تنبيهات مخصصة',
      badgeEn: 'Smart Alerts',
      icon: BellRing,
      isCustom: true
    },
    {
      id: 'clinicalCatalogs',
      labelAr: 'إدارة خيارات المضخات والتنفس وميزان السوائل (إضافة وحذف الخيارات)',
      labelEn: 'Infusion Pumps, Ventilator & Fluid Balance Catalogs (Add & Delete)',
      badgeAr: 'خيارات سريرية',
      badgeEn: 'Equipment & Drugs',
      icon: Droplet,
      isCustom: true
    },
    {
      id: 'language',
      labelAr: 'لغة المنظومة والترميز الطبي',
      labelEn: 'System Language & Medical Coding',
      badgeAr: 'العربية / الإنجليزية',
      badgeEn: 'EN / AR Mode',
      icon: Languages,
      isCustom: true
    },
    {
      id: 'bedOperations',
      labelAr: 'إدارة تشغيل وصيانة الأسِرّة (وضع خارج الخدمة / تفعيل)',
      labelEn: 'Bed Operations & Maintenance (Out of Service / Reactivate)',
      badgeAr: '6 أسِرّة',
      badgeEn: '6 Beds',
      icon: Wrench,
      isCustom: true
    },
    {
      id: 'unit',
      labelAr: 'بيانات الوحدة والمناوبة السريرية',
      labelEn: 'ICU Unit & Shift Configuration',
      badgeAr: 'بيانات الوحدة',
      badgeEn: 'Unit Config',
      icon: Sliders,
      isCustom: true
    },
    {
      id: 'databaseGov',
      labelAr: 'إدارة وتصفير بيانات المتصفح والسحابة (Cloud & Local Reset)',
      labelEn: 'Browser Cache & Cloud Data Reset',
      badgeAr: 'مسح وتصفير البيانات',
      badgeEn: 'Data Governance',
      icon: Database,
      isCustom: true
    }
  ];

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-300 pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Large Full-Width Settings Container */}
      <div 
        className="w-full max-w-6xl mx-auto bg-white dark:bg-[#0a1224] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl p-4 sm:p-7 text-slate-900 dark:text-slate-100 flex flex-col transition-colors"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Page Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800/80 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{lang === 'ar' ? 'مركز تخصيص وإعدادات المنظومة الشامل' : 'System Configuration Center'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                  v2.5 MICU
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'ar' 
                  ? 'إدارة مرنة لجميع الموديولات والخصائص السريرية والمزامنة السحابية والصلاحيات' 
                  : 'Modular clinical controls, flowsheet tabs, telemetry flags, and access governance'}
              </p>
            </div>
          </div>

          {/* Quick Accordion Actions: Expand All / Collapse All & Close */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={expandAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm"
              title={lang === 'ar' ? 'فتح جميع البطاقات' : 'Expand all cards'}
            >
              <FolderOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>{lang === 'ar' ? 'توسيع الكل' : 'Expand All'}</span>
            </button>

            <button
              type="button"
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-sm"
              title={lang === 'ar' ? 'طي جميع البطاقات' : 'Collapse all cards'}
            >
              <FolderMinus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{lang === 'ar' ? 'طي الكل' : 'Collapse All'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all active:scale-95 group cursor-pointer shadow-sm"
              title={lang === 'ar' ? 'العودة لشبكة الأسِرّة' : 'Close settings'}
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </div>

        {/* Collapsible Cards Stacked Vertically (البطاقات أسفل بعضها وتكون مطوية) */}
        <div className="space-y-4">
          {sections.map((section) => {
            const isExpanded = !!openSections[section.id];
            const Icon = section.icon;

            return (
              <div 
                key={section.id}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isExpanded 
                    ? 'bg-slate-50/70 dark:bg-[#0c1426] border-teal-500/40 shadow-md ring-1 ring-teal-500/20' 
                    : 'bg-white dark:bg-[#080d1a] border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-[#0a0f1c]'
                }`}
              >
                {/* Collapsible Card Trigger Header */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl border transition-colors ${
                      isExpanded 
                        ? 'bg-teal-100 dark:bg-teal-500/20 border-teal-300 dark:border-teal-500/40 text-teal-700 dark:text-teal-300' 
                        : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm sm:text-base font-bold transition-colors ${isExpanded ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                          {lang === 'ar' ? section.labelAr : section.labelEn}
                        </h3>
                        {section.badgeAr && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                            {lang === 'ar' ? section.badgeAr : section.badgeEn}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {lang === 'ar' ? section.labelEn : section.labelAr}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl transition-all ${
                      isExpanded ? 'bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 rotate-180' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                    }`}>
                      <ChevronDown className="w-5 h-5" />
                    </div>
                  </div>
                </button>

                {/* Card Collapsible Body */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                        {section.isCustom ? (
                          section.id === 'notificationsHub' ? (
                            <NotificationSettingsCard />
                          ) : section.id === 'language' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                              <button
                                type="button"
                                onClick={() => setLanguage('en')}
                                className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
                                  lang === 'en' 
                                    ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-500 text-teal-900 dark:text-teal-300 ring-1 ring-teal-500/30 shadow-sm' 
                                    : 'bg-white dark:bg-[#060a14] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="block font-black text-base">ENGLISH</span>
                                  {lang === 'en' && <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
                                </div>
                                <span className="text-xs opacity-75 mt-1 block">Strictly English International Medical Standard (LTR)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setLanguage('ar')}
                                className={`p-5 rounded-2xl border text-right transition-all cursor-pointer ${
                                  lang === 'ar' 
                                    ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-500 text-teal-900 dark:text-teal-300 ring-1 ring-teal-500/30 shadow-sm' 
                                    : 'bg-white dark:bg-[#060a14] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  {lang === 'ar' && <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
                                  <span className="block font-black text-base">العربية السريرية</span>
                                </div>
                                <span className="text-xs opacity-75 mt-1 block">واجهة معربة مع الحفاظ على الاختصارات الطبية (RTL)</span>
                              </button>
                            </div>
                          ) : section.id === 'clinicalCatalogs' ? (
                            <div className="mt-2">
                              <ClinicalOptionsManager />
                            </div>
                          ) : section.id === 'bedOperations' ? (
                            <BedOperationsSettingsCard onBedUpdated={onBedUpdated} />
                          ) : section.id === 'databaseGov' ? (
                            <div className="space-y-4 mt-2">
                              {dbActionResult && (
                                <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold ${
                                  dbActionResult.success 
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400' 
                                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-400'
                                }`}>
                                  {dbActionResult.success ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
                                  <span>{dbActionResult.message}</span>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* 1. Clear Browser Data & Re-sync from Cloud */}
                                <div className="p-5 rounded-2xl bg-white dark:bg-[#060a14] border border-teal-200 dark:border-teal-500/30 hover:border-teal-400 dark:hover:border-teal-500/50 transition-all flex flex-col justify-between gap-4 shadow-sm">
                                  <div>
                                    <div className="flex items-center gap-2.5 text-teal-700 dark:text-teal-400 font-bold mb-2">
                                      <RefreshCw className="w-5 h-5" />
                                      <h4 className="text-sm">
                                        {lang === 'ar' ? 'حذف بيانات المتصفح فقط واستعادتها من السحابة' : 'Clear Browser Data & Re-sync'}
                                      </h4>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                      {lang === 'ar'
                                        ? 'يمسح بيانات المرضى والأسِرّة المحفوظة مؤقتاً في هذا المتصفح فقط، ثم ينفذ إعادة جلب تلقائي لأحدث البيانات السحابية الحقيقية من فايربيس دون مس البيانات السحابية.'
                                        : 'Clears local IndexedDB browser cache for this device only, then re-syncs active patient states directly from Firestore Cloud.'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmModalType('CLEAR_LOCAL')}
                                    disabled={isSyncingLocal || isResettingCloud}
                                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/20 dark:hover:bg-teal-500/30 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 text-xs font-extrabold transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    {isSyncingLocal ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>{lang === 'ar' ? 'جاري مسح المتصفح وإعادة الجلب...' : 'Clearing & Re-syncing...'}</span>
                                      </>
                                    ) : (
                                      <>
                                        <RefreshCw className="w-4 h-4" />
                                        <span>{lang === 'ar' ? 'حذف بيانات المتصفح واستعادتها من السحابة' : 'Clear Browser Data & Re-sync'}</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                {/* 2. Reset All Cloud and Local Data (Restricted to System Admin Only) */}
                                {isAdmin ? (
                                  <div className="p-5 rounded-2xl bg-white dark:bg-[#060a14] border border-rose-200 dark:border-rose-500/30 hover:border-rose-400 dark:hover:border-rose-500/50 transition-all flex flex-col justify-between gap-4 shadow-sm">
                                    <div>
                                      <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-400 font-bold mb-2">
                                        <Trash2 className="w-5 h-5" />
                                        <h4 className="text-sm">
                                          {lang === 'ar' ? 'حذف البيانات من السحابة والمتصفح والبدء من جديد (خاص بمدير النظام)' : 'Purge All Cloud & Browser Data (Admin Only)'}
                                        </h4>
                                      </div>
                                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {lang === 'ar'
                                          ? 'تنبيه هام: يحذف كافة سجلات المرضى والأسِرّة نهائياً من فايربيس والمتصفح، ويعيد تشغيل المنظومة ببيانات طبية سريرية حقيقية للبدء من جديد.'
                                          : 'WARNING: Permanently deletes all patient records from Firestore Cloud and local browser cache, resetting the unit with clean, real clinical ICU datasets.'}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmModalType('RESET_CLOUD')}
                                      disabled={isSyncingLocal || isResettingCloud}
                                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 text-xs font-extrabold transition-all cursor-pointer disabled:opacity-50"
                                    >
                                      {isResettingCloud ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          <span>{lang === 'ar' ? 'جاري حذف السحابة وتصفير النظام...' : 'Purging Cloud & Resetting...'}</span>
                                        </>
                                      ) : (
                                        <>
                                          <CloudOff className="w-4 h-4" />
                                          <span>{lang === 'ar' ? 'حذف البيانات من السحابة والمتصفح والبدء من جديد' : 'Delete All Cloud & Local Data'}</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-center gap-2 text-slate-500 dark:text-slate-400">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                      <ShieldCheck className="w-4 h-4 text-teal-500" />
                                      <span>{lang === 'ar' ? 'صلاحيات الحذف السحابي مقيدة' : 'Cloud Purge Restricted'}</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed">
                                      {lang === 'ar'
                                        ? 'إجراءات مسح السحابة وإعادة تصفير النظام متاحة حصرياً لحساب مدير النظام (System Administrator).'
                                        : 'Cloud purge and system reset operations are strictly restricted to System Administrators.'}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Confirmation Modal Overlay */}
                              {confirmModalType && (
                                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                  <div className="bg-white dark:bg-[#0a1224] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl text-slate-900 dark:text-white">
                                    <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                                      <AlertTriangle className="w-7 h-7 flex-shrink-0" />
                                      <h3 className="text-base font-extrabold">
                                        {confirmModalType === 'CLEAR_LOCAL'
                                          ? (lang === 'ar' ? 'تأكيد مسح بيانات المتصفح' : 'Confirm Clear Browser Cache')
                                          : (lang === 'ar' ? 'تحذير هام: تأكيد حذف البيانات السحابية' : 'CRITICAL WARNING: Confirm Cloud Purge')}
                                      </h3>
                                    </div>

                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                      {confirmModalType === 'CLEAR_LOCAL'
                                        ? (lang === 'ar'
                                          ? 'هل أنت متأكد من مسح بيانات المتصفح المحلية فقط؟ سيتم إعادة جلب البيانات الحالية فوراً من السحابة.'
                                          : 'Are you sure you want to clear local browser cache? Active records will immediately be re-fetched from Firestore Cloud.')
                                        : (lang === 'ar'
                                          ? 'هل أنت متأكد من مسح جميع بيانات المرضى والأسِرّة نهائياً من سحابة فايربيس والمتصفح؟ سيتم البدء ببيانات طبية حقيقية جديدة للنظام بالكامل.'
                                          : 'Are you sure you want to permanently delete all patient and bed records from Firestore Cloud and local browser? This will re-initialize the unit with fresh clinical ICU datasets.')}
                                    </p>

                                    <div className="flex items-center gap-3 pt-2">
                                      <button
                                        type="button"
                                        onClick={() => setConfirmModalType(null)}
                                        className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-xs transition-all cursor-pointer"
                                      >
                                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={confirmModalType === 'CLEAR_LOCAL' ? handleClearLocalBrowserData : handleResetCloudAndLocalData}
                                        className={`flex-1 py-2.5 px-4 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                                          confirmModalType === 'CLEAR_LOCAL'
                                            ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-md'
                                            : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                                        }`}
                                      >
                                        {confirmModalType === 'CLEAR_LOCAL'
                                          ? (lang === 'ar' ? 'تأكيد المسح والجلب' : 'Confirm & Re-sync')
                                          : (lang === 'ar' ? 'تأكيد الحذف والبدء من جديد' : 'Confirm & Purge All')}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <form onSubmit={handleSaveUnit} className="space-y-4 max-w-3xl mt-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    {lang === 'ar' ? 'اسم وحدة العناية المركزة' : 'Unit Name'}
                                  </label>
                                  <input
                                    type="text"
                                    value={unitForm.unitName}
                                    onChange={(e) => setUnitForm({ ...unitForm, unitName: e.target.value })}
                                    className="w-full bg-white dark:bg-[#060a14] border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 transition-all font-semibold text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                                    {lang === 'ar' ? 'المناوبة الحالية' : 'Active Shift'}
                                  </label>
                                  <input
                                    type="text"
                                    value={unitForm.shiftName}
                                    onChange={(e) => setUnitForm({ ...unitForm, shiftName: e.target.value })}
                                    className="w-full bg-white dark:bg-[#060a14] border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 transition-all font-semibold text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-3 pt-2">
                                <button
                                  type="submit"
                                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
                                >
                                  <Save className="w-4 h-4" />
                                  <span>{lang === 'ar' ? 'حفظ إعدادات الوحدة' : 'Save Unit Details'}</span>
                                </button>
                                {savedFeedback && (
                                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs animate-in fade-in">
                                    <Check className="w-4 h-4" />
                                    <span>{lang === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully'}</span>
                                  </div>
                                )}
                              </div>
                            </form>
                          )
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                            {section.items?.map((item) => {
                              const isEnabled = settings.features[item.key];
                              const ItemIcon = item.icon;
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => toggleFeature(item.key)}
                                  className={`p-4 rounded-xl border text-left flex items-start justify-between gap-3 transition-all cursor-pointer ${
                                    isEnabled 
                                      ? 'bg-teal-50/70 dark:bg-[#10192d] border-teal-300 dark:border-teal-500/30 text-slate-900 dark:text-white shadow-sm' 
                                      : 'bg-white dark:bg-[#060a14] border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 opacity-70 hover:opacity-100'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg border transition-colors ${
                                      isEnabled ? 'bg-teal-100 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/20 text-teal-700 dark:text-teal-400' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-600'
                                    }`}>
                                      <ItemIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className={`text-xs sm:text-sm font-bold transition-colors ${isEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {lang === 'ar' ? item.labelAr : item.labelEn}
                                      </h4>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                        {lang === 'ar' ? item.descriptionAr : item.descriptionEn}
                                      </p>
                                    </div>
                                  </div>
                                  <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 mt-0.5 ${isEnabled ? 'bg-teal-600 dark:bg-teal-500' : 'bg-slate-300 dark:bg-slate-800'}`}>
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? (isRTL ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'}`} />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Restore System Defaults Footer */}
        <div className="pt-6 mt-4 border-t border-slate-200 dark:border-slate-800/80 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-500/30 transition-all text-xs font-bold cursor-pointer group shadow-sm"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>{lang === 'ar' ? 'استعادة إعدادات المصنع الافتراضية' : 'Restore System Factory Defaults'}</span>
          </button>
          <div className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500 tracking-wider">
            Soli Medical MICU (ICU-Sync) • v4.3.0
          </div>
        </div>
      </div>
    </div>
  );
};
