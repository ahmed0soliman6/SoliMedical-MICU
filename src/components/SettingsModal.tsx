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
  CheckCircle2,
  Camera,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  Pill,
  FileCheck2
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { SystemFeatureFlags } from '../types/settings.ts';
import { ClinicalOptionsManager } from './ClinicalOptionsManager.tsx';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUserManagement: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpenUserManagement }) => {
  const { settings, toggleFeature, updateSettings, resetToDefaults } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  
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
  });

  const [unitForm, setUnitForm] = useState(settings.unit);
  const [savedFeedback, setSavedFeedback] = useState(false);

  if (!isOpen) return null;

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
      rbac: true,
      clinicalCatalogs: true,
      labsConfig: true,
      language: true,
      unit: true,
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
      labelAr: 'البحث في الأرشيف الطبي (MRN Archive)',
      labelEn: 'Patient & MRN Archive Search',
      descriptionAr: 'محرك بحث متقدم برقم الملف الطبي (MRN) أو اسم المريض.',
      descriptionEn: 'Fast historical query by Medical Record Number (MRN) or name.',
      icon: Search,
      color: 'text-blue-400',
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
      badgeAr: '3 ميزات',
      badgeEn: '3 Features',
      icon: BellRing,
      items: featureItems.filter(f => f.category === 'alerts')
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
      id: 'unit',
      labelAr: 'بيانات الوحدة والمناوبة السريرية',
      labelEn: 'ICU Unit & Shift Configuration',
      badgeAr: 'بيانات الوحدة',
      badgeEn: 'Unit Config',
      icon: Sliders,
      isCustom: true
    }
  ];

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-300 pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Large Full-Width Settings Container */}
      <div 
        className="w-full max-w-6xl mx-auto bg-[#0a1224] border border-slate-800 rounded-3xl shadow-xl p-4 sm:p-7 text-slate-100 flex flex-col"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Page Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-lg shadow-teal-500/10">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>{lang === 'ar' ? 'مركز تخصيص وإعدادات المنظومة الشامل' : 'System Configuration Center'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-teal-950 text-teal-300 border border-teal-800">
                  v2.5 MICU
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' 
                  ? 'إدارة مرنة لجميع الموديولات والخصائص السريرية والمزامنة السحابية والصلاحيات' 
                  : 'Modular clinical controls, flowsheet tabs, telemetry flags, and access governance'}
              </p>
            </div>
          </div>

          {/* Quick Accordion Actions: Expand All / Collapse All & Close */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={expandAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title={lang === 'ar' ? 'فتح جميع البطاقات' : 'Expand all cards'}
            >
              <FolderOpen className="w-3.5 h-3.5 text-teal-400" />
              <span>{lang === 'ar' ? 'توسيع الكل' : 'Expand All'}</span>
            </button>

            <button
              onClick={collapseAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title={lang === 'ar' ? 'طي جميع البطاقات' : 'Collapse all cards'}
            >
              <FolderMinus className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'ar' ? 'طي الكل' : 'Collapse All'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all active:scale-95 group cursor-pointer"
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
                    ? 'bg-[#0c1426] border-teal-500/40 shadow-xl ring-1 ring-teal-500/20' 
                    : 'bg-[#080d1a] border-slate-800/80 hover:border-slate-700 hover:bg-[#0a0f1c]'
                }`}
              >
                {/* Collapsible Card Trigger Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl border transition-colors ${
                      isExpanded 
                        ? 'bg-teal-500/20 border-teal-500/40 text-teal-300' 
                        : 'bg-slate-900 border-slate-800 text-slate-400 group-hover:text-teal-400'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-sm sm:text-base font-bold transition-colors ${isExpanded ? 'text-white' : 'text-slate-200'}`}>
                          {lang === 'ar' ? section.labelAr : section.labelEn}
                        </h3>
                        {section.badgeAr && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                            {lang === 'ar' ? section.badgeAr : section.badgeEn}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {lang === 'ar' ? section.labelEn : section.labelAr}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl transition-all ${
                      isExpanded ? 'bg-teal-500/10 text-teal-400 rotate-180' : 'text-slate-500 group-hover:text-slate-300'
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
                      <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-800/60">
                        {section.isCustom ? (
                          section.id === 'language' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                              <button
                                onClick={() => setLanguage('en')}
                                className={`p-5 rounded-2xl border text-left transition-all ${
                                  lang === 'en' 
                                    ? 'bg-teal-500/10 border-teal-500 text-teal-300 ring-1 ring-teal-500/30 shadow-md' 
                                    : 'bg-[#060a14] border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="block font-black text-base">ENGLISH</span>
                                  {lang === 'en' && <CheckCircle2 className="w-5 h-5 text-teal-400" />}
                                </div>
                                <span className="text-xs opacity-75 mt-1 block">Strictly English International Medical Standard (LTR)</span>
                              </button>
                              <button
                                onClick={() => setLanguage('ar')}
                                className={`p-5 rounded-2xl border text-right transition-all ${
                                  lang === 'ar' 
                                    ? 'bg-teal-500/10 border-teal-500 text-teal-300 ring-1 ring-teal-500/30 shadow-md' 
                                    : 'bg-[#060a14] border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  {lang === 'ar' && <CheckCircle2 className="w-5 h-5 text-teal-400" />}
                                  <span className="block font-black text-base">العربية السريرية</span>
                                </div>
                                <span className="text-xs opacity-75 mt-1 block">واجهة معربة مع الحفاظ على الاختصارات الطبية (RTL)</span>
                              </button>
                            </div>
                          ) : section.id === 'clinicalCatalogs' ? (
                            <div className="mt-2">
                              <ClinicalOptionsManager />
                            </div>
                          ) : (
                            <form onSubmit={handleSaveUnit} className="space-y-4 max-w-3xl mt-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                                    {lang === 'ar' ? 'اسم وحدة العناية المركزة' : 'Unit Name'}
                                  </label>
                                  <input
                                    type="text"
                                    value={unitForm.unitName}
                                    onChange={(e) => setUnitForm({ ...unitForm, unitName: e.target.value })}
                                    className="w-full bg-[#060a14] border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-all font-semibold text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                                    {lang === 'ar' ? 'المناوبة الحالية' : 'Active Shift'}
                                  </label>
                                  <input
                                    type="text"
                                    value={unitForm.shiftName}
                                    onChange={(e) => setUnitForm({ ...unitForm, shiftName: e.target.value })}
                                    className="w-full bg-[#060a14] border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 transition-all font-semibold text-sm"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-3 pt-2">
                                <button
                                  type="submit"
                                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all shadow-md cursor-pointer"
                                >
                                  <Save className="w-4 h-4" />
                                  <span>{lang === 'ar' ? 'حفظ إعدادات الوحدة' : 'Save Unit Details'}</span>
                                </button>
                                {savedFeedback && (
                                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs animate-in fade-in">
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
                                  onClick={() => toggleFeature(item.key)}
                                  className={`p-4 rounded-xl border text-left flex items-start justify-between gap-3 transition-all cursor-pointer ${
                                    isEnabled 
                                      ? 'bg-[#10192d] border-teal-500/30 shadow-sm' 
                                      : 'bg-[#060a14] border-slate-800/80 opacity-60 hover:opacity-90'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-lg border transition-colors ${
                                      isEnabled ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-slate-900 border-slate-800 text-slate-600'
                                    }`}>
                                      <ItemIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className={`text-xs sm:text-sm font-bold transition-colors ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                                        {lang === 'ar' ? item.labelAr : item.labelEn}
                                      </h4>
                                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                        {lang === 'ar' ? item.descriptionAr : item.descriptionEn}
                                      </p>
                                    </div>
                                  </div>
                                  <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 mt-0.5 ${isEnabled ? 'bg-teal-500' : 'bg-slate-800'}`}>
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
        <div className="pt-6 mt-4 border-t border-slate-800/80 flex justify-center">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-all text-xs font-bold cursor-pointer group"
          >
            <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>{lang === 'ar' ? 'استعادة إعدادات المصنع الافتراضية' : 'Restore System Factory Defaults'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
