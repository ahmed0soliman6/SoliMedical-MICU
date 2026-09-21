import React, { useEffect } from 'react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
    >
      <div
        id="exit-confirmation-card"
        className="w-full max-w-[320px] bg-white dark:bg-[#0c1427] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 animate-in zoom-in-95 duration-150 text-center"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Simple Warning Icon */}
        <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Short & Direct Message */}
        <p
          id="exit-modal-title"
          className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug px-1"
        >
          {lang === 'ar' ? (
            <>
              أنت على وشك مغادرة <span className="font-bold text-teal-600 dark:text-teal-400 dir-ltr inline-block">solimedical-micu</span>
            </>
          ) : (
            <>
              You are about to leave <span className="font-bold text-teal-600 dark:text-teal-400">solimedical-micu</span>
            </>
          )}
        </p>

        {/* Bottom Buttons */}
        <div className="mt-5 flex items-center justify-center gap-2.5">
          {/* Highlighted Stay Button */}
          <button
            type="button"
            id="exit-modal-btn-stay"
            onClick={onStay}
            className="flex-1 py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-500/20 transition-all active:scale-95 cursor-pointer text-center"
            autoFocus
          >
            {lang === 'ar' ? 'البقاء' : 'Stay'}
          </button>

          {/* Exit Button */}
          <button
            type="button"
            id="exit-modal-btn-exit"
            onClick={onConfirmExit}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 font-medium text-sm transition-all active:scale-95 cursor-pointer text-center"
          >
            {lang === 'ar' ? 'الخروج' : 'Exit'}
          </button>
        </div>
      </div>
    </div>
  );
};
