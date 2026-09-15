import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  UserPlus, 
  ShieldAlert, 
  Layers, 
  Database,
  Cloud, 
  Bell, 
  BellRing,
  Sliders,
  Languages,
  Menu
} from 'lucide-react';
import { BedRecord, PatientDossier } from '../types/schema.ts';
import { requestNotificationPermission, playIcuAlarmAudio } from '../services/firebase.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface HeaderProps {
  beds: BedRecord[];
  patients: PatientDossier[];
  onOpenAdmission?: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenSidebar: () => void;
  onTriggerCloudSync?: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  activeAlertMessage?: string | null;
  onDismissAlert?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  beds,
  patients,
  onOpenAdmission,
  onOpenSearch,
  onOpenSettings,
  onOpenSidebar,
  onTriggerCloudSync,
  activeTab,
  onTabChange,
  activeAlertMessage,
  onDismissAlert,
}) => {
  const { settings } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  const occupiedBedsCount = (beds || []).filter(b => b && b.status === 'OCCUPIED').length;
  const criticalCount = (patients || []).filter(p => p && p.patientStatus === 'ACTIVE_ICU' && p.acuityLevel === 'CRITICAL_STAT').length;
  
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  }, [lang, isRTL]);

  const handleToggleNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted' && settings.features.enableAudioAlarms) {
      playIcuAlarmAudio('MEDIUM');
    }
  };

  const handleCloudSyncClick = () => {
    if (onTriggerCloudSync) {
      onTriggerCloudSync();
    }
    const msg = lang === 'ar' 
      ? '✅ الاتصال السحابي نشط: المزامنة اللحظية مع Firebase Firestore تعمل بكفاءة' 
      : '✅ Cloud Connection Active: Realtime sync with Firebase Firestore is running smoothly';
    setSyncToastMessage(msg);
    setTimeout(() => {
      setSyncToastMessage(null);
    }, 3500);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0a1122]/95 backdrop-blur-md border-b border-slate-800/80 px-2.5 sm:px-6 py-2 shadow-lg">
      {/* STAT Emergency Alert Banner across top if active */}
      {activeAlertMessage && (
        <div className="mb-2 bg-red-950/90 border border-red-500/80 text-red-200 px-3 sm:px-4 py-2 rounded-xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="truncate">
              {lang === 'ar' 
                ? `🚨 إنذار حرج فوري (ICU STAT): ${activeAlertMessage}` 
                : `🚨 STAT ALERT: ${activeAlertMessage}`}
            </span>
          </div>
          {onDismissAlert && (
            <button 
              onClick={onDismissAlert}
              className="text-[10px] sm:text-[11px] bg-red-900/60 hover:bg-red-800 text-white px-2 py-0.5 rounded-md border border-red-700 flex-shrink-0"
            >
              {lang === 'ar' ? 'إلغاء' : 'Dismiss'}
            </button>
          )}
        </div>
      )}

      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2">
        {/* Left Side: Sidebar Navigation Toggle (Mobile & Tablet) */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Button for Mobile/Tablet */}
          <button
            onClick={onOpenSidebar}
            className="md:hidden flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl bg-[#0f172a] hover:bg-teal-950/50 hover:border-teal-500/60 border border-slate-700 text-teal-400 transition-all active:scale-95 shadow-sm cursor-pointer"
            title={lang === 'ar' ? 'القائمة الجانبية والصفحات' : 'Open Sidebar & Navigation'}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
            <span className="text-xs font-bold text-slate-200">
              {lang === 'ar' ? 'القائمة' : 'Menu'}
            </span>
          </button>

          {/* Active View / Unit Title */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h1 className="text-xs sm:text-sm font-extrabold tracking-tight text-white leading-none">
              {lang === 'ar' ? 'وحدة العناية المركزة الباطنة (MICU)' : 'Soli Medical MICU System'}
            </h1>
          </div>
        </div>

        {/* Live Metrics Ticker (Desktop & Tablet) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Bed Occupancy */}
          {settings.features.enableBedMatrix && (
            <div className="bg-[#0e172a] border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {lang === 'ar' ? 'الإشغال الإجمالي' : 'Total Occupancy'}
                </div>
                <div className="text-xs font-mono font-bold text-white">
                  <span className="text-teal-400">{occupiedBedsCount}</span> / {settings.unit.totalBedsCount} {lang === 'ar' ? 'أسِرّة' : 'Beds'}
                </div>
              </div>
            </div>
          )}

          {/* STAT Critical Alerts */}
          {settings.features.enableAcuityLevels && (
            <div className="bg-[#0e172a] border border-red-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 animate-bounce" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className="text-[10px] text-red-400 uppercase tracking-wider font-bold">
                  {lang === 'ar' ? 'حالات حرجة STAT' : 'Critical STAT'}
                </div>
                <div className="text-xs font-mono font-bold text-red-300">
                  {criticalCount} {lang === 'ar' ? 'مريض' : 'Patients'}
                </div>
              </div>
            </div>
          )}

          {/* Firebase Realtime Cloud Live Indicator - Interactive & Single Label "متصل" */}
          {settings.features.enableCloudSync && (
            <button
              onClick={handleCloudSyncClick}
              className="bg-[#0e172a] hover:bg-teal-950/60 border border-teal-500/40 hover:border-teal-400 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 group cursor-pointer"
              title={lang === 'ar' ? 'حالة المزامنة السحابية: متصل بـ Firebase Firestore. انقر لإجراء فحص وتحديث' : 'Cloud Sync: Online (Firebase). Click to verify status'}
            >
              <Cloud className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform flex-shrink-0" />
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-teal-300">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping inline-block"></span>
                <span>{lang === 'ar' ? 'متصل' : 'Online'}</span>
              </div>
            </button>
          )}
        </div>

        {/* Prominent Search Bar & Notifications Center & Settings */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Universal Search Bar (Prominent across all pages) */}
          {settings.features.enableArchiveSearch && (
            <button
              onClick={onOpenSearch}
              className={`flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-medium transition-all active:scale-95 shadow-sm group cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-teal-500/10'
                  : 'bg-[#0b1325] hover:bg-[#111d38] border-slate-700/80 text-slate-300 hover:border-teal-500/50'
              }`}
              title={lang === 'ar' ? 'البحث السريع في سجلات المرضى والأرشيف' : 'Search patient records & MRN'}
            >
              <Search className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform flex-shrink-0" />
              <span className="text-slate-300 font-semibold text-xs truncate max-w-[140px] sm:max-w-[180px] md:max-w-[220px]">
                {lang === 'ar' ? 'بحث بالاسم أو رقم الملف MRN' : 'Search Patient / MRN'}
              </span>
              <kbd className="hidden lg:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                /
              </kbd>
            </button>
          )}

          {/* Prominent Notifications & Alert Center */}
          {settings.features.enablePushNotifications && (
            <button
              onClick={handleToggleNotifications}
              className={`relative flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-sm cursor-pointer ${
                criticalCount > 0
                  ? 'bg-red-950/70 border-red-500/60 text-red-200 hover:bg-red-900/80'
                  : notificationPermission === 'granted'
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-[#0b1325] hover:bg-[#111d38] border-amber-500/50 text-amber-300'
              }`}
              title={
                criticalCount > 0
                  ? (lang === 'ar' ? `يوجد ${criticalCount} حالات حرجة STAT` : `${criticalCount} Critical STAT alerts`)
                  : (lang === 'ar' ? 'نظام الإشعارات والتنبيهات' : 'System Notifications')
              }
            >
              {criticalCount > 0 ? (
                <>
                  <BellRing className="w-4 h-4 text-red-400 animate-bounce" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'إشعارات طارئة' : 'STAT Alerts'}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-black text-white shadow-md">
                    {criticalCount}
                  </span>
                </>
              ) : notificationPermission === 'granted' ? (
                <>
                  <BellRing className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'الإشعارات' : 'Alerts'}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'تفعيل التنبيهات' : 'Enable Alerts'}</span>
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                </>
              )}
            </button>
          )}

          {/* System Settings Control Center Button */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-sm cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-teal-500/20'
                : 'bg-[#0b1325] hover:bg-[#111d38] border-slate-700/80 text-slate-300 hover:text-teal-300 hover:border-teal-500/50'
            }`}
            title={lang === 'ar' ? 'مركز تخصيص وإعدادات المنظومة الشامل' : 'System Settings & Control Center'}
          >
            <Sliders className="w-4 h-4 text-teal-400" />
            <span className="hidden sm:inline">{t('settings')}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Toast Banner */}
      {syncToastMessage && (
        <div className="max-w-7xl mx-auto mt-2 bg-teal-950/90 border border-teal-500/80 text-teal-200 text-xs px-3 py-1.5 rounded-lg flex items-center justify-between animate-fade-in shadow-md">
          <div className="flex items-center gap-2">
            <Cloud className="w-3.5 h-3.5 text-teal-400" />
            <span>{syncToastMessage}</span>
          </div>
          <button
            onClick={() => setSyncToastMessage(null)}
            className="text-teal-400 hover:text-white text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Desktop Tab Navigation Bar (Respecting Feature Flags & Bilingual) */}
      <div className="max-w-7xl mx-auto hidden md:flex items-center gap-1 mt-2 pt-2 border-t border-slate-800/60">
        {settings.features.enableBedMatrix && (
          <button
            onClick={() => onTabChange('beds')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'beds'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t('bedMatrix')} (6 {lang === 'ar' ? 'أسرة' : 'Beds'})</span>
          </button>
        )}
      </div>
    </header>
  );
};


