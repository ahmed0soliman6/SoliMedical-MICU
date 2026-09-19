import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, 
  LogOut, 
  ShieldCheck, 
  CheckCircle2, 
  ShieldAlert, 
  Activity, 
  ChevronRight, 
  ChevronLeft,
  X,
  Sparkles
} from 'lucide-react';
import { useAppNotifications } from '../services/NotificationContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { NotificationType } from '../types/notification.ts';

const getNotificationStyle = (type: NotificationType) => {
  switch (type) {
    case 'ADMISSION':
      return {
        bg: 'bg-emerald-950/95 dark:bg-emerald-950/95 text-emerald-100 border-emerald-500/60 shadow-emerald-900/30',
        iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        badge: 'bg-emerald-900/80 text-emerald-200 border-emerald-600/60',
        Icon: UserPlus,
      };
    case 'DISCHARGE':
    case 'TRANSFER':
      return {
        bg: 'bg-indigo-950/95 dark:bg-indigo-950/95 text-indigo-100 border-indigo-500/60 shadow-indigo-900/30',
        iconBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        badge: 'bg-indigo-900/80 text-indigo-200 border-indigo-600/60',
        Icon: LogOut,
      };
    case 'DEATH':
      return {
        bg: 'bg-slate-900/95 dark:bg-slate-900/95 text-slate-100 border-slate-600/60 shadow-black/40',
        iconBg: 'bg-slate-800 text-slate-300 border-slate-700',
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
        Icon: LogOut,
      };
    case 'SBAR_HANDOVER':
      return {
        bg: 'bg-teal-950/95 dark:bg-teal-950/95 text-teal-100 border-teal-500/60 shadow-teal-900/30',
        iconBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        badge: 'bg-teal-900/80 text-teal-200 border-teal-600/60',
        Icon: ShieldCheck,
      };
    case 'SBAR_RECEIVED':
      return {
        bg: 'bg-cyan-950/95 dark:bg-cyan-950/95 text-cyan-100 border-cyan-500/60 shadow-cyan-900/30',
        iconBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        badge: 'bg-cyan-900/80 text-cyan-200 border-cyan-600/60',
        Icon: CheckCircle2,
      };
    case 'ISOLATION_CHANGE':
      return {
        bg: 'bg-amber-950/95 dark:bg-amber-950/95 text-amber-100 border-amber-500/60 shadow-amber-900/30',
        iconBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        badge: 'bg-amber-900/80 text-amber-200 border-amber-600/60',
        Icon: ShieldAlert,
      };
    case 'CRITICAL_TELEMETRY':
    default:
      return {
        bg: 'bg-rose-950/95 dark:bg-rose-950/95 text-rose-100 border-rose-500/70 shadow-rose-900/30',
        iconBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        badge: 'bg-rose-900/80 text-rose-200 border-rose-600/60',
        Icon: Activity,
      };
  }
};

export const TopNotificationBanner: React.FC = () => {
  const { activeBanner, handleNotificationClick, dismissBanner } = useAppNotifications();
  const { lang, isRTL } = useTranslation();

  return (
    <div className="fixed top-3 inset-x-0 z-50 flex justify-center pointer-events-none px-3 sm:px-6">
      <AnimatePresence>
        {activeBanner && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="pointer-events-auto max-w-lg w-full"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {(() => {
              const style = getNotificationStyle(activeBanner.type);
              const IconComponent = style.Icon;
              const hasAction = !!activeBanner.target;

              return (
                <div
                  onClick={() => handleNotificationClick(activeBanner)}
                  className={`w-full p-3 sm:p-3.5 rounded-2xl border backdrop-blur-md shadow-2xl transition-all ${
                    style.bg
                  } ${hasAction ? 'cursor-pointer hover:brightness-110 active:scale-[0.99]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${style.iconBg}`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold truncate">
                            {lang === 'ar' ? activeBanner.titleAr : activeBanner.titleEn}
                          </h4>
                          {activeBanner.target?.bedNumber && (
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${style.badge}`}>
                              {lang === 'ar' ? `سرير ${activeBanner.target.bedNumber}` : `Bed ${activeBanner.target.bedNumber}`}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-90 truncate mt-0.5">
                          {lang === 'ar' ? activeBanner.messageAr : activeBanner.messageEn}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasAction && (
                        <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-colors">
                          <span>{lang === 'ar' ? 'عرض' : 'View'}</span>
                          {isRTL ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissBanner();
                        }}
                        className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                        title={lang === 'ar' ? 'إغلاق' : 'Dismiss'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
