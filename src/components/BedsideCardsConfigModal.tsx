import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  X, 
  Check, 
  Eye, 
  EyeOff, 
  Wind, 
  Droplet, 
  Scale, 
  Activity, 
  FlaskConical, 
  FileText, 
  Sparkles,
  RotateCcw,
  Microscope,
  Pill
} from 'lucide-react';
import { BedNumber } from '../types/schema.ts';
import { useTranslation } from '../services/i18n.ts';

export interface BedsideCardsConfig {
  showVentilatorCard: boolean;
  showInfusionPumpsCard: boolean;
  showFluidBalanceCard: boolean;
  showLabsCard: boolean;
  showAntibioticsCard: boolean;
  showVitalsCard: boolean;
  showSbarCard: boolean;
  showInvestigationsCard: boolean;
}

export const DEFAULT_BEDSIDE_CARDS_CONFIG: BedsideCardsConfig = {
  showVentilatorCard: true,
  showInfusionPumpsCard: true,
  showFluidBalanceCard: true,
  showLabsCard: true,
  showAntibioticsCard: true,
  showVitalsCard: true,
  showSbarCard: true,
  showInvestigationsCard: true,
};

interface BedsideCardsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  config: BedsideCardsConfig;
  onSaveConfig: (newConfig: BedsideCardsConfig) => void;
}

