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
