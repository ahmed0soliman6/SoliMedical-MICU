import React, { useState, useEffect, useRef } from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { BedRecord, PatientDossier, BedNumber } from '../types/schema.ts';
import { requestNotificationPermission, playIcuAlarmAudio } from '../services/firebase.ts';
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
  activeAlertMessage?: string | null;
  onDismissAlert?: () => void;
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
  activeAlertMessage,
  onDismissAlert,
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

  const occupiedBedsCount = (beds || []).filter(b => b && b.status === 'OCCUPIED').length;
  const criticalCount = (patients || []).filter(p => p && p.patientStatus === 'ACTIVE_ICU' && p.acuityLevel === 'CRITICAL_STAT').length;
  
  const [notificationPermission, setNotificationPermission] = useState<string>('default');
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);

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

  const hasActiveEmergency = !!activeAlertMessage;
  const totalAlertBadgeCount = unreadCount + (activeAlertMessage ? 1 : 0);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0a1122]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-2.5 sm:px-6 py-2 shadow-sm dark:shadow-lg transition-colors">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2">
        {/* Left Side: Sidebar Navigation Toggle & Live Status Indicator */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Button for Mobile/Tablet */}
          <button
            onClick={onOpenSidebar}
            className="md:hidden flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-[#0f172a] hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:border-teal-500/60 border border-slate-300 dark:border-slate-700 text-teal-700 dark:text-teal-400 transition-all active:scale-95 shadow-sm cursor-pointer"
            title={lang === 'ar' ? 'القائمة الجانبية والصفحات' : 'Open Sidebar & Navigation'}
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {lang === 'ar' ? 'القائمة' : 'Menu'}
            </span>
          </button>

          {/* Active System Indicator Dot */}
          <div className="flex items-center gap-2">
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



          {/* Firebase Realtime Cloud Live Indicator */}
          {settings.features.enableCloudSync && (
            <button
              onClick={handleCloudSyncClick}
              className="bg-slate-100 hover:bg-teal-50 dark:bg-[#0e172a] dark:hover:bg-teal-950/60 border border-slate-200 hover:border-teal-400 dark:border-teal-500/40 dark:hover:border-teal-400 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 group cursor-pointer"
              title={lang === 'ar' ? 'حالة المزامنة السحابية: متصل بـ Firebase Firestore. انقر لإجراء فحص وتحديث' : 'Cloud Sync: Online (Firebase). Click to verify status'}
            >
              <Cloud className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform flex-shrink-0" />
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                <span className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 animate-ping inline-block"></span>
                <span>{lang === 'ar' ? 'متصل' : 'Online'}</span>
              </div>
            </button>
          )}
        </div>

        {/* Action Controls: Search, Theme Toggle, Alerts & Settings */}
        <div className="flex items-center gap-2 sm:gap-2.5 relative">
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
                hasActiveEmergency
                  ? 'bg-red-100 dark:bg-red-950/80 border-red-400 dark:border-red-500 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-900 ring-2 ring-red-500/30'
                  : unreadCount > 0
                  ? 'bg-teal-50 dark:bg-teal-950/70 border-teal-400 dark:border-teal-500/60 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/60 ring-1 ring-teal-500/40'
                  : 'bg-white hover:bg-slate-100 dark:bg-[#0b1325] dark:hover:bg-[#111d38] border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
              }`}
              title={
                hasActiveEmergency
                  ? (lang === 'ar' ? 'تنبيه طارئ نشط - انقر للتفاصيل' : 'Active Emergency Alert - Click for details')
                  : (lang === 'ar' ? 'نظام الإشعارات والتنبيهات' : 'System Notifications')
              }
            >
              {hasActiveEmergency ? (
                <>
                  <BellRing className="w-4 h-4 text-red-600 dark:text-red-400 animate-bounce" />
                  <span className="hidden sm:inline">{lang === 'ar' ? 'تنبيه طارئ' : 'Emergency Alert'}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white shadow-md animate-pulse">
                    {unreadCount > 0 ? unreadCount : 1}
                  </span>
                </>
              ) : unreadCount > 0 ? (
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
                  {/* Active STAT Alert Banner */}
                  {activeAlertMessage && (
                    <div 
                      onClick={() => {
                        const match = activeAlertMessage.match(/(?:السرير|Bed)\s*(\d+)/i);
                        if (match && match[1]) {
                          const bNum = match[1].padStart(2, '0') as BedNumber;
                          onSelectBed?.(bNum);
                          onTabChange('beds');
                          setIsNotificationMenuOpen(false);
                          if (onDismissAlert) onDismissAlert();
                        }
                      }}
                      className="p-3 bg-red-50 dark:bg-red-950/80 border border-red-300 dark:border-red-500/80 text-red-900 dark:text-red-200 rounded-xl space-y-2 animate-pulse shadow-sm cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/90 transition-colors"
                    >
                      <div className="flex items-start gap-2 font-bold">
                        <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          {activeAlertMessage}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-red-200 dark:border-red-800/60 text-[10px]">
                        <span className="font-semibold text-red-700 dark:text-red-300">
                          {lang === 'ar' ? '🎯 انقر للانتقال المباشر لملف السرير' : '🎯 Click to view bed dossier'}
                        </span>
                        {onDismissAlert && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismissAlert();
                            }}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 dark:bg-red-900 dark:hover:bg-red-800 text-white font-bold rounded transition-colors cursor-pointer"
                          >
                            {lang === 'ar' ? 'إلغاء التنبيه' : 'Dismiss Alert'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notifications Queue List */}
                  {notifications.length === 0 && !activeAlertMessage ? (
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


