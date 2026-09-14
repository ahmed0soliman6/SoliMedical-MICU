import React from 'react';
import { 
  X, 
  Layers, 
  Activity, 
  FileText, 
  Search, 
  UserPlus, 
  Sliders, 
  Languages, 
  ShieldAlert, 
  Cloud, 
  Bell, 
  BellRing,
  Heart,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Users,
  LogOut,
  ShieldCheck,
  UserCircle
} from 'lucide-react';
import { BedRecord, PatientDossier, StaffRole, BedNumber } from '../types/schema.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { SoliLogo } from './SoliLogo.tsx';

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

  const occupiedBedsCount = beds.filter((b) => b.status === 'OCCUPIED').length;
  const criticalCount = patients.filter(
    (p) => p.patientStatus === 'ACTIVE_ICU' && p.acuityLevel === 'CRITICAL_STAT'
  ).length;

  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'ar' : 'en';
    setLanguage(nextLang);
  };

  const handleSelectTab = (tab: string) => {
    onTabChange(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop overlay (only visible on mobile when isOpen is true) */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity animate-fade-in"
        />
      )}

      {/* Sidebar Panel (Persistent on Desktop md:flex, Slide-out Drawer on Mobile) */}
      <aside 
        className={`
          ${isOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0')}
          fixed md:sticky top-0 md:top-16 bottom-0 z-50 md:z-10 w-72 shrink-0 h-full md:h-[calc(100vh-4rem)] bg-[#070d1a] text-white flex flex-col shadow-2xl md:shadow-none overflow-y-auto transition-transform duration-300 ${
            isRTL ? 'right-0 border-l border-slate-800' : 'left-0 border-r border-slate-800'
          }
        `}
      >
        {/* Sidebar Header: Logo, Branding, Language Switcher & Mobile Close button */}
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

          <div className="flex items-center gap-1.5">
            {/* Compact Language Toggle Button */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-teal-950/60 border border-slate-700 hover:border-teal-500/60 text-slate-300 hover:text-teal-300 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              title={lang === 'ar' ? 'التحويل للإنجليزية (English)' : 'Switch to Arabic (العربية)'}
            >
              <Languages className="w-3.5 h-3.5 text-teal-400" />
              <span className="font-mono text-[11px]">{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {/* Close Button for Mobile */}
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User Profile Card */}
        {currentUser && (
          <div className="p-3.5 bg-[#0b1426] border-b border-slate-800/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center font-bold text-teal-300 text-xs font-mono">
                  {currentUser.nameEn.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate max-w-[130px]">
                      {lang === 'ar' ? currentUser.nameAr : currentUser.nameEn}
                    </span>
                    {currentUser.isSuperAdmin && (
                      <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-teal-400/90 font-mono font-medium flex items-center gap-1">
                    <span>{currentUser.role}</span>
                    <span>•</span>
                    <span>{currentUser.badgeId}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors"
                title={lang === 'ar' ? 'تسجيل الخروج وقفل الشاشة' : 'Sign Out / Lock Console'}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
            {lang === 'ar' ? 'الأقسام السريرية' : 'Clinical Modules'}
          </div>

          {/* 1. Bed Matrix */}
          {settings.features.enableBedMatrix && (
            <button
              onClick={() => handleSelectTab('beds')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'beds'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${activeTab === 'beds' ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400'}`}>
                  <Layers className="w-4 h-4" />
                </div>
                <span>{t('bedMatrix')} (6 {lang === 'ar' ? 'أسرة' : 'Beds'})</span>
              </div>
              {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
          )}

          {/* 2. SBAR Handover */}
          {settings.features.enableSbarHandover && (
            <button
              onClick={() => handleSelectTab('sbar')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'sbar'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${activeTab === 'sbar' ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400'}`}>
                  <Activity className="w-4 h-4" />
                </div>
                <span>{t('sbarHandover')}</span>
              </div>
              {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
          )}

          {/* 3. Clinical Notes */}
          {settings.features.enableClinicalNotes && (
            <button
              onClick={() => handleSelectTab('notes')}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'notes'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${activeTab === 'notes' ? 'bg-teal-500/30 text-teal-200' : 'bg-slate-800 text-slate-400'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <span>{t('clinicalNotes')}</span>
              </div>
              {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
          )}

          {/* 6 ICU Beds Pages */}
          <div className="pt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5 border-t border-slate-850/60">
              {lang === 'ar' ? 'مراقبة أسِرّة العناية (ICU Beds)' : 'Bedside Care Pages'}
            </div>
            <div className="space-y-1">
              {beds.map((b) => {
                const patient = b.currentPatientId ? patients.find(p => p.id === b.currentPatientId) : null;
                const isSelected = selectedBedNumber === b.bedNumber;
                return (
                  <button
                    key={b.bedNumber}
                    onClick={() => {
                      onSelectBed(b.bedNumber as BedNumber);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      isSelected
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${patient ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className="font-mono font-bold text-slate-200">{b.bedNumber}</span>
                      <span className="truncate max-w-[120px] text-slate-400 text-[10px] font-semibold">
                        {patient ? (lang === 'ar' ? patient.fullNameAr : patient.fullNameEn) : (lang === 'ar' ? 'شاغر' : 'Vacant')}
                      </span>
                    </div>
                    {isRTL ? <ChevronLeft className="w-3.5 h-3.5 text-slate-600" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
              {lang === 'ar' ? 'الإدارة والخدمات' : 'Management & Tools'}
            </div>
          </div>

          {/* User Management (RBAC) */}
          {(hasPermission('canManageUsers') || currentUser?.isSuperAdmin) && onOpenUserManagement && (
            <button
              onClick={() => {
                onClose();
                onOpenUserManagement();
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-800/60 hover:text-teal-300 transition-all border border-slate-800 hover:border-teal-500/40"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300">
                  <Users className="w-4 h-4" />
                </div>
                <span>{lang === 'ar' ? 'إدارة المستخدمين والصلاحيات (RBAC)' : 'Staff & Access Control'}</span>
              </div>
              {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
          )}

          {/* 4. Admit Patient Quick Action */}
          {hasPermission('canAdmitPatient') && (
            <button
              onClick={() => {
                onClose();
                onOpenAdmission();
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-600/30 to-teal-500/10 hover:from-teal-600/40 hover:to-teal-500/20 border border-teal-500/30 text-teal-200 transition-all shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-300">
                  <UserPlus className="w-4 h-4" />
                </div>
                <span>{lang === 'ar' ? 'إدخال مريض جديد (Admission)' : 'Admit New Patient'}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono">
                + STAT
              </span>
            </button>
          )}

          {/* 5. Patient Archive Search */}
          {settings.features.enableArchiveSearch && (
            <button
              onClick={() => {
                onClose();
                onOpenSearch();
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/60 hover:text-white transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <span>{lang === 'ar' ? 'أرشيف المرضى (MRN Search)' : 'Universal Patient Archive'}</span>
              </div>
              {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
          )}

          {/* 6. Settings */}
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800/60 hover:text-white transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                <Sliders className="w-4 h-4" />
              </div>
              <span>{lang === 'ar' ? 'إعدادات وتخصيص النظام' : t('settings')}</span>
            </div>
            {isRTL ? <ChevronLeft className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

        {/* Sidebar Footer: Unit Status & Standards */}
        <div className="p-3.5 bg-[#060a14] border-t border-slate-800/80 space-y-2 text-xs">
          {/* Quick Stats Pill */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-[#0b1325] border border-slate-800 rounded-lg p-2">
              <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'الأسرة المشغولة' : 'Occupancy'}</div>
              <div dir="ltr" className="text-xs font-bold text-teal-400 font-mono mt-0.5">
                {occupiedBedsCount} / 6
              </div>
            </div>

            <div className="bg-[#0b1325] border border-red-900/30 rounded-lg p-2">
              <div className="text-[10px] text-red-400">{lang === 'ar' ? 'حالات حرجة STAT' : 'Critical STAT'}</div>
              <div className="text-xs font-bold text-red-300 font-mono mt-0.5">
                {criticalCount}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 font-mono">
            <span>CBAHI • JCI • HIPAA</span>
            <span className="text-teal-500/80">{lang === 'ar' ? 'منظومة سولي الطبية' : 'Soli Medical MICU'}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
