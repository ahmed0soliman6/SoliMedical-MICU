import React, { useEffect } from 'react';
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
  MessageSquare
} from 'lucide-react';
import { BedRecord, PatientDossier, BedNumber } from '../types/schema.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { SoliLogo } from './SoliLogo.tsx';
import { getPatientForBed } from '../services/dataModel.ts';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAdmission: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenUserManagement?: () => void;
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
  beds,
  patients,
  selectedBedNumber,
  onSelectBed,
}) => {
  const { settings } = useSystemSettings();
  const { t, lang, setLanguage, isRTL } = useTranslation();
  const { currentUser, logout, hasPermission } = useAuth();

  const occupiedBedsCount = (beds || []).filter((b) => b && b.status === 'OCCUPIED').length;

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
  const SidebarNavContent = () => (
    <div className="flex-1 flex flex-col min-h-0 divide-y divide-slate-800/60">
      {/* Scrollable Navigation Menu */}
      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        <div className="px-2 py-1 text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <LayoutDashboard className="w-3.5 h-3.5 text-teal-400" />
          <span>{lang === 'ar' ? 'لوحة التحكم والأسِرّة' : 'Navigation & Dashboard'}</span>
        </div>

        {/* 1. Bedside Matrix Main Tab */}
        <button
          onClick={() => handleSelectBed(null)}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'beds' && !selectedBedNumber
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm font-bold'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3 truncate">
            <div className={`p-2 rounded-lg ${activeTab === 'beds' && !selectedBedNumber ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400'}`}>
              <Layers className="w-4 h-4" />
            </div>
            <span className="truncate">{lang === 'ar' ? 'لوحة أسرة العناية (6 أسرة)' : 'Bedside Matrix (6 Beds)'}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono font-bold shrink-0">
            {occupiedBedsCount}/6
          </span>
        </button>

        {/* Sub-list of Beds 01 to 06 */}
        <div className="pl-3 pr-1 py-1 space-y-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider px-2 font-semibold">
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
                    ? 'bg-teal-500/25 text-teal-200 border border-teal-500/40 font-bold shadow-sm' 
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`font-mono text-base font-bold ${b.status === 'ISOLATION' ? 'text-red-500' : 'text-teal-400'}`}>{b.bedNumber}</span>
                  <span className="truncate text-sm font-medium">
                    {displayName}
                  </span>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${isOccupied ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-800/60 my-2" />

        <div className="px-2 py-1 text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
          {lang === 'ar' ? 'الأقسام والوظائف' : 'Clinical Modules'}
        </div>

        {/* 2. Patient Admission STAT */}
        {settings.features.enablePatientAdmission && (
          <button
            onClick={() => {
              onClose();
              onOpenAdmission();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/60 hover:text-white transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 truncate">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <UserPlus className="w-4 h-4" />
              </div>
              <span className="truncate">{lang === 'ar' ? 'إدخال مريض جديد (Admission)' : 'Admit New Patient'}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold shrink-0">
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
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm font-bold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 truncate">
              <div className={`p-2 rounded-lg ${activeTab === 'search' ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400'}`}>
                <Search className="w-4 h-4" />
              </div>
              <span className="truncate">{lang === 'ar' ? 'أرشيف المرضى (MRN Search)' : 'Universal Patient Archive'}</span>
            </div>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
          </button>
        )}

        {/* 4. Staff RBAC & User Management */}
        {hasPermission('canManageUsers') && onOpenUserManagement && (
          <button
            onClick={() => handleSelectTab('users')}
            className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm font-bold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 truncate">
              <div className={`p-2 rounded-lg ${activeTab === 'users' ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400'}`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="truncate">{lang === 'ar' ? 'إدارة المستخدمين والصلاحيات' : 'Staff RBAC & Users'}</span>
            </div>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
          </button>
        )}

        {/* 5. Hospital Clinical Chat */}
        <button
          onClick={() => handleSelectTab('chat')}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm font-bold'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3 truncate">
            <div className={`p-2 rounded-lg ${activeTab === 'chat' ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400'}`}>
              <MessageSquare className="w-4 h-4" />
            </div>
            <span className="truncate">{lang === 'ar' ? 'الدردشة السريرية (Chat)' : 'Hospital Clinical Chat'}</span>
          </div>
          {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
        </button>

        {/* 6. System Settings */}
        <button
          onClick={() => handleSelectTab('settings')}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm font-bold'
              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3 truncate">
            <div className={`p-2 rounded-lg ${activeTab === 'settings' ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400'}`}>
              <Sliders className="w-4 h-4" />
            </div>
            <span className="truncate">{lang === 'ar' ? 'إعدادات وتخصيص النظام' : t('settings')}</span>
          </div>
          {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
        </button>
      </div>

      {/* User Profile Footer */}
      {currentUser && (
        <div className="p-3 bg-[#0a1224] border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center font-bold text-teal-300 text-xs font-mono shrink-0">
                {currentUser.nameEn.slice(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                  <span className="truncate">{currentUser.nameAr || currentUser.nameEn}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono font-semibold shrink-0">
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-teal-400 font-mono flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>{lang === 'ar' ? 'الطبيب متاح' : 'Available'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 transition-colors cursor-pointer shrink-0"
              title={lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            >
              <LogOut className="w-4 h-4" />
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
            } z-50 w-80 max-w-[85vw] bg-[#070d1a] border-slate-800 shadow-2xl flex flex-col text-white animate-in ${
              isRTL ? 'slide-in-from-right' : 'slide-in-from-left'
            } duration-200`}
          >
            {/* Mobile Drawer Header */}
            <div className="p-3.5 bg-[#0a1224] border-b border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <SoliLogo className="w-8 h-8 flex-shrink-0 drop-shadow-md" />
                <div>
                  <h2 className="text-xs font-black tracking-tight text-white">
                    {lang === 'ar' ? 'سولي ميديكال' : 'SOLI MEDICAL'}
                  </h2>
                  <p className="text-[10px] font-mono text-teal-400 font-semibold leading-none">
                    {lang === 'ar' ? 'العناية المركزة MICU' : 'MICU SYNC'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-teal-950/60 border border-slate-700 text-slate-300 text-[11px] font-mono font-bold transition-all cursor-pointer"
                >
                  <Languages className="w-3.5 h-3.5 text-teal-400" />
                  <span>{lang === 'ar' ? 'EN' : 'عربي'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                  title={lang === 'ar' ? 'إغلاق القائمة' : 'Close Menu'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile Drawer Navigation Body */}
            <SidebarNavContent />
          </div>
        </div>
      )}

      {/* Sticky Desktop Sidebar (Full Height docked on side matching Image 3) */}
      <aside 
        className={`hidden md:flex sticky top-0 bottom-0 z-30 w-72 shrink-0 h-screen bg-[#070d1a] text-white flex-col border-slate-800 ${
          isRTL ? 'border-l border-slate-800/80' : 'border-r border-slate-800/80'
        }`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Desktop Header */}
        <div className="p-4 bg-[#0a1224] border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <SoliLogo className="w-9 h-9 flex-shrink-0 drop-shadow-md" />
            <div>
              <h2 className="text-xs font-black tracking-tight text-white">
                {lang === 'ar' ? 'سولي ميديكال' : 'SOLI MEDICAL'}
              </h2>
              <p className="text-[10px] font-mono text-teal-400 font-semibold leading-none">
                {lang === 'ar' ? 'العناية المركزة MICU' : 'MICU SYNC'}
              </p>
            </div>
          </div>

          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-teal-950/60 border border-slate-700 hover:border-teal-500/60 text-slate-300 hover:text-teal-300 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            title={lang === 'ar' ? 'التحويل للإنجليزية (English)' : 'Switch to Arabic (العربية)'}
          >
            <Languages className="w-3.5 h-3.5 text-teal-400" />
            <span className="font-mono text-[11px]">{lang === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
        </div>

        {/* Desktop Navigation Body */}
        <SidebarNavContent />
      </aside>
    </>
  );
};
