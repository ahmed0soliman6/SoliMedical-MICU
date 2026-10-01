import React, { useState } from 'react';
import { usePWAInstall } from '../services/usePWAInstall.ts';
import { useTranslation } from '../services/i18n.ts';
import { 
  CheckCircle2, 
  Download, 
  Smartphone, 
  Share, 
  X, 
  HelpCircle,
  ArrowUpRight,
  Info
} from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full' | 'sidebar';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'compact',
  className = ''
}) => {
  const { isInstallable, isInstalled, isIOS, isIPad, triggerInstall } = usePWAInstall();
  const { lang, isRTL } = useTranslation();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running in installed standalone mode, show subtle verified badge or null in compact
  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className={`p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 flex items-center gap-2.5 ${className}`}>
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

  // If the device is not installable (and not iOS/iPad which we always offer manual guide for), hide the button
  if (!isInstallable) {
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
    <div className={className}>
      {justInstalled && (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold shadow-lg flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>
            {lang === 'ar'
              ? 'تم تثبيت تطبيق Soli Medical MICU بنجاح!'
              : 'Soli Medical MICU installed successfully!'}
          </span>
        </div>
      )}

      {/* Button Render depending on Variant */}
      {variant === 'compact' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'تثبيت التطبيق' : 'Install App'}</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full p-2.5 rounded-xl bg-gradient-to-r from-teal-600/20 to-cyan-600/10 hover:from-teal-600/30 hover:to-cyan-600/20 border border-teal-500/30 hover:border-teal-400/50 flex items-center gap-2.5 text-left transition-all cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Smartphone className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-white flex items-center gap-1 justify-between">
              <span>{lang === 'ar' ? 'تثبيت التطبيق على الجهاز' : 'Install ICU-Sync App'}</span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {lang === 'ar' ? 'تشغيل أسرع وبدون إنترنت' : 'Faster load & offline support'}
            </p>
          </div>
        </button>
      )}

      {variant === 'full' && (
        <div className="p-5 rounded-2xl bg-[#080d1a] border border-teal-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-teal-400" />
              <span>{lang === 'ar' ? 'تشغيل منصة ICU-Sync كتطبيق مستقل' : 'Run ICU-Sync as a Desktop / Mobile App'}</span>
            </h3>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
              {lang === 'ar'
                ? 'ثبت التطبيق مباشرة على شاشتك للاستفادة من كامل الميزات بدون شريط التصفح، والحصول على إشعارات دفع فورية ودعم تشغيل غير متقطع ومستقر.'
                : 'Install the platform directly onto your desktop Central Station or mobile tablet. Enjoy full-screen bedside displays, zero browser bar distraction, and real-time push alerts.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-teal-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>{lang === 'ar' ? 'تثبيت التطبيق الآن' : 'Install App Now'}</span>
          </button>
        </div>
      )}

      {/* iOS Safari Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-md bg-[#0a1224] border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4 text-center"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'تثبيت على أجهزة iOS / iPad' : 'Install on iOS / iPad'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-slate-300 text-xs py-2">
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-[11px] text-teal-300 leading-normal text-start">
                {lang === 'ar'
                  ? 'يتطلب متصفح Safari على أجهزة Apple إضافتها يدوياً إلى الشاشة الرئيسية.'
                  : 'Apple iOS requires manually adding the web app via Safari.'}
              </div>

              <div className="space-y-3.5 text-start font-medium">
                <div className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center text-xs shrink-0 font-bold">1</div>
                  <p className="leading-relaxed">
                    {lang === 'ar'
                      ? 'اضغط على زر المشاركة (Share) في شريط متصفح Safari السفلي.'
                      : 'Tap the share button in Safari (icon with an arrow pointing out of a box).'}
                  </p>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center text-xs shrink-0 font-bold">2</div>
                  <p className="leading-relaxed flex items-center gap-1.5 flex-wrap">
                    <span>{lang === 'ar' ? 'مرر للأسفل واضغط على' : 'Scroll down and tap'}</span>
                    <strong className="text-white border border-slate-700 px-1.5 py-0.5 rounded bg-slate-800/80 text-[11px] font-bold">
                      {lang === 'ar' ? 'إضافة إلى الشاشة الرئيسية' : 'Add to Home Screen'}
                    </strong>
                    <Share className="w-3.5 h-3.5 text-teal-400 inline" />
                  </p>
                </div>

                <div className="flex gap-3 items-start">
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center text-xs shrink-0 font-bold">3</div>
                  <p className="leading-relaxed">
                    {lang === 'ar'
                      ? 'أكد الإضافة بالضغط على "إضافة" في الزاوية العلوية اليمنى.'
                      : 'Tap "Add" in the top right corner to complete installation.'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all"
            >
              {lang === 'ar' ? 'حسناً، فهمت' : 'Got it, thanks!'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