export const BedsideCardsConfigModal: React.FC<BedsideCardsConfigModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  config,
  onSaveConfig,
}) => {
  const { lang, isRTL } = useTranslation();
  const [localConfig, setLocalConfig] = useState<BedsideCardsConfig>(config || DEFAULT_BEDSIDE_CARDS_CONFIG);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config, isOpen]);

  if (!isOpen) return null;

  const toggleCard = (key: keyof BedsideCardsConfig) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_BEDSIDE_CARDS_CONFIG);
  };

  const handleSave = () => {
    onSaveConfig(localConfig);
    onClose();
  };

  const cardsList: {
    key: keyof BedsideCardsConfig;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    {
      key: 'showVentilatorCard',
      titleAr: 'بطاقة جهاز التنفس الصناعي',
      titleEn: 'Mechanical Ventilator Card',
      descAr: 'عرض إعدادات جهاز التنفس، نسبة الأكسجين FiO2، وضغط PEEP ومؤشرات حماية الرئة',
      descEn: 'Display active vent parameters, FiO2, PEEP, Vt, and lung-protective metrics',
      icon: <Wind className="w-5 h-5 text-cyan-400" />,
      color: 'border-cyan-500/40 bg-cyan-950/20',
    },
    {
      key: 'showInfusionPumpsCard',
      titleAr: 'بطاقة مضخات ومحاليل الحقن الوريدي',
      titleEn: 'Infusion Pumps & Syringe Drivers',
      descAr: 'عرض قنوات المضخات الذكية، أدوية الدعم القلبي والمهدئات وسرعة التنقيط',
      descEn: 'Display vasoactive infusions, sedatives, smart channels, and flow rates',
      icon: <Droplet className="w-5 h-5 text-amber-400" />,
      color: 'border-amber-500/40 bg-amber-950/20',
    },
    {
      key: 'showFluidBalanceCard',
      titleAr: 'بطاقة ميزان السوائل والبول 24 ساعة',
      titleEn: '24h Fluid Balance & Urine Output',
      descAr: 'عرض حساب الوارد والصادر الإجمالي ومعدل إدرار البول بالساعة ومؤشر القصور الكلوي',
      descEn: 'Display 24h intake vs output balance, hourly UOP, and oliguria alert',
      icon: <Scale className="w-5 h-5 text-teal-400" />,
      color: 'border-teal-500/40 bg-teal-950/20',
    },
    {
      key: 'showLabsCard',
      titleAr: 'بطاقة جدول التحاليل المخبرية وغازات الدم (ABG)',
      titleEn: 'Sequential Lab Flowsheet & ABG',
      descAr: 'عرض أعمدة التحاليل المتسلسلة CBC، الكلى، الكبد، غازات الدم، واللاكتات',
      descEn: 'Display sequential lab columns, blood gases, coagulation, and trend analysis',
      icon: <FlaskConical className="w-5 h-5 text-purple-400" />,
      color: 'border-purple-500/40 bg-purple-950/20',
    },
    {
      key: 'showAntibioticsCard',
      titleAr: 'بطاقة المضادات الحيوية والبروتوكول العلاجي',
      titleEn: 'Active Antibiotics & Antimicrobial Therapy',
      descAr: 'عرض وإدارة المضادات الحيوية، الجرعات، التعديل الكلوي، أيام العلاج (DOT)، وتحاليل مستوى الدواء TDM',
      descEn: 'Display and manage active antibiotics, Day of Therapy (DOT), renal adjustment, and TDM levels',
      icon: <Pill className="w-5 h-5 text-amber-400" />,
      color: 'border-amber-500/40 bg-amber-950/20',
    },
    {
      key: 'showVitalsCard',
      titleAr: 'بطاقة المؤشرات الحيوية والمونيتور الحي',
      titleEn: 'Live Vitals & Telemetry Feed',
      descAr: 'عرض الضغط الشرياني الوسطي MAP، النبض، الأكسجين، والحرارة ومقياس الوعي GCS',
      descEn: 'Display live telemetry, arterial blood pressure, heart rate, and GCS/RASS',
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      color: 'border-emerald-500/40 bg-emerald-950/20',
    },
    {
      key: 'showSbarCard',
      titleAr: 'بطاقة تقرير تسليم الشفت والملاحظات السريرية (SBAR)',
      titleEn: 'SBAR Handover & Clinical Notes',
      descAr: 'عرض ملخص المناوبة الطبية والتمريضية والملاحظات الموقعة رقمياً',
      descEn: 'Display structured SBAR shift reports and immutable clinical progress notes',
      icon: <FileText className="w-5 h-5 text-indigo-400" />,
      color: 'border-indigo-500/40 bg-indigo-950/20',
    },
    {
      key: 'showInvestigationsCard',
      titleAr: 'بطاقة الفحوصات الإشعاعية والسونار (Radiology / POCUS)',
      titleEn: 'Radiology, Echo & Bedside Ultrasound',
      descAr: 'عرض طلبات ونتائج أشعة الصدر، الأشعة المقطعية، وإيكو القلب بجانب السرير',
      descEn: 'Display ordered and resulted Chest X-Rays, CT scans, Echo, and point-of-care ultrasound',
      icon: <Microscope className="w-5 h-5 text-rose-400" />,
      color: 'border-rose-500/40 bg-rose-950/20',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#091122] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? `تخصيص بطاقات السرير (سرير ${bedNumber})` : `Bedside Cards Manager (Bed ${bedNumber})`}</span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'إظهار أو إخفاء أو تعديل البطاقات السريرية النشطة في شاشة السرير' : 'Toggle, show/hide, or customize clinical cards displayed in bedside flowsheet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of cards */}
        <div className="p-5 space-y-3 overflow-y-auto">
          {cardsList.map((c) => {
            const isVisible = localConfig[c.key];
            return (
              <div 
                key={c.key}
                onClick={() => toggleCard(c.key)}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                  isVisible 
                    ? `${c.color} border-opacity-70 shadow-sm` 
                    : 'bg-[#060b17] border-slate-800 opacity-60 hover:opacity-90'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-center">
                    {c.icon}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <span>{lang === 'ar' ? c.titleAr : c.titleEn}</span>
                      <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                        isVisible ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isVisible ? (lang === 'ar' ? 'مفعل (ظاهر)' : 'Visible') : (lang === 'ar' ? 'مخفي' : 'Hidden')}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {lang === 'ar' ? c.descAr : c.descEn}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className={`p-2 rounded-xl border transition-all ${
                    isVisible
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'استعادة الافتراضي' : 'Reset to Defaults'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4 text-slate-950" />
              <span>{lang === 'ar' ? 'حفظ إعدادات البطاقات' : 'Apply Layout'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
