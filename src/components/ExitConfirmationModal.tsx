import React, { useEffect } from 'react';
import { LogOut, AlertTriangle, ShieldCheck, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#0b1224] border border-amber-500/40 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-5 animate-in zoom-in-95 duration-150"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              {lang === 'ar' ? 'تأكيد مغادرة النظام (حماية الخروج)' : 'Exit Protection Confirmation'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {lang === 'ar' 
                ? 'هل أنت متأكد من رغبتك في الخروج من نظام المراقبة المركزية للعناية المركزة؟' 
                : 'Are you sure you want to leave the MICU Central Monitoring station?'}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
          {lang === 'ar'
            ? '⚠️ إبقاء المحطة نشطة يضمن استمرار استقبال الإنذارات السريرية وتحديثات الأسرة لحظياً.'
            : '⚠️ Keeping the station active ensures continuous clinical telemetry & stat bedside alerts.'}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onStay}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all cursor-pointer active:scale-95"
          >
            {lang === 'ar' ? 'البقاء في النظام (موصى به)' : 'Stay in System (Recommended)'}
          </button>
          <button
            type="button"
            onClick={onConfirmExit}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 border border-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'تأكيد الخروج' : 'Confirm Exit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitConfirmationModal;
