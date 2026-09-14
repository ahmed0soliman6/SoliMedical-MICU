import React, { useState } from 'react';
import { 
  X, 
  Sliders, 
  Layers, 
  Activity, 
  Database, 
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
  Languages
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { SystemFeatureFlags } from '../types/settings.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, toggleFeature, updateSettings, resetToDefaults } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  const [activeSettingsTab, setActiveSettingsTab] = useState<'modules' | 'bedside' | 'alerts' | 'unit' | 'language'>('modules');

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
    // Main Modules
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
      key: 'enableSbarHandover',
      category: 'modules',
      labelAr: 'تسليم المناوبات المجمع (SBAR Handover)',
      labelEn: 'SBAR Shift Handover Module',
      descriptionAr: 'توثيق وتسليم مناوبات الأطقم الطبية والتمريضية مع التوقيع المزدوج.',
      descriptionEn: 'Interprofessional clinical shift handovers with dual-nurse verification.',
      icon: Activity,
      color: 'text-cyan-400',
    },
    {
      key: 'enableClinicalNotes',
      category: 'modules',
      labelAr: 'الملاحظات الطبية المشفرة (Clinical Notes & Addendums)',
      labelEn: 'Clinical Notes & Audit Trail',
      descriptionAr: 'سجل الملاحظات الإكلينيكية غير القابل للحذف مع ملحقات مشفرة SHA-256.',
      descriptionEn: 'Immutable medical progress notes with cryptographic SHA-256 addendums.',
      icon: Database,
      color: 'text-emerald-400',
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

    // Bedside Flowsheet Sub-Modules
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

    // Alerts & Network
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

  const currentFeatures = featureItems.filter(f => f.category === activeSettingsTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-[#0b1224] border border-slate-700/80 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-200 animate-in fade-in zoom-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#080d1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'مركز تخصيص وإعدادات المنظومة' : 'System Configuration & Control Panel'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? 'إمكانية تفعيل، تعطيل، إخفاء، أو تخصيص أي خاصية أو موديول بحرية ومرونة تامة' 
                  : 'Toggle, customize, or hide any clinical feature or module dynamically'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all"
            title={lang === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800/80 bg-[#0a1020] overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveSettingsTab('modules')}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSettingsTab === 'modules'
                ? 'border-teal-400 text-teal-300 font-bold bg-teal-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{lang === 'ar' ? 'الموديولات والشاشات الرئيسية' : 'Core Modules'}</span>
          </button>

          <button
            onClick={() => setActiveSettingsTab('bedside')}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSettingsTab === 'bedside'
                ? 'border-teal-400 text-teal-300 font-bold bg-teal-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{lang === 'ar' ? 'خصائص ملف السرير (Flowsheet)' : 'Bedside Flowsheet'}</span>
          </button>

          <button
            onClick={() => setActiveSettingsTab('alerts')}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSettingsTab === 'alerts'
                ? 'border-teal-400 text-teal-300 font-bold bg-teal-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BellRing className="w-4 h-4" />
            <span>{lang === 'ar' ? 'الإنذارات والمزامنة السحابية' : 'Alarms & Cloud Sync'}</span>
          </button>

          <button
            onClick={() => setActiveSettingsTab('language')}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSettingsTab === 'language'
                ? 'border-teal-400 text-teal-300 font-bold bg-teal-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Languages className="w-4 h-4" />
            <span>{lang === 'ar' ? 'لغة المنظومة (Language)' : 'System Language'}</span>
          </button>

          <button
            onClick={() => setActiveSettingsTab('unit')}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeSettingsTab === 'unit'
                ? 'border-teal-400 text-teal-300 font-bold bg-teal-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{lang === 'ar' ? 'بيانات الوحدة والمناوبة' : 'Unit & Shift Details'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {activeSettingsTab === 'language' ? (
            <div className="max-w-xl mx-auto space-y-4">
              <div className="bg-[#0f172a] p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                    <Languages className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {lang === 'ar' ? 'اختر لغة واجهة النظام' : 'Select Primary System Language'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {lang === 'ar' 
                        ? 'النظام يدعم الإنجليزية بالكامل كأصل، مع دعم فوري وسلس للغة العربية' 
                        : 'System is natively English with comprehensive clinical Arabic support'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* English Mode Option */}
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      lang === 'en'
                        ? 'bg-[#132238] border-teal-500 ring-1 ring-teal-500 text-white'
                        : 'bg-[#0a0f1c] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-teal-300">English (Medical Standard)</span>
                      {lang === 'en' && <Check className="w-4 h-4 text-teal-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Pure English interface with standard clinical acronyms (MAP, SpO2, HR, GCS, RASS, SIMV, SBAR, DNR).
                    </p>
                  </button>

                  {/* Arabic Mode Option */}
                  <button
                    type="button"
                    onClick={() => setLanguage('ar')}
                    className={`p-4 rounded-xl border text-right flex flex-col justify-between transition-all ${
                      lang === 'ar'
                        ? 'bg-[#132238] border-teal-500 ring-1 ring-teal-500 text-white'
                        : 'bg-[#0a0f1c] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-sm text-teal-300">العربية (مع الاختصارات الطبية)</span>
                      {lang === 'ar' && <Check className="w-4 h-4 text-teal-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      واجهة عربية سريرية مدعمة بالاختصارات والمصطلحات الطبية العالمية (SBAR، MAP، SpO2، GCS).
                    </p>
                  </button>
                </div>
              </div>
            </div>
          ) : activeSettingsTab !== 'unit' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {currentFeatures.map((item) => {
                const isEnabled = settings.features[item.key];
                const IconComponent = item.icon;

                return (
                  <div
                    key={item.key}
                    onClick={() => toggleFeature(item.key)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isEnabled
                        ? 'bg-[#0f1a30] border-teal-500/40 hover:border-teal-400/60 shadow-sm'
                        : 'bg-[#0a0f1c] border-slate-800/80 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl border ${isEnabled ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-800/40 border-slate-700/40'}`}>
                        <IconComponent className={`w-5 h-5 ${isEnabled ? item.color : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
                        </div>
                        {lang === 'ar' && (
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">{item.labelEn}</div>
                        )}
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {lang === 'ar' ? item.descriptionAr : item.descriptionEn}
                        </p>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex items-center pt-1">
                      <button
                        type="button"
                        aria-pressed={isEnabled}
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-1 ${
                          isEnabled ? 'bg-teal-500' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                            isEnabled 
                              ? (isRTL ? 'translate-x-0' : 'translate-x-5')
                              : (isRTL ? '-translate-x-5' : 'translate-x-0')
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Unit Customization Form */
            <form onSubmit={handleSaveUnit} className="space-y-4 max-w-xl mx-auto bg-[#0f172a] p-5 rounded-2xl border border-slate-800">
              <h3 className="text-sm font-bold text-white mb-2">
                {lang === 'ar' ? 'تخصيص معلومات وحدة العناية المركزة' : 'ICU Department Configuration'}
              </h3>
              
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {lang === 'ar' ? 'اسم الوحدة الرئيسي (Unit Name)' : 'Main Unit Name'}
                </label>
                <input
                  type="text"
                  value={unitForm.unitName}
                  onChange={(e) => setUnitForm({ ...unitForm, unitName: e.target.value })}
                  className="w-full bg-[#080d1a] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {lang === 'ar' ? 'الوصف الفرعي للوحدة (Subtitle)' : 'Unit Subtitle / Section'}
                </label>
                <input
                  type="text"
                  value={unitForm.unitSubtitle}
                  onChange={(e) => setUnitForm({ ...unitForm, unitSubtitle: e.target.value })}
                  className="w-full bg-[#080d1a] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {lang === 'ar' ? 'اسم المناوبة الحالية (Current Shift)' : 'Current Active Shift'}
                </label>
                <input
                  type="text"
                  value={unitForm.shiftName}
                  onChange={(e) => setUnitForm({ ...unitForm, shiftName: e.target.value })}
                  className="w-full bg-[#080d1a] border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}</span>
                </button>

                {savedFeedback && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تم الحفظ بنجاح!' : 'Saved successfully!'}</span>
                  </span>
                )}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-[#080d1a]">
          <button
            onClick={resetToDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{lang === 'ar' ? 'استعادة الإعدادات الافتراضية الأصلية' : 'Reset to Default Settings'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-all"
          >
            {lang === 'ar' ? 'تم وإغلاق' : 'Done & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
