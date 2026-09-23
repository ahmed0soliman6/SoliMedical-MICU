import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  VolumeX, 
  CheckCircle,
  CheckCircle2, 
  Sun, 
  Moon,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  LogOut,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Wifi,
  WifiOff,
  CloudOff,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { BedRecord, PatientDossier, BedNumber } from '../types/schema.ts';
import { requestNotificationPermission, playIcuAlarmAudio, checkConnectionHealth, ConnectionHealthResult } from '../services/firebase.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { getPatientForBed } from '../services/dataModel.ts';
import { useAppNotifications } from '../services/NotificationContext.tsx';
import { AppNotification } from '../types/notification.ts';

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
  canGoBack?: boolean;
  onGoBack?: () => void;
}

const formatRelativeTime = (isoString: string, lang: 'ar' | 'en') => {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    if (diffMin < 1) return lang === 'ar' ? 'الآن' : 'Just now';
    if (diffMin < 60) return lang === 'ar' ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    if (diffHour < 24) return lang === 'ar' ? `منذ ${diffHour} ساعة` : `${diffHour}h ago`;
    return new Date(isoString).toLocaleDateString();
  } catch {
    return '';
  }
};

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
  canGoBack,
  onGoBack,
}) => {
  const { settings, updateSettings, updateNotificationSettings, toggleTheme } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  const { 
    notifications, 
    unreadCount, 
    markAsRead,
    handleNotificationClick, 
    markAllAsRead, 
    deleteNotification, 
    clearAllNotifications 
  } = useAppNotifications();

  const occupiedBedsCount = (beds || []).filter(b => {
    if (!b) return false;
    return b.status === 'OCCUPIED' || b.status === 'ISOLATION' || !!getPatientForBed(b, patients);
  }).length;
  const criticalCount = (patients || []).filter(p => 
    p && 
    (p.patientStatus === 'ACTIVE_ICU' || (p as any).status === 'ACTIVE_ICU' || (p as any).currentStatus === 'ACTIVE_ICU') && 
    p.acuityLevel === 'CRITICAL_STAT'
  ).length;
  
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  // Live Interactive Connection Status (ONLINE / CONNECTING / OFFLINE)
  type ConnectionStatus = 'ONLINE' | 'CONNECTING' | 'OFFLINE';
  type OfflineReason = 'NO_INTERNET' | 'CLOUD_UNREACHABLE';

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [offlineReason, setOfflineReason] = useState<OfflineReason | null>(null);

  const verifyConnectionHealth = useCallback(async (isSilent = true) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setConnectionStatus('OFFLINE');
      setOfflineReason('NO_INTERNET');
      return { status: 'OFFLINE' as const, reason: 'NO_INTERNET' as const };
    }

    if (!isSilent) {
      setConnectionStatus('CONNECTING');
    }

    try {
      const result = await checkConnectionHealth();
      if (result.status === 'ONLINE') {
        setConnectionStatus('ONLINE');
        setOfflineReason(null);
        // Clear any old offline toast
        setSyncToastMessage(null);
        return result;
      } else {
        setConnectionStatus('OFFLINE');
        setOfflineReason(result.reason);
        return result;
      }
    } catch {
      const isNetOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
      const r = isNetOnline ? ('CLOUD_UNREACHABLE' as const) : ('NO_INTERNET' as const);
      setConnectionStatus('OFFLINE');
      setOfflineReason(r);
      return { status: 'OFFLINE' as const, reason: r };
    }
  }, []);

  useEffect(() => {
    // Initial verification on mount
    verifyConnectionHealth(false);

    const handleOnline = () => {
      setConnectionStatus('CONNECTING');
      verifyConnectionHealth(false);
    };

    const handleOffline = () => {
      setConnectionStatus('OFFLINE');
      setOfflineReason('NO_INTERNET');
      setSyncToastMessage(
        lang === 'ar'
          ? '⚠️ تم فقدان الاتصال بالإنترنت. النظام يعمل الآن بوضع التخزين المحلي الآمن (Offline Dexie) لحفظ كافة البيانات.'
          : '⚠️ Internet disconnected. System is operating safely in local offline resilience mode (Dexie).'
      );
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic gentle background health check every 30s
    const healthInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        verifyConnectionHealth(true);
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(healthInterval);
    };
  }, [verifyConnectionHealth, lang]);

  const INITIAL_VISIBLE_COUNT = 6;
  const displayedNotifications = isExpanded ? notifications : notifications.slice(0, INITIAL_VISIBLE_COUNT);
  const hasMoreNotifications = notifications.length > INITIAL_VISIBLE_COUNT;

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

  // Close notification popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setIsNotificationMenuOpen(false);
      }
    };
    if (isNotificationMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationMenuOpen]);

  const handleToggleNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted' && settings.features.enableAudioAlarms) {
      playIcuAlarmAudio('MEDIUM');
    }
  };

  const handleCloudSyncClick = async () => {
    // 1. If currently ONLINE: Silently sync with cloud and DO NOT show any intrusive popup
    if (connectionStatus === 'ONLINE') {
      if (onTriggerCloudSync) {
        onTriggerCloudSync();
      }
      setSyncToastMessage(null);
      // Run background silent health check
      verifyConnectionHealth(true);
      return;
    }

    // 2. If currently CONNECTING: re-verify and don't spam
    if (connectionStatus === 'CONNECTING') {
      await verifyConnectionHealth(false);
      return;
    }

    // 3. If OFFLINE: re-verify and show diagnostic explanation of the exact failure cause
    const checkResult = await verifyConnectionHealth(false);
    if (checkResult.status === 'ONLINE') {
      // Reconnected successfully!
      if (onTriggerCloudSync) onTriggerCloudSync();
      setSyncToastMessage(null);
    } else {
      const isNoInternet = checkResult.reason === 'NO_INTERNET' || (typeof navigator !== 'undefined' && !navigator.onLine);
      const diagnosticMsg = isNoInternet
        ? (lang === 'ar'
            ? '⚠️ سبب المشكلة: تم فقدان الاتصال بشبكة الإنترنت (Wi-Fi / No Internet Connection). النظام يعمل الآن محلياً بنظام الأمان والمقاومة (Dexie IndexedDB) ولن يفقد أي بيانات.'
            : '⚠️ Issue Cause: No Internet Connection detected. System is running safely in local offline resilience mode (Dexie) - no data will be lost.')
        : (lang === 'ar'
            ? '⚠️ سبب المشكلة: يتوفر اتصال بالإنترنت ولكن تعذر الوصول إلى خوادم المزامنة السحابية (Firebase Cloud Sync). يتم حفظ كافة التعديلات محلياً وسيتم رفعها تلقائياً فور استقرار الخادم.'
            : '⚠️ Issue Cause: Internet is available, but Firebase Cloud Sync servers are unreachable. All records are saved locally and will auto-sync upon reconnection.');

      setSyncToastMessage(diagnosticMsg);
      setTimeout(() => {
        setSyncToastMessage(null);
      }, 7000);
    }
  };

  const totalAlertBadgeCount = unreadCount;

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0a1122]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-2.5 sm:px-6 py-2 shadow-sm dark:shadow-lg transition-colors">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2">
        {/* Left Side: Navigation Controls (Menu & Back) & Live Status */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Hamburger Menu Button for Mobile/Tablet */}
          <button
            onClick={onOpenSidebar}
            className="md:hidden flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-[#0f172a] hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:border-teal-500/60 border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-400 transition-all active:scale-95 shadow-sm cursor-pointer"
            title={lang === 'ar' ? 'القائمة الجانبية والصفحات' : 'Open Sidebar & Navigation'}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 hidden xs:inline">
              {lang === 'ar' ? 'القائمة' : 'Menu'}
            </span>
          </button>

          {/* Back Button (زر الرجوع) - Located directly next to the menu dropdown button */}
          <button
            type="button"
            id="header-back-btn"
            onClick={onGoBack}
            disabled={!canGoBack}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition-all active:scale-95 shadow-sm cursor-pointer ${
              canGoBack
                ? 'bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/70 dark:hover:bg-teal-900/90 border-teal-400 dark:border-teal-500/70 text-teal-800 dark:text-teal-200 ring-1 ring-teal-500/20 shadow-teal-500/10'
                : 'bg-slate-100 dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed'
            }`}
            title={lang === 'ar' ? 'الرجوع للصفحة السابقة / الكونسول المركزي (Back)' : 'Go back to previous page / Central Console'}
            aria-label={lang === 'ar' ? 'رجوع' : 'Back'}
          >
            {isRTL ? <ArrowRight className="w-4 h-4 shrink-0" /> : <ArrowLeft className="w-4 h-4 shrink-0" />}
            <span className="font-bold">
              {lang === 'ar' ? 'رجوع' : 'Back'}
            </span>
          </button>

          {/* Active System Indicator Dot */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" title={lang === 'ar' ? 'النظام يعمل بكفاءة' : 'System Operational'}></span>
          </div>
        </div>

        {/* Live Metrics Ticker (Desktop & Tablet) */}
        <div className="hidden md:flex items-center gap-3">
          {/* Bed Occupancy */}
          {settings.features.enableBedMatrix && (
            <div className="bg-slate-100 dark:bg-[#0e172a] border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  {lang === 'ar' ? 'الإشغال الإجمالي' : 'Total Occupancy'}
                </div>
                <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                  <span className="text-teal-600 dark:text-teal-400">{occupiedBedsCount}</span> / {settings.unit.totalBedsCount} {lang === 'ar' ? 'أسِرّة' : 'Beds'}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Online/Offline Connection Status Button (Desktop) */}
          <button
            type="button"
            id="header-connection-status-btn-desktop"
            onClick={handleCloudSyncClick}
            className={`border px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 group cursor-pointer text-xs font-bold ${
              connectionStatus === 'ONLINE'
                ? 'bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300'
                : connectionStatus === 'CONNECTING'
                ? 'bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300'
                : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/80 dark:hover:bg-rose-900/90 border-rose-400 dark:border-rose-600 text-rose-800 dark:text-rose-200 ring-2 ring-rose-500/40 animate-pulse'
            }`}
            title={
              connectionStatus === 'ONLINE'
                ? (lang === 'ar' ? '✅ متصل: المزامنة السحابية اللحظية (Firebase) نشطة ومستقرة' : '✅ Online: Realtime Firebase cloud sync is active')
                : connectionStatus === 'CONNECTING'
                ? (lang === 'ar' ? '⏳ جارٍ الاتصال: جاري التحقق من المزامنة السحابية...' : '⏳ Connecting: Verifying cloud sync...')
                : (lang === 'ar' ? '🚨 غير متصل: انقر لمعرفة سبب انقطاع الاتصال' : '🚨 Offline: Click to diagnose connection issue')
            }
          >
            {connectionStatus === 'ONLINE' ? (
              <>
                <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping inline-block"></span>
                <span className="font-mono">{lang === 'ar' ? 'متصل' : 'Online'}</span>
              </>
            ) : connectionStatus === 'CONNECTING' ? (
              <>
                <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin flex-shrink-0" />
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse inline-block"></span>
                <span className="font-mono text-amber-700 dark:text-amber-300">{lang === 'ar' ? 'جارٍ الإتصال' : 'Connecting...'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-rose-600 dark:text-rose-400 animate-bounce flex-shrink-0" />
                <span className="w-2 h-2 rounded-full bg-rose-600 dark:bg-rose-400 animate-ping inline-block"></span>
                <span className="font-mono text-rose-700 dark:text-rose-300 font-extrabold">{lang === 'ar' ? 'غير متصل' : 'Offline'}</span>
              </>
            )}
          </button>
        </div>

        {/* Action Controls: Mobile Connection Indicator, Search, Alerts & Settings */}
        <div className="flex items-center gap-2 sm:gap-2.5 relative">
          {/* Mobile Connection Indicator */}
          <button
            type="button"
            id="header-connection-status-btn-mobile"
            onClick={handleCloudSyncClick}
            className={`md:hidden border px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all active:scale-95 text-xs font-bold ${
              connectionStatus === 'ONLINE'
                ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300'
                : connectionStatus === 'CONNECTING'
                ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300'
                : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/80 dark:hover:bg-rose-900/90 border-rose-400 dark:border-rose-600 text-rose-800 dark:text-rose-200 ring-2 ring-rose-500/40 animate-pulse'
            }`}
            title={
              connectionStatus === 'ONLINE'
                ? (lang === 'ar' ? '✅ متصل' : '✅ Online')
                : connectionStatus === 'CONNECTING'
                ? (lang === 'ar' ? '⏳ جارٍ الاتصال...' : '⏳ Connecting...')
                : (lang === 'ar' ? '🚨 غير متصل: انقر لمعرفة السبب' : '🚨 Offline: Click to diagnose')
            }
          >
            {connectionStatus === 'ONLINE' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                <span className="font-mono text-[11px]">{lang === 'ar' ? 'متصل' : 'Online'}</span>
              </>
            ) : connectionStatus === 'CONNECTING' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin flex-shrink-0" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block"></span>
                <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300">{lang === 'ar' ? 'جارٍ الإتصال' : 'Connecting'}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 animate-bounce flex-shrink-0" />
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping inline-block"></span>
                <span className="font-mono text-[11px] text-rose-700 dark:text-rose-300 font-extrabold">{lang === 'ar' ? 'غير متصل' : 'Offline'}</span>
              </>
            )}
          </button>
          {/* Universal Search Icon Button */}
          {settings.features.enableArchiveSearch && (
            <button
              onClick={onOpenSearch}
              className={`flex items-center justify-center p-2 sm:px-2.5 sm:py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-sm group cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-teal-50 dark:bg-teal-500/20 border-teal-500 text-teal-700 dark:text-teal-300 shadow-teal-500/10'
                  : 'bg-white hover:bg-slate-100 dark:bg-[#0b1325] dark:hover:bg-[#111d38] border-slate-200 dark:border-slate-700/80 text-slate-700 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-300'
              }`}
              title={lang === 'ar' ? 'البحث السريع في سجلات المرضى والأرشيف' : 'Search patient records & MRN'}
              aria-label="Search patient records"
            >
              <Search className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform flex-shrink-0" />
            </button>
          )}

          {/* Integrated Notification & Alert Center Bell with Popover */}
          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => {
                setIsNotificationMenuOpen(!isNotificationMenuOpen);
                if (notificationPermission !== 'granted') {
                  handleToggleNotifications();
                }
              }}
              className={`relative flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 shadow-sm cursor-pointer ${
                unreadCount > 0
                  ? 'bg-teal-50 dark:bg-teal-950/70 border-teal-400 dark:border-teal-500/60 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 ring-1 ring-teal-500/40'
                  : 'bg-white hover:bg-slate-100 dark:bg-[#0b1325] dark:hover:bg-[#111d38] border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
              }`}
              title={lang === 'ar' ? 'نظام الإشعارات والتنبيهات' : 'System Notifications'}
            >
              {unreadCount > 0 ? (
                <>
                  <BellRing className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'التنبيهات' : 'Alerts'}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-[11px] font-black text-white shadow-sm">
                    {unreadCount}
                  </span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'التنبيهات' : 'Alerts'}</span>
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                </>
              )}
            </button>

            {/* Smart Notification Dropdown (Max 10 with click-to-navigate & auto-dismiss) */}
            {isNotificationMenuOpen && (
              <div 
                className={`absolute top-full mt-2 ${isRTL ? 'left-0' : 'right-0'} w-84 sm:w-[420px] bg-white dark:bg-[#0c162c] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95`}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {lang === 'ar' ? 'مركز التنبيهات والإشعارات' : 'Notification Center'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                        {lang === 'ar' 
                          ? `(${unreadCount} غير مقروء • ${notifications.length} إجمالي)` 
                          : `(${unreadCount} unread • ${notifications.length} total)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Quick Mute Toggle */}
                    <button
                      type="button"
                      onClick={() => updateNotificationSettings({ isMuted: !settings.notifications.isMuted })}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                        settings.notifications.isMuted
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700'
                      }`}
                      title={settings.notifications.isMuted ? (lang === 'ar' ? 'إلغاء كتم التنبيهات الصوتية' : 'Unmute Sounds') : (lang === 'ar' ? 'كتم التنبيهات الصوتية' : 'Mute Sounds')}
                    >
                      {settings.notifications.isMuted ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-amber-500" />
                          <span>{lang === 'ar' ? 'مكتوم' : 'Muted'}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>{lang === 'ar' ? 'صامت' : 'Mute'}</span>
                        </>
                      )}
                    </button>

                    {/* Mark All As Read */}
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-[10px] font-bold transition-colors cursor-pointer"
                        title={lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}
                      >
                        {lang === 'ar' ? 'قراءة الكل' : 'Mark read'}
                      </button>
                    )}

                    {/* Clear All */}
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={clearAllNotifications}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                        title={lang === 'ar' ? 'مسح كافة التنبيهات' : 'Clear all'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => setIsNotificationMenuOpen(false)}
                      className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title={lang === 'ar' ? 'إغلاق' : 'Close'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Popover Content */}
                <div className="mt-3 space-y-2.5 max-h-[420px] overflow-y-auto text-xs pr-0.5 custom-scrollbar">
                  {/* Notifications Queue List */}
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                      {lang === 'ar' ? 'لا توجد تنبيهات جديدة مسجلة حالياً.' : 'No alerts logged in the queue.'}
                    </div>
                  ) : (
                    <>
                      {displayedNotifications.map((notif) => {
                        const isUnread = !notif.read;
                        const hasAction = !!notif.target;

                        return (
                          <div
                            key={notif.id}
                            onClick={() => {
                              handleNotificationClick(notif);
                              setIsNotificationMenuOpen(false);
                            }}
                            className={`p-3 rounded-xl border transition-all relative flex flex-col gap-1.5 cursor-pointer ${
                              isUnread
                                ? 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-300 dark:border-teal-500/40 hover:border-teal-500 shadow-sm'
                                : 'bg-slate-50 dark:bg-[#070d1a] border-slate-200 dark:border-slate-800 hover:border-slate-700 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Status Dot */}
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  isUnread ? 'bg-teal-500 shadow-sm animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
                                }`} />
                                <h5 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                                  {lang === 'ar' ? notif.titleAr : notif.titleEn}
                                </h5>
                                {notif.target?.bedNumber && (
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                                    {lang === 'ar' ? `سرير ${notif.target.bedNumber}` : `Bed ${notif.target.bedNumber}`}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {formatRelativeTime(notif.timestamp, lang)}
                                </span>
                                {isUnread && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsRead(notif.id);
                                    }}
                                    className="p-1 text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 rounded hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                                    title={lang === 'ar' ? 'تحديد كمقروء' : 'Mark as read'}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(notif.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                                  title={lang === 'ar' ? 'حذف' : 'Delete'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                              {lang === 'ar' ? notif.messageAr : notif.messageEn}
                            </p>

                            {hasAction && (
                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-[10px] font-semibold text-teal-700 dark:text-teal-400">
                                <span>
                                  {notif.target?.action === 'OPEN_ARCHIVE' && (lang === 'ar' ? '🎯 انقر لفتح ملف المريض في الأرشيف' : '🎯 Click to view in Patient Archive')}
                                  {notif.target?.action === 'OPEN_SBAR' && (lang === 'ar' ? '🎯 انقر لفتح تقرير تسليم SBAR' : '🎯 Click to view SBAR Handover')}
                                  {notif.target?.action === 'OPEN_BED' && (lang === 'ar' ? '🎯 انقر لفتح ملف السرير' : '🎯 Click to open bedside flowsheet')}
                                  {notif.target?.action === 'OPEN_ISOLATION' && (lang === 'ar' ? '🎯 انقر لمعاينة تدابير العزل' : '🎯 Click to view isolation')}
                                </span>
                                {isRTL ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Expand / Show More Button when > 6 notifications */}
                      {hasMoreNotifications && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-teal-50 dark:bg-slate-800/90 dark:hover:bg-teal-950/50 border border-slate-200 hover:border-teal-400 dark:border-slate-700 dark:hover:border-teal-500/50 text-teal-700 dark:text-teal-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <span>{lang === 'ar' ? 'إخفاء التنبيهات الإضافية' : 'Show Less'}</span>
                                <ChevronUp className="w-4 h-4" />
                              </>
                            ) : (
                              <>
                                <span>
                                  {lang === 'ar' 
                                    ? `إظهار باقي التنبيهات (+${notifications.length - INITIAL_VISIBLE_COUNT} تنبيهات إضافية)` 
                                    : `Show More (+${notifications.length - INITIAL_VISIBLE_COUNT} alerts)`}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status Diagnostic Toast Banner (Shown ONLY on actual connection error) */}
      {syncToastMessage && (
        <div className="max-w-[1600px] mx-auto mt-2 bg-rose-950/95 dark:bg-rose-950/95 border border-rose-500/70 text-rose-100 text-xs px-3.5 py-2 rounded-xl flex items-center justify-between gap-3 animate-fade-in shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
            <span className="font-semibold leading-relaxed break-words">{syncToastMessage}</span>
          </div>
          <button
            onClick={() => setSyncToastMessage(null)}
            className="text-rose-300 hover:text-white text-xs font-bold px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-800 transition-colors shrink-0 cursor-pointer"
            title={lang === 'ar' ? 'إغلاق التنبيه' : 'Dismiss'}
          >
            ✕
          </button>
        </div>
      )}

      {/* Desktop Tab Navigation Bar (Interactive Bed Pages) */}
      <div className="max-w-[1600px] mx-auto hidden md:flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/60 overflow-x-auto">
        {settings.features.enableBedMatrix && (
          <button
            onClick={() => {
              if (onSelectBed) onSelectBed(null);
              onTabChange('beds');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'beds' && !selectedBedNumber
                ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
            }`}
            title={lang === 'ar' ? 'عرض الكونسول المركزي لجميع الأسرة الستة' : 'View 6-Bed Central Console Grid'}
          >
            <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{lang === 'ar' ? 'شبكة الأسِرّة الستة (Matrix)' : '6-Bed Console'}</span>
          </button>
        )}

        <span className="text-slate-300 dark:text-slate-700 mx-1">|</span>

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
                  ? 'bg-teal-100 dark:bg-teal-500/25 text-teal-900 dark:text-teal-200 border border-teal-400 dark:border-teal-500/50 font-black shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent'
              }`}
              title={lang === 'ar' ? `صفحة السرير ${b.bedNumber}` : `Bed ${b.bedNumber} Dedicated Page`}
            >
              <span className={`font-mono font-extrabold ${b.status === 'ISOLATION' ? 'text-red-500 font-black' : 'text-teal-600 dark:text-teal-400'}`}>{b.bedNumber}</span>
              <span className="truncate max-w-[110px] text-[11px]">
                {isOccupied 
                  ? (patient?.fullNameAr?.split(' ')[0] || patient?.fullNameEn?.split(' ')[0] || (lang === 'ar' ? 'مشغول' : 'Occupied')) 
                  : (lang === 'ar' ? 'شاغر' : 'Vacant')}
              </span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${isOccupied ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
            </button>
          );
        })}
      </div>
    </header>
  );
};


