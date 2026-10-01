import React, { useState, useEffect } from 'react';
import { 
  X, 
  Activity, 
  ShieldCheck, 
  Sparkles, 
  Clock, 
  Calendar,
  User, 
  Heart, 
  Wind, 
  Droplet, 
  Brain, 
  Bug, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Check,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Globe,
  Sliders,
  Settings
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenUserManagement?: () => void;
  onBedUpdated?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenUserManagement,
  onBedUpdated
}) => {
  const { settings, updateSettings, resetSettingsToDefault } = useSystemSettings();
  const { lang, isRTL, setLanguage } = useTranslation();

  const [activeTab, setActiveTab] = useState<'vitals' | 'features' | 'general'>('vitals');

  if (!isOpen) return null;

  const thresholds = settings.vitalThresholds || {
    hr: { criticalMin: 40, criticalMax: 130 },
    map: { criticalMin: 65, criticalMax: 110 },
    spo2: { criticalMin: 88, min: 92 },
    rr: { criticalMin: 8, criticalMax: 30 }
  };

  const handleUpdateThreshold = (parameter: string, field: string, val: number) => {
    updateSettings({
      vitalThresholds: {
        ...thresholds,
        [parameter]: {
          ...(thresholds as any)[parameter],
          [field]: val
        }
      }
    });
  };

  const handleToggleFeature = (featureKey: string) => {
    const currentFeatures = settings.features || {};
    updateSettings({
      features: {
        ...currentFeatures,
        [featureKey]: !(currentFeatures as any)[featureKey]
      }
    });
  };

  const handleResetToDefaults = () => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من استعادة إعدادات المنظومة الافتراضية؟' : 'Are you sure you want to reset all system settings to defaults?')) {
      resetSettingsToDefault();
      if (onBedUpdated) onBedUpdated();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-3xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Section */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#080f1e] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'إعدادات المنظومة والحدود السريرية' : 'System Settings & Clinical Thresholds'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' ? 'التحكم في التنبيهات، الحدود الحيوية، والوحدات السريرية' : 'Configure vital alarm thresholds, features, and clinical settings'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-50/60 dark:bg-[#080f1e]/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('vitals')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'vitals'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{lang === 'ar' ? 'الحدود الحيوية (Vital Alarms)' : 'Vital Thresholds'}</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'features'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{lang === 'ar' ? 'الميزات والوحدات' : 'System Modules'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'general'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>{lang === 'ar' ? 'اللغة والمظهر' : 'General & Theme'}</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'vitals' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/40 text-teal-900 dark:text-teal-300 font-medium">
                {lang === 'ar' ? 'ضبط حدود إنذار العلامات الحيوية للوحدة. عند تجاوز القيم الحرجة يتم تشغيل التنبيهات المرئية والصوتية فوراً.' : 'Configure clinical vital alert limits. Crossing critical thresholds triggers instant visual and audio alarms.'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Heart Rate */}
                <div className="p-4 bg-slate-50 dark:bg-[#070e1c] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{lang === 'ar' ? 'معدل نبضات القلب (Heart Rate - HR)' : 'Heart Rate (HR)'}</span>
                    <span className="text-teal-600 dark:text-teal-400 font-mono">bpm</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-500 block mb-1">{lang === 'ar' ? 'الحد الأدنى الحرِج' : 'Crit Min'}</label>
                      <input
                        type="number"
                        value={thresholds.hr?.criticalMin ?? 40}
                        onChange={(e) => handleUpdateThreshold('hr', 'criticalMin', Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1">{lang === 'ar' ? 'الحد الأقصى الحرِج' : 'Crit Max'}</label>
                      <input
                        type="number"
                        value={thresholds.hr?.criticalMax ?? 130}
                        onChange={(e) => handleUpdateThreshold('hr', 'criticalMax', Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* MAP */}
                <div className="p-4 bg-slate-50 dark:bg-[#070e1c] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{lang === 'ar' ? 'الضغط الشرياني الوسطي (MAP)' : 'Mean Arterial Pressure (MAP)'}</span>
                    <span className="text-teal-600 dark:text-teal-400 font-mono">mmHg</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-500 block mb-1">{lang === 'ar' ? 'الحد الأدنى الحرِج' : 'Crit Min'}</label>
                      <input
                        type="number"
                        value={thresholds.map?.criticalMin ?? 65}
                        onChange={(e) => handleUpdateThreshold('map', 'criticalMin', Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1">{lang === 'ar' ? 'الحد الأقصى الحرِج' : 'Crit Max'}</label>
                      <input
                        type="number"
                        value={thresholds.map?.criticalMax ?? 110}
                        onChange={(e) => handleUpdateThreshold('map', 'criticalMax', Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* SpO2 */}
                <div className="p-4 bg-slate-50 dark:bg-[#070e1c] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{lang === 'ar' ? 'تشبع الأكسجين (SpO2)' : 'Oxygen Saturation (SpO2)'}</span>
                    <span className="text-teal-600 dark:text-teal-400 font-mono">%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-500 block mb-1">{lang === 'ar' ? 'الحد الأدنى الحرِج' : 'Crit Min'}</label>
                      <input
                        type="number"
                        value={thresholds.spo2?.criticalMin ?? 88}
                        onChange={(e) => handleUpdateThreshold('spo2', 'criticalMin', Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1">{lang === 'ar' ? 'الحد التنبيهي' : 'Min Warning'}</label>
                      <input
                        type="number"
                        value={thresholds.spo2?.min ?? 92}
                        onChange={(e) => handleUpdateThreshold('spo2', 'min', Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Respiratory Rate */}
                <div className="p-4 bg-slate-50 dark:bg-[#070e1c] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="font-extrabold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{lang === 'ar' ? 'معدل التنفس (Respiratory Rate)' : 'Respiratory Rate (RR)'}</span>
                    <span className="text-teal-600 dark:text-teal-400 font-mono">bpm</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <label className="text-slate-500 block mb-1">{lang === 'ar' ? 'الحد الأدنى الحرِج' : 'Crit Min'}</label>
                      <input
                        type="number"
                        value={thresholds.rr?.criticalMin ?? 8}
                        onChange={(e) => handleUpdateThreshold('rr', 'criticalMin', Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1">{lang === 'ar' ? 'الحد الأقصى الحرِج' : 'Crit Max'}</label>
                      <input
                        type="number"
                        value={thresholds.rr?.criticalMax ?? 30}
                        onChange={(e) => handleUpdateThreshold('rr', 'criticalMax', Number(e.target.value))}
                        className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/40 text-teal-900 dark:text-teal-300 font-medium">
                {lang === 'ar' ? 'تمكين أو إخفاء الأقسام والموديولات السريرية بحسب السياسة التشغيلية للوحدة.' : 'Toggle clinical modules dynamically based on unit operational policy.'}
              </div>

              {[
                { key: 'enableVoiceNoteDictation', titleAr: 'التسجيل الصوتي المباشر للملاحظات الطبية', titleEn: 'Voice Dictation for Notes' },
                { key: 'enableAiScanner', titleAr: 'مسح وتقارير الأشعة والتحاليل بالذكاء الاصطناعي', titleEn: 'AI OCR Lab & Radiology Scanner' },
                { key: 'enableAudioAlarms', titleAr: 'نظام الإنذارات الصوتية الحية للقيم الحرجة', titleEn: 'Audio Alarms for Critical Vitals' },
                { key: 'enableSbarHandovers', titleAr: 'موديول تسليم المناوبات SBAR والتحويل السريري', titleEn: 'SBAR Handover Module' }
              ].map((feat) => {
                const isEnabled = (settings.features as any)?.[feat.key] !== false;
                return (
                  <div
                    key={feat.key}
                    onClick={() => handleToggleFeature(feat.key)}
                    className="p-4 bg-slate-50 dark:bg-[#070e1c] border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                        {lang === 'ar' ? feat.titleAr : feat.titleEn}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {isEnabled 
                          ? (lang === 'ar' ? 'مفعل ومتاح لجميع الكادر' : 'Enabled') 
                          : (lang === 'ar' ? 'معطل ومخفي' : 'Disabled')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`w-12 h-6 rounded-full p-1 transition-all ${
                        isEnabled ? 'bg-teal-500 text-slate-950 flex justify-end' : 'bg-slate-300 text-slate-400 flex justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow-md block" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-[#070e1c] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {lang === 'ar' ? 'لغة واجهة المنظومة (Interface Language)' : 'Language Setting'}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setLanguage('ar')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                      lang === 'ar' 
                        ? 'bg-teal-500 text-slate-950 shadow-md font-bold' 
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    العربية (AR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                      lang === 'en' 
                        ? 'bg-teal-500 text-slate-950 shadow-md font-bold' 
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    English (EN)
                  </button>
                </div>
              </div>

              {onOpenUserManagement && currentUser?.role === StaffRole.ADMIN && (
                <div className="p-4 bg-slate-50 dark:bg-[#070e1c] border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {lang === 'ar' ? 'إدارة المستخدمين وسجلات التدقيق' : 'ICU Staff Accounts & Security Trails'}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {lang === 'ar' ? 'إنشاء وتعديل وإلغاء حسابات الموظفين وسجلات الأمان' : 'Create, disable, or modify medical personnel authorization accounts'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenUserManagement();
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold cursor-pointer active:scale-95 transition-all"
                  >
                    {lang === 'ar' ? 'فتح لوحة الإدارة' : 'Manage Users'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#080f1e] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700/60"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'استعادة الإعدادات الافتراضية' : 'Reset Defaults'}</span>
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold shadow-md shadow-teal-500/20 transition-all cursor-pointer active:scale-95"
          >
            {lang === 'ar' ? 'حفظ وإغلاق' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
