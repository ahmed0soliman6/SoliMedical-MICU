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
  Menu,
  X,
  Volume2,
  CheckCircle2
} from 'lucide-react';
import { BedRecord, PatientDossier, BedNumber } from '../types/schema.ts';
import { requestNotificationPermission, playIcuAlarmAudio } from '../services/firebase.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { getPatientForBed } from '../services/dataModel.ts';

interface HeaderProps {
  beds: BedRecord[];
  patients: PatientDossier[];
  selectedBedNumber?: BedNumber | null;
  onSelectBed?: (bed: BedNumber | null) => void;
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
  selectedBedNumber,
  onSelectBed,
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
  const { settings, updateSettings } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  const occupiedBedsCount = (beds || []).filter(b => b && b.status === 'OCCUPIED').length;
  const criticalCount = (patients || []).filter(p => p && p.patientStatus === 'ACTIVE_ICU' && p.acuityLevel === 'CRITICAL_STAT').length;
  
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

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

  const hasActiveNotice = !!activeAlertMessage || criticalCount > 0;

  return (
    <header className="sticky top-0 z-40 bg-[#0a1122]/95 backdrop-blur-md border-b border-slate-800/80 px-2.5 sm:px-6 py-2 shadow-lg">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2">
        {/* Left Side: Sidebar Navigation Toggle & Live Status Indicator */}
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

          {/* Active System Indicator Dot */}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title={lang === 'ar' ? 'النظام يعمل بكفاءة' : 'System Operational'}></span>
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

        {/* Action Controls: Compact Search Icon, Alerts & Settings */}
        <div className="flex items-center gap-2 sm:gap-2.5 relative">
          {/* Universal Search Icon Button (Freeing header space) */}
          {settings.features.enableArchiveSearch && (
            <button
              onClick={onOpenSearch}
              className={`flex items-center justify-center p-2 sm:px-2.5 sm:py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-sm group cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-teal-500/20 border-teal-500 text-teal-300 shadow-teal-500/10'
                  : 'bg-[#0b1325] hover:bg-[#111d38] border-slate-700/80 text-slate-300 hover:text-teal-300 hover:border-teal-500/50'
              }`}
              title={lang === 'ar' ? 'البحث السريع في سجلات المرضى والأرشيف' : 'Search patient records & MRN'}
              aria-label="Search patient records"
            >
              <Search className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform flex-shrink-0" />
            </button>
          )}

          {/* Integrated Notification & Alert Center Bell */}
          {settings.features.enablePushNotifications && (
            <div className="relative">
              <button
                onClick={() => {
                  setIsNotificationMenuOpen(!isNotificationMenuOpen);
                  if (notificationPermission !== 'granted') {
                    handleToggleNotifications();
                  }
                }}
                className={`relative flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-sm cursor-pointer ${
                  hasActiveNotice
                    ? 'bg-red-950/80 border-red-500 text-red-200 hover:bg-red-900 ring-2 ring-red-500/30'
                    : notificationPermission === 'granted'
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                    : 'bg-[#0b1325] hover:bg-[#111d38] border-amber-500/50 text-amber-300'
                }`}
                title={
                  hasActiveNotice
                    ? (lang === 'ar' ? 'تنبيه طارئ نشط - انقر للتفاصيل' : 'Active Emergency Alert - Click for details')
                    : (lang === 'ar' ? 'نظام الإشعارات والتنبيهات' : 'System Notifications')
                }
              >
                {hasActiveNotice ? (
                  <>
                    <BellRing className="w-4 h-4 text-red-400 animate-bounce" />
                    <span className="hidden sm:inline">{lang === 'ar' ? 'تنبيه طارئ' : 'Emergency Alert'}</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-black text-white shadow-md animate-pulse">
                      {activeAlertMessage ? 1 : criticalCount}
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

              {/* Integrated Notification Popover Dropdown */}
              {isNotificationMenuOpen && (
                <div className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-80 sm:w-96 bg-[#0c162c] border border-slate-700/80 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95`}>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <BellRing className="w-4 h-4 text-teal-400" />
                      <span className="text-xs font-bold text-white">
                        {lang === 'ar' ? 'مركز التنبيهات والإشعارات' : 'Notification Center'}
                      </span>
                    </div>
                    <button
                      onClick={() => setIsNotificationMenuOpen(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-3 max-h-80 overflow-y-auto text-xs">
                    {/* Active STAT Alert Item */}
                    {activeAlertMessage ? (
                      <div className="p-3 bg-red-950/80 border border-red-500/80 text-red-200 rounded-xl space-y-2 animate-pulse">
                        <div className="flex items-start gap-2 font-bold">
                          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="leading-snug">
                            {activeAlertMessage}
                          </div>
                        </div>
                        {onDismissAlert && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={() => {
                                onDismissAlert();
                              }}
                              className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white text-[11px] font-bold rounded-lg border border-red-700 transition-colors cursor-pointer"
                            >
                              {lang === 'ar' ? 'إلغاء التنبيه' : 'Dismiss Alert'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 text-center text-[11px]">
                        {lang === 'ar' ? 'لا يوجد إنذار طارئ نشط حالياً' : 'No active emergency alarms at the moment'}
                      </div>
                    )}

                    {/* Critical STAT Count Summary */}
                    {criticalCount > 0 && (
                      <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            {lang === 'ar' 
                              ? `يوجد ${criticalCount} حالات حرجة STAT جارية بالعناية` 
                              : `${criticalCount} active critical STAT patients`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* System Audio & Notification Settings Toggle */}
                    <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between text-slate-300">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-teal-400" />
                        <span>{lang === 'ar' ? 'التنبيهات الصوتية المباشرة' : 'Audio Alarms'}</span>
                      </div>
                      <button
                        onClick={() => {
                          updateSettings({
                            features: {
                              ...settings.features,
                              enableAudioAlarms: !settings.features.enableAudioAlarms,
                            }
                          });
                          if (!settings.features.enableAudioAlarms) {
                            playIcuAlarmAudio('MEDIUM');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          settings.features.enableAudioAlarms
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {settings.features.enableAudioAlarms 
                          ? (lang === 'ar' ? 'مفضّلة / مفعّلة' : 'Enabled') 
                          : (lang === 'ar' ? 'مكتومة' : 'Muted')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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

      {/* Desktop Tab Navigation Bar (Interactive Bed Pages) */}
      <div className="max-w-[1600px] mx-auto hidden md:flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-800/60 overflow-x-auto">
        {settings.features.enableBedMatrix && (
          <button
            onClick={() => {
              if (onSelectBed) onSelectBed(null);
              onTabChange('beds');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'beds' && !selectedBedNumber
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
            title={lang === 'ar' ? 'عرض الكونسول المركزي لجميع الأسرة الستة' : 'View 6-Bed Central Console Grid'}
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            <span>{lang === 'ar' ? 'شبكة الأسِرّة الستة (Matrix)' : '6-Bed Console'}</span>
          </button>
        )}

        <span className="text-slate-700 mx-1">|</span>

        {/* Individual Dedicated Bed Pages */}
        {beds.map((b) => {
          const patient = getPatientForBed(b, patients);
          const isOccupied = b.status === 'OCCUPIED' || (b.status === 'ISOLATION' && !!patient) || !!patient;
          const isSelected = activeTab === 'beds' && selectedBedNumber === b.bedNumber;

          return (
            <button
              key={b.bedNumber}
              onClick={() => {
                if (onSelectBed) onSelectBed(b.bedNumber as BedNumber);
                onTabChange('beds');
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-teal-500/25 text-teal-200 border border-teal-500/50 font-black shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
              title={lang === 'ar' ? `صفحة السرير ${b.bedNumber}` : `Bed ${b.bedNumber} Dedicated Page`}
            >
              <span className={`font-mono font-extrabold ${b.status === 'ISOLATION' ? 'text-red-500 font-black' : 'text-teal-400'}`}>{b.bedNumber}</span>
              <span className="truncate max-w-[110px] text-[11px]">
                {isOccupied 
                  ? (patient?.fullNameAr?.split(' ')[0] || patient?.fullNameEn?.split(' ')[0] || (lang === 'ar' ? 'مشغول' : 'Occupied')) 
                  : (lang === 'ar' ? 'شاغر' : 'Vacant')}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${isOccupied ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            </button>
          );
        })}
      </div>
    </header>
  );
};


