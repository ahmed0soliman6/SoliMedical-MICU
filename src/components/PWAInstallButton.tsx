import React, { useState } from 'react';
import { 
  Download, 
  Smartphone, 
  Tablet, 
  Monitor, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  X, 
  Sparkles,
  Info
} from 'lucide-react';
import { usePWAInstall } from '../services/usePWAInstall.ts';
import { useTranslation } from '../services/i18n.ts';
import { SoliLogo } from './SoliLogo.tsx';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'sidebar';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'compact',
  className = ''
}) => {
  const { isInstalled, isIOS, isIPad, triggerInstall } = usePWAInstall();
  const { lang, isRTL } = useTranslation();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running in installed standalone mode, show subtle verified badge or null in compact
  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className={`p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-center gap-2.5 ${className}`}>
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-[11px] font-semibold text-teal-800 dark:text-teal-200 truncate">
            {lang === 'ar' ? 'تطبيق مثبت (PWA Standalone)' : 'App Installed (Standalone)'}
          </div>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    const result = await triggerInstall();
    if (result === 'manual-ios') {
      setShowIosGuide(true);
    } else if (result === 'accepted') {
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 4000);
    }
  };

  return (
    <>
      {variant === 'sidebar' && (
        <button
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-teal-500/15 to-cyan-500/15 hover:from-teal-500/25 hover:to-cyan-500/25 text-teal-900 dark:text-teal-200 border border-teal-400/40 dark:border-teal-500/40 shadow-sm transition-all active:scale-98 cursor-pointer ${className}`}
          title={lang === 'ar' ? 'تثبيت النظام كتطبيق على جهازك (كمبيوتر / هاتف / آيباد)' : 'Install App on your PC, Tablet or Phone'}
        >
          <div className="flex items-center gap-3 truncate">
            <div className="p-2 rounded-lg bg-teal-500 text-white shadow-sm shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div className={`truncate ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {lang === 'ar' ? 'تثبيت تطبيق النظام' : 'Install ICU Web App'}
              </div>
              <div className="text-[10px] text-teal-700 dark:text-teal-400 font-mono">
                {isIOS || isIPad ? (lang === 'ar' ? 'iPad / iPhone' : 'iOS / iPadOS') : (lang === 'ar' ? 'PC / Android' : 'PC / Mobile / Tablet')}
              </div>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-800 dark:text-teal-300 font-bold shrink-0 border border-teal-500/30">
            PWA
          </span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/50 dark:hover:bg-teal-900/60 border border-teal-300 dark:border-teal-700/60 text-teal-800 dark:text-teal-300 font-medium text-xs shadow-sm transition-all active:scale-95 cursor-pointer ${className}`}
          title={lang === 'ar' ? 'تثبيت التطبيق على جهازك' : 'Install as PWA Web App'}
        >
          <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span className="hidden sm:inline font-semibold">
            {lang === 'ar' ? 'تثبيت التطبيق' : 'Install App'}
          </span>
        </button>
      )}

      {variant === 'full' && (
        <button
          onClick={handleInstallClick}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-md transition-all active:scale-95 cursor-pointer ${className}`}
        >
          <Download className="w-4 h-4" />
          <span>
            {lang === 'ar' ? 'تثبيت النظام كتطبيق ويب مستقل' : 'Install ICU-Sync App'}
          </span>
        </button>
      )}

      {/* iOS / iPadOS Safari Guided Instructions Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div 
            className="bg-white dark:bg-[#0c1427] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 end-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <SoliLogo className="w-12 h-12 shrink-0 drop-shadow-md" />
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'تثبيت التطبيق على iPad / iPhone' : 'Install App on iPad / iPhone'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'يعمل كتطبيق كامل الشاشة وبدون شريط المتصفح' : 'Runs as a full-screen standalone ICU application'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#070d18] border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'اضغط على زر المشاركة (Share) ' : 'Tap the Safari Share button '}
                  </span>
                  <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px]">
                    <Share className="w-3.5 h-3.5 inline" /> {lang === 'ar' ? 'مشاركة' : 'Share'}
                  </span>
                  <span>{lang === 'ar' ? 'في أسفل أو أعلى متصفح Safari.' : 'in your Safari toolbar.'}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'اختر "إضافة إلى الشاشة الرئيسية"' : 'Select "Add to Home Screen"'}
                  </span>
                  <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[11px]">
                    <PlusSquare className="w-3.5 h-3.5 inline" /> {lang === 'ar' ? 'إضافة إلى الشاشة الرئيسية' : 'Add to Home Screen'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {lang === 'ar' ? 'اضغط على "إضافة" (Add)' : 'Tap "Add" in the top right corner'}
                  </span>
                  <span>
                    {lang === 'ar' 
                      ? ' وسيظهر أيقونة وشعار Soli Medical الرسمي كتطبيق مباشر على شاشتك!' 
                      : ' and the official Soli Medical logo will appear directly on your home screen!'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowIosGuide(false)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                {lang === 'ar' ? 'فهمت، حسناً' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
