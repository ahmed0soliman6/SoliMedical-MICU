import React, { useEffect, useState } from 'react';
import { 
  X, 
  Layers, 
  Search, 
  UserPlus, 
  Sliders, 
  Languages, 
  ChevronRight, 
  ChevronLeft, 
  LogOut, 
  ShieldCheck, 
  LayoutDashboard, 
  MessageSquare, 
  KeyRound, 
  Sun, 
  Moon,
  BookOpen,
  FileDown,
  Film,
  Play
} from 'lucide-react';
import { BedRecord, PatientDossier, BedNumber } from '../types/schema.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { SoliLogo } from './SoliLogo.tsx';
import { getPatientForBed } from '../services/dataModel.ts';
import { ChangePasswordModal } from './ChangePasswordModal.tsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAdmission: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement?: () => void;
  onOpenUserGuide?: () => void;
  onOpenVideoGuide?: () => void;
  beds: BedRecord[];
  patients: PatientDossier[];
  selectedBedNumber: BedNumber | null;
  onSelectBed: (bed: BedNumber | null) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  onOpenAdmission,
  onOpenSearch,
  onOpenSettings,
  onOpenUserManagement,
  onOpenUserGuide,
  onOpenVideoGuide,
  beds,
  patients,
  selectedBedNumber,
  onSelectBed,
}) => {
  const { settings, toggleTheme } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  const { currentUser, logout, hasPermission } = useAuth();

  const [showChangePassModal, setShowChangePassModal] = useState(false);

  const occupiedBedsCount = (beds || []).filter((b) => {
    if (!b) return false;
    return b.status === 'OCCUPIED' || b.status === 'ISOLATION' || !!getPatientForBed(b, patients);
  }).length;

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'ar' : 'en';
    setLanguage(nextLang);
  };

  const handleSelectTab = (tab: string) => {
    onTabChange(tab);
    onClose();
  };

  const handleSelectBed = (bNum: BedNumber | null) => {
    onTabChange('beds');
    onSelectBed(bNum);
    onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Unified Sidebar Navigation Content Component
  const renderNavContent = () => (
    <div className="flex-1 flex flex-col min-h-0 divide-y divide-slate-200 dark:divide-slate-800/60">
      {/* Scrollable Navigation Menu */}
      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-2 py-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <LayoutDashboard className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>{lang === 'ar' ? 'لوحة التحكم والأسِرّة' : 'Navigation & Dashboard'}</span>
        </div>

        {/* 1. Bedside Matrix Main Tab */}
        <button
          onClick={() => handleSelectBed(null)}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'beds' && !selectedBedNumber
              ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-850 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 shadow-sm font-bold'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3 truncate">
            <div className={`p-2 rounded-lg ${activeTab === 'beds' && !selectedBedNumber ? 'bg-teal-100 dark:bg-teal-500/30 text-teal-800 dark:text-teal-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <span className="truncate">{lang === 'ar' ? 'لوحة أسرة العناية (6 أسرة)' : 'Bedside Matrix (6 Beds)'}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 font-mono font-bold shrink-0">
            {occupiedBedsCount}/6
          </span>
        </button>

        {/* Sub-list of Beds 01 to 06 */}
        <div className="pl-3 pr-1 py-1 space-y-1">
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 font-semibold">
            {lang === 'ar' ? 'الأسرة السريرية' : 'Bedside Units'}
          </div>
          {beds.map((b) => {
            const patient = getPatientForBed(b, patients);
            const isOccupied = b.status === 'OCCUPIED' || (b.status === 'ISOLATION' && !!patient) || !!patient;
            const isSelected = activeTab === 'beds' && selectedBedNumber === b.bedNumber;

            const displayName = patient 
              ? (lang === 'ar' ? (patient.fullNameAr || patient.fullNameEn) : (patient.fullNameEn || patient.fullNameAr))
              : (b.status === 'ISOLATION' 
                ? (lang === 'ar' ? 'عزل (شاغر)' : 'Isolation (Vacant)')
                : b.status === 'UNAVAILABLE' 
                ? (lang === 'ar' ? 'غير متاح' : 'Unavailable')
                : (lang === 'ar' ? 'شاغر' : 'Vacant'));

            return (
              <button
                key={b.bedNumber}
                onClick={() => handleSelectBed(b.bedNumber as BedNumber)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-all active:scale-[0.98] cursor-pointer ${
                  isSelected 
                    ? 'bg-teal-100 dark:bg-teal-500/25 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-500/40 font-bold shadow-sm' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`font-mono text-base font-bold ${b.status === 'ISOLATION' ? 'text-red-600 dark:text-red-500' : 'text-teal-600 dark:text-teal-400'}`}>{b.bedNumber}</span>
                  <span className="truncate text-sm font-medium">
                    {displayName}
                  </span>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${isOccupied ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 my-2" />

        <div className="px-2 py-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
          {lang === 'ar' ? 'الأقسام والوظائف' : 'Clinical Modules'}
        </div>

        {/* 2. Patient Admission STAT */}
        {settings.features.enableAdmissions !== false && (
          <button
            onClick={() => {
              onClose();
              onOpenAdmission();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 truncate">
              <div className="p-2 rounded-lg bg-emerald-100 dark:emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="truncate">{lang === 'ar' ? 'إدخال مريض جديد (Admission)' : 'Admit New Patient'}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono font-bold shrink-0">
              + STAT
            </span>
          </button>
        )}

        {/* 3. Patient Archive Search */}
        {settings.features.enableArchiveSearch && (
          <button
            onClick={() => handleSelectTab('search')}
            className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-850 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 shadow-sm font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 truncate">
              <div className={`p-2 rounded-lg ${activeTab === 'search' ? 'bg-teal-100 dark:bg-teal-500/30 text-teal-800 dark:text-teal-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <Search className="w-4 h-4" />
              </div>
              <span className="truncate">{lang === 'ar' ? 'أرشيف المرضى (MRN Search)' : 'Universal Patient Archive'}</span>
            </div>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
        )}

        {/* 4. Staff RBAC & User Management */}
        {hasPermission('users.view') && onOpenUserManagement && (
          <button
            onClick={() => handleSelectTab('users')}
            className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-850 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 shadow-sm font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 truncate">
              <div className={`p-2 rounded-lg ${activeTab === 'users' ? 'bg-teal-100 dark:bg-teal-500/30 text-teal-800 dark:text-teal-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="truncate">{lang === 'ar' ? 'إدارة المستخدمين والصلاحيات' : 'Staff RBAC & Users'}</span>
            </div>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
        )}

        {/* 5. Hospital Clinical Chat */}
        {settings.features.enableClinicalChat !== false && (
          <button
            onClick={() => handleSelectTab('chat')}
            className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-850 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 shadow-sm font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 truncate">
              <div className={`p-2 rounded-lg ${activeTab === 'chat' ? 'bg-teal-100 dark:bg-teal-500/30 text-teal-800 dark:text-teal-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="truncate">{lang === 'ar' ? 'الدردشة السريرية (Chat)' : 'Hospital Clinical Chat'}</span>
            </div>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
        )}

        {/* 6. System Settings */}
        {settings.features.enableSystemSettingsPage !== false && (
          <button
            onClick={() => handleSelectTab('settings')}
            className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-teal-50 dark:bg-teal-500/20 text-teal-850 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 shadow-sm font-bold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 truncate">
              <div className={`p-2 rounded-lg ${activeTab === 'settings' ? 'bg-teal-100 dark:bg-teal-500/30 text-teal-800 dark:text-teal-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                <Sliders className="w-4 h-4" />
              </div>
              <span className="truncate">{lang === 'ar' ? 'إعدادات وتخصيص النظام' : t('settings')}</span>
            </div>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          </button>
        )}

        {/* 7. Clinical User Manual (PDF) */}
        <button
          onClick={() => {
            onClose();
            if (onOpenUserGuide) onOpenUserGuide();
          }}
          className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all bg-teal-50/70 hover:bg-teal-100/80 dark:bg-teal-950/40 dark:hover:bg-teal-900/60 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-500/40 shadow-sm cursor-pointer mt-1"
        >
          <div className="flex items-center gap-3 truncate">
            <div className="p-2 rounded-lg bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="truncate text-left rtl:text-right">
              <span className="block truncate font-bold">{lang === 'ar' ? 'دليل الاستخدام السريري (PDF)' : 'Clinical User Guide (PDF)'}</span>
              <span className="block text-[10px] text-teal-700 dark:text-teal-400 font-normal">{lang === 'ar' ? 'شرح مصور لجميع البطاقات' : 'Illustrated Cards Manual'}</span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-600 text-white font-mono font-bold shrink-0">
            PDF
          </span>
        </button>

        {/* 8. Clinical Video Walkthrough (Video) */}
        <button
          onClick={() => {
            onClose();
            if (onOpenVideoGuide) onOpenVideoGuide();
          }}
          className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all bg-cyan-50/70 hover:bg-cyan-100/80 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/60 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-500/40 shadow-sm cursor-pointer mt-1"
        >
          <div className="flex items-center gap-3 truncate">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
              <Film className="w-4 h-4" />
            </div>
            <div className="truncate text-left rtl:text-right">
              <span className="block truncate font-bold">{lang === 'ar' ? 'فيديو الشرح العملي المصور' : 'Clinical Video Guide'}</span>
              <span className="block text-[10px] text-cyan-700 dark:text-cyan-400 font-normal">{lang === 'ar' ? 'محاكاة بالفيديو وقابل للتحميل' : 'Interactive Video Player'}</span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-600 text-white font-mono font-bold shrink-0 flex items-center gap-1">
            <Play className="w-2.5 h-2.5 fill-white" />
            <span>HD</span>
          </span>
        </button>
      </div>

      {/* User Profile Footer */}
      {currentUser && (
        <div className="p-3 bg-slate-50 dark:bg-[#0a1224] border-t border-slate-200 dark:border-slate-800/80 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-500/20 border border-teal-300 dark:border-teal-500/40 flex items-center justify-center font-bold text-teal-800 dark:text-teal-300 text-xs font-mono shrink-0 mt-0.5 shadow-sm">
              {(currentUser.nameEn || currentUser.username || 'DR').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span 
                  className="text-xs font-bold text-slate-900 dark:text-white leading-tight break-words"
                  title={currentUser.nameAr || currentUser.nameEn || currentUser.username}
                >
                  {currentUser.nameAr || currentUser.nameEn || currentUser.username}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-500/20 text-teal-850 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 font-mono font-semibold shrink-0">
                  {currentUser.role}
                </span>
              </div>
              <div className="text-[10px] text-teal-600 dark:text-teal-400 font-mono flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                <span>{lang === 'ar' ? 'الطبيب متاح / متصل' : 'Available / Online'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
            <button
              type="button"
              onClick={() => setShowChangePassModal(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-teal-700 dark:text-teal-300 text-[11px] font-semibold transition-colors cursor-pointer shadow-sm"
              title={lang === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'كلمة المرور' : 'Password'}</span>
            </button>

            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-300 text-[11px] font-semibold transition-colors cursor-pointer shadow-sm"
              title={lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'خروج' : 'Logout'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Navigation (Side Drawer matching Image 4) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
          {/* Backdrop Blur Overlay */}
          <div 
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={onClose}
          />

          {/* Sliding Side Drawer Panel */}
          <div 
            className={`fixed inset-y-0 ${
              isRTL ? 'right-0 border-l' : 'left-0 border-r'
            } z-50 w-80 max-w-[85vw] bg-white dark:bg-[#070d1a] border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col text-slate-900 dark:text-white animate-in ${
              isRTL ? 'slide-in-from-right' : 'slide-in-from-left'
            } duration-200`}
          >
            {/* Mobile Drawer Header */}
            <div className="p-3.5 bg-slate-50 dark:bg-[#0a1224] border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <SoliLogo className="w-8 h-8 flex-shrink-0 drop-shadow-md" />
                <div>
                  <h2 className="text-xs font-black tracking-tight text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'سولي ميديكال' : 'SOLI MEDICAL'}
                  </h2>
                  <p className="text-[10px] font-mono text-teal-600 dark:text-teal-400 font-semibold leading-none">
                    {lang === 'ar' ? 'العناية المركزة MICU' : 'MICU SYNC'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                  title={settings.theme === 'dark' ? (lang === 'ar' ? 'الوضع النهاري' : 'Day Mode') : (lang === 'ar' ? 'الوضع الليلي' : 'Night Mode')}
                >
                  {settings.theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700 dark:text-indigo-400" />}
                </button>

                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-teal-950/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-mono font-bold transition-all cursor-pointer"
                >
                  <Languages className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-transparent"
                  title={lang === 'ar' ? 'إغلاق القائمة' : 'Close Menu'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile Drawer Navigation Body */}
            {renderNavContent()}
          </div>
        </div>
      )}

      {/* Sticky Desktop Sidebar (Full Height docked on side matching Image 3) */}
      <aside 
        className={`hidden md:flex sticky top-0 bottom-0 z-30 w-72 shrink-0 h-screen bg-white dark:bg-[#070d1a] text-slate-900 dark:text-white flex-col transition-colors duration-200 ${
          isRTL ? 'border-l border-slate-200 dark:border-slate-800/80' : 'border-r border-slate-200 dark:border-slate-800/80'
        }`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Desktop Header */}
        <div className="p-4 bg-slate-50 dark:bg-[#0a1224] border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <SoliLogo className="w-9 h-9 flex-shrink-0 drop-shadow-md" />
            <div>
              <h2 className="text-xs font-black tracking-tight text-slate-900 dark:text-white">
                {lang === 'ar' ? 'سولي ميديكال' : 'SOLI MEDICAL'}
              </h2>
              <p className="text-[10px] font-mono text-teal-600 dark:text-teal-400 font-semibold leading-none">
                {lang === 'ar' ? 'العناية المركزة MICU' : 'MICU SYNC'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all shadow-sm active:scale-95 cursor-pointer"
              title={settings.theme === 'dark' ? (lang === 'ar' ? 'التبديل إلى الوضع النهاري' : 'Switch to Day Mode') : (lang === 'ar' ? 'التبديل إلى الوضع الليلي' : 'Switch to Night Mode')}
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700 dark:text-indigo-400" />}
            </button>

            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/60 border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500/60 text-slate-700 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-300 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              title={lang === 'ar' ? 'التحويل للإنجليزية (English)' : 'Switch to Arabic (العربية)'}
            >
              <Languages className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="font-mono text-[11px]">{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
          </div>
        </div>

        {/* Desktop Navigation Body */}
        {renderNavContent()}
      </aside>

      {/* Standalone Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassModal}
        onClose={() => setShowChangePassModal(false)}
      />
    </>
  );
};
