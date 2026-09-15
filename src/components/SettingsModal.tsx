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
  Users
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { SystemFeatureFlags } from '../types/settings.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUserManagement: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onOpenUserManagement }) => {
  const { settings, toggleFeature, updateSettings, resetToDefaults } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  
  const [expandedSection, setExpandedSection] = useState<string | null>('modules');
  const [unitForm, setUnitForm] = useState(settings.unit);
  const [savedFeedback, setSavedFeedback] = useState(false);

  if (!isOpen) return null;

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
      descriptionAr: 'لوحة المراقبة الرئيسية لحالة جميع أسِرّة العناية الستة.',
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
      color: 'text-teal-300',
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
      icon: Layers,
      items: featureItems.filter(f => f.category === 'modules')
    },
    {
      id: 'bedside',
      labelAr: 'خصائص ملف السرير (Flowsheet)',
      labelEn: 'Bedside Clinical Flowsheet',
      icon: Activity,
      items: featureItems.filter(f => f.category === 'bedside')
    },
    {
      id: 'alerts',
      labelAr: 'الإنذارات والمزامنة السحابية',
      labelEn: 'Alarms & Cloud Infrastructure',
      icon: BellRing,
      items: featureItems.filter(f => f.category === 'alerts')
    },
    {
      id: 'rbac',
      labelAr: 'صلاحيات المستخدمين والوصول (RBAC)',
      labelEn: 'User Permissions & RBAC',
      icon: ShieldCheck,
      isAction: true,
      action: onOpenUserManagement
    },
    {
      id: 'language',
      labelAr: 'لغة المنظومة والترميز الطبي',
      labelEn: 'System Language & Medical Coding',
      icon: Languages,
      isCustom: true
    },
    {
      id: 'unit',
      labelAr: 'بيانات الوحدة والمناوبة السريرية',
      labelEn: 'ICU Unit & Shift Configuration',
      icon: Sliders,
      isCustom: true
    }
  ];

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="w-full h-full animate-in fade-in duration-300">
      <div 
        className="w-full mx-auto max-w-5xl bg-[#0a1224] border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 text-slate-100 flex flex-col mt-4"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header Navigation */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-md">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {lang === 'ar' ? 'مركز تخصيص وإعدادات المنظومة' : 'System Control Center'}
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">
                {lang === 'ar' 
                  ? 'إدارة الموديولات، لغة الواجهة، وصلاحيات الوصول السريري' 
                  : 'Manage modules, localization, and clinical access control'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all active:scale-95 group cursor-pointer"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        {/* Collapsible Sections (Accordion) */}
        <div className="space-y-4 pb-20">
          {sections.map((section) => {
            const isExpanded = expandedSection === section.id;
            const Icon = section.icon;

            return (
              <div 
                key={section.id}
                className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
                  isExpanded 
                    ? 'bg-[#0b1224] border-teal-500/40 shadow-[0_10px_40px_rgba(0,0,0,0.4)]' 
                    : 'bg-[#080d1a] border-slate-800/80 hover:border-slate-700 hover:bg-[#0a0f1c]'
                }`}
              >
                {/* Section Trigger */}
                <button
                  onClick={() => section.isAction ? section.action?.() : toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-6 sm:p-8 text-left"
                >
                  <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl border transition-colors ${isExpanded ? 'bg-teal-500/20 border-teal-500/30 text-teal-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className={`text-base sm:text-lg font-bold transition-colors ${isExpanded ? 'text-white' : 'text-slate-300'}`}>
                        {lang === 'ar' ? section.labelAr : section.labelEn}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {lang === 'ar' ? section.labelEn : section.labelAr}
                      </p>
                    </div>
                  </div>
                  {!section.isAction && (
                    <div className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-teal-500/10 text-teal-400 rotate-180' : 'text-slate-600'}`}>
                      <ChevronDown className="w-6 h-6" />
                    </div>
                  )}
                </button>

                {/* Section Content */}
                <AnimatePresence>
                  {isExpanded && !section.isAction && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-8 pb-8 border-t border-slate-800/40 pt-6">
                        {section.isCustom ? (
                          section.id === 'language' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <button
                                onClick={() => setLanguage('en')}
                                className={`p-6 rounded-2xl border transition-all ${
                                  lang === 'en' ? 'bg-teal-500/10 border-teal-500 text-teal-300 ring-1 ring-teal-500/20' : 'bg-[#060a14] border-slate-800 text-slate-500'
                                }`}
                              >
                                <span className="block font-black text-lg">ENGLISH</span>
                                <span className="text-[11px] opacity-70">Medical Standard Interface</span>
                              </button>
                              <button
                                onClick={() => setLanguage('ar')}
                                className={`p-6 rounded-2xl border transition-all ${
                                  lang === 'ar' ? 'bg-teal-500/10 border-teal-500 text-teal-300 ring-1 ring-teal-500/20' : 'bg-[#060a14] border-slate-800 text-slate-500'
                                }`}
                              >
                                <span className="block font-black text-lg">العربية</span>
                                <span className="text-[11px] opacity-70">المصطلحات السريرية المعربة</span>
                              </button>
                            </div>
                          ) : (
                            <form onSubmit={handleSaveUnit} className="space-y-6 max-w-2xl">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                                    {lang === 'ar' ? 'اسم الوحدة' : 'Unit Name'}
                                  </label>
                                  <input
                                    type="text"
                                    value={unitForm.unitName}
                                    onChange={(e) => setUnitForm({ ...unitForm, unitName: e.target.value })}
                                    className="w-full bg-[#060a14] border border-slate-800 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-teal-500 transition-all font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                                    {lang === 'ar' ? 'المناوبة' : 'Active Shift'}
                                  </label>
                                  <input
                                    type="text"
                                    value={unitForm.shiftName}
                                    onChange={(e) => setUnitForm({ ...unitForm, shiftName: e.target.value })}
                                    className="w-full bg-[#060a14] border border-slate-800 rounded-2xl px-5 py-3.5 text-white focus:outline-none focus:border-teal-500 transition-all font-bold"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <button
                                  type="submit"
                                  className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm transition-all shadow-xl shadow-teal-500/10"
                                >
                                  <Save className="w-5 h-5" />
                                  <span>{lang === 'ar' ? 'حفظ التغييرات' : 'Save Unit Details'}</span>
                                </button>
                                {savedFeedback && (
                                  <div className="flex items-center gap-2 text-emerald-400 font-bold animate-in fade-in slide-in-from-left-2">
                                    <Check className="w-5 h-5" />
                                    <span>{lang === 'ar' ? 'تم الحفظ' : 'Saved'}</span>
                                  </div>
                                )}
                              </div>
                            </form>
                          )
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {section.items?.map((item) => {
                              const isEnabled = settings.features[item.key];
                              const ItemIcon = item.icon;
                              return (
                                <button
                                  key={item.key}
                                  onClick={() => toggleFeature(item.key)}
                                  className={`p-5 rounded-2xl border text-left flex items-start justify-between gap-4 transition-all group ${
                                    isEnabled 
                                      ? 'bg-[#10192d] border-teal-500/30' 
                                      : 'bg-[#060a14] border-slate-800 opacity-60'
                                  }`}
                                >
                                  <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl border transition-colors ${isEnabled ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                                      <ItemIcon className="w-5 h-5" />
                                    </div>
                                    <div>
                                      <h4 className={`text-sm font-bold transition-colors ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                                        {lang === 'ar' ? item.labelAr : item.labelEn}
                                      </h4>
                                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                                        {lang === 'ar' ? item.descriptionAr : item.descriptionEn}
                                      </p>
                                    </div>
                                  </div>
                                  <div className={`w-10 h-6 rounded-full transition-colors relative flex items-center p-1 flex-shrink-0 mt-1 ${isEnabled ? 'bg-teal-500' : 'bg-slate-800'}`}>
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

          {/* Reset Action */}
          <div className="pt-8 flex justify-center">
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-all font-bold group"
            >
              <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              <span>{lang === 'ar' ? 'استعادة إعدادات المصنع الافتراضية' : 'Restore System Factory Defaults'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
