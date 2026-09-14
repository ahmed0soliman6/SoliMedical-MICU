import React from 'react';
import { Layers, Activity, FileText, Search, UserPlus, Sliders } from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAdmission: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenAdmission,
  onOpenSearch,
  onOpenSettings,
}) => {
  const { settings } = useSystemSettings();
  const { t, lang } = useTranslation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090f1d]/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 pb-safe shadow-2xl">
      <div className="flex items-center justify-around">
        {/* Beds Matrix Tab */}
        {settings.features.enableBedMatrix && (
          <button
            onClick={() => onTabChange('beds')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[54px] ${
              activeTab === 'beds'
                ? 'text-teal-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'beds' ? 'bg-teal-500/15' : ''}`}>
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{t('bedMatrix')}</span>
          </button>
        )}

        {/* SBAR Handover Tab */}
        {settings.features.enableSbarHandover && (
          <button
            onClick={() => onTabChange('sbar')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[54px] ${
              activeTab === 'sbar'
                ? 'text-teal-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'sbar' ? 'bg-teal-500/15' : ''}`}>
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{t('sbarHandover')}</span>
          </button>
        )}

        {/* Quick Admission Middle Button */}
        {settings.features.enableAdmissions && (
          <button
            onClick={onOpenAdmission}
            className="flex flex-col items-center justify-center -mt-4 group active:scale-95 transition-all"
          >
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-teal-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-teal-500/30 border-2 border-[#090f1d]">
              <UserPlus className="w-5 h-5 font-bold" />
            </div>
            <span className="text-[9px] text-teal-400 font-bold mt-1">
              {lang === 'ar' ? 'دخول' : 'Admit'}
            </span>
          </button>
        )}

        {/* Clinical Notes Tab */}
        {settings.features.enableClinicalNotes && (
          <button
            onClick={() => onTabChange('notes')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[54px] ${
              activeTab === 'notes'
                ? 'text-teal-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'notes' ? 'bg-teal-500/15' : ''}`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{t('clinicalNotes')}</span>
          </button>
        )}

        {/* Search / Archive Tab */}
        {settings.features.enableArchiveSearch && (
          <button
            onClick={onOpenSearch}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[54px] text-slate-400 hover:text-slate-200"
          >
            <div className="p-1 rounded-lg">
              <Search className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">
              {lang === 'ar' ? 'الأرشيف' : 'Archive'}
            </span>
          </button>
        )}

        {/* Settings Control Button */}
        <button
          onClick={onOpenSettings}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-w-[54px] text-slate-400 hover:text-teal-300"
        >
          <div className="p-1 rounded-lg">
            <Sliders className="w-5 h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">{t('settings')}</span>
        </button>
      </div>
    </nav>
  );
};

