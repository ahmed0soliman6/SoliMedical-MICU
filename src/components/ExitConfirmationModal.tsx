import React, { useEffect } from 'react';
import { ShieldAlert, LogOut, CheckCircle, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';

interface ExitConfirmationModalProps {
  isOpen: boolean;
  onStay: () => void;
  onConfirmExit: () => void;
}

export const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  isOpen,
  onStay,
  onConfirmExit,
}) => {
  const { lang, isRTL } = useTranslation();

  // Handle ESC key to cancel/stay in system
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onStay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onStay]);

  if (!isOpen) return null;

  return (
    <div
      id="exit-confirmation-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
    >
      <div
        id="exit-confirmation-card"
        className="w-full max-w-md bg-white dark:bg-[#0b1329] border-2 border-amber-500/80 dark:border-amber-500/70 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Top Accent Warning Header */}
        <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-transparent dark:from-amber-500/20 dark:via-rose-500/20 px-5 py-4 border-b border-amber-500/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3
              id="exit-modal-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              {lang === 'ar'
                ? 'تأكيد مغادرة محطة العناية الفائقة'
                : 'Confirm Exit from ICU Station'}
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              {lang === 'ar'
                ? 'حماية منع الخروج العرضي (Accidental Exit Guard)'
                : 'Accidental Exit Protection Active'}
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4 text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
          <div className="flex items-start gap-3 bg-slate-50 dark:bg-[#080e1e] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              {lang === 'ar' ? (
                <>
                  أنت على وشك مغادرة منصة العناية المركزة{' '}
                  <strong className="text-teal-700 dark:text-teal-400">
                    Soli Medical MICU
                  </strong>
                  . تم اعتراض أمر الرجوع بالمتصفح لمنع فقدان شاشة المتابعة السريرية
                  الحية ومراقبة الحالات الحرجة بالخطأ.
                </>
              ) : (
                <>
                  You are about to exit the{' '}
                  <strong className="text-teal-700 dark:text-teal-400">
                    Soli Medical MICU
                  </strong>{' '}
                  critical station. Browser back navigation was intercepted to protect
                  active telemetry monitoring and patient workflows.
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {lang === 'ar'
              ? 'هل ترغب في البقاء بمحطة العناية ومواصلة العمل، أم مغادرة الموقع؟'
              : 'Would you like to remain in the ICU console, or proceed with exiting?'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-4 bg-slate-50/80 dark:bg-[#080f20]/90 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          {/* Stay in System Button (Primary Action) */}
          <button
            type="button"
            id="exit-modal-btn-stay"
            onClick={onStay}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            autoFocus
          >
            <CheckCircle className="w-4 h-4" />
            <span>{lang === 'ar' ? 'البقاء في المنظومة (موصى به)' : 'Stay in System (Recommended)'}</span>
          </button>

          {/* Confirm Exit Button */}
          <button
            type="button"
            id="exit-modal-btn-exit"
            onClick={onConfirmExit}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-[#121c33] dark:hover:bg-rose-950/40 border border-slate-300 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/60 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{lang === 'ar' ? 'مغادرة الموقع' : 'Exit Application'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
