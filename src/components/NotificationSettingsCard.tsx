import React, { useState } from 'react';
import { 
  Bell, 
  BellRing, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff, 
  Play, 
  UserPlus, 
  LogOut, 
  ShieldCheck, 
  CheckCircle2, 
  ShieldAlert, 
  Activity, 
  Archive, 
  Sliders,
  HeartPulse,
  RotateCcw,
  Gauge,
  Smartphone,
  Send,
  Radio
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { playGentleNotificationTone } from '../services/NotificationAudio.ts';
import { useAppNotifications } from '../services/NotificationContext.tsx';
import { NotificationType } from '../types/notification.ts';
import { DEFAULT_VITAL_THRESHOLDS, VitalThresholdsConfig } from '../types/settings.ts';

export const NotificationSettingsCard: React.FC = () => {
  const { settings, updateNotificationSettings } = useSystemSettings();
  const { isPushSupported, isPushEnabled, requestPushPermission, triggerNotification } = useAppNotifications();
  const { lang, isRTL } = useTranslation();
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const notifs = settings.notifications;
  const thresholds = notifs.vitalThresholds || DEFAULT_VITAL_THRESHOLDS;

  const handleEnablePush = async () => {
    setIsRequestingPush(true);
    try {
      await requestPushPermission();
    } finally {
      setIsRequestingPush(false);
    }
  };

  const handleSendTestPush = () => {
    triggerNotification({
      type: 'ADMISSION',
      titleAr: 'اختبار إشعارات Firebase Cloud Messaging (FCM)',
      titleEn: 'FCM Web Push Test Notification',
      messageAr: 'تم إرسال الإشعار بنجاح عبر خدمة FCM والتزامن السحابي اللحظي.',
      messageEn: 'Notification successfully delivered via FCM and real-time cloud sync.',
      target: {
        action: 'OPEN_BED',
        bedNumber: '01' as any,
      },
      forceVisual: true,
      forceAudio: true,
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleToggleMasterVisual = () => {
    updateNotificationSettings({ masterVisual: !notifs.masterVisual });
  };

  const handleToggleMasterAudio = () => {
    updateNotificationSettings({ masterAudio: !notifs.masterAudio });
  };

  const handleToggleMute = () => {
    updateNotificationSettings({ isMuted: !notifs.isMuted });
  };

  const handleUpdateThresholds = (changes: Partial<VitalThresholdsConfig>) => {
    updateNotificationSettings({
      vitalThresholds: {
        ...thresholds,
        ...changes,
      },
    });
  };

  const handleResetThresholds = () => {
    updateNotificationSettings({
      vitalThresholds: DEFAULT_VITAL_THRESHOLDS,
    });
  };

  const handleToggleEventVisual = (eventKey: keyof typeof notifs.events) => {
    const current = notifs.events[eventKey];
    updateNotificationSettings({
      events: {
        ...notifs.events,
        [eventKey]: {
          ...current,
          visual: !current.visual,
        },
      },
    });
  };

  const handleToggleEventAudio = (eventKey: keyof typeof notifs.events) => {
    const current = notifs.events[eventKey];
    updateNotificationSettings({
      events: {
        ...notifs.events,
        [eventKey]: {
          ...current,
          audio: !current.audio,
        },
      },
    });
  };

  const previewSound = (type: NotificationType) => {
    playGentleNotificationTone(type, true);
  };

  const eventConfigs: {
    key: keyof typeof notifs.events;
    notifType: NotificationType;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    navNoteAr?: string;
    navNoteEn?: string;
    icon: any;
    color: string;
  }[] = [
    {
      key: 'admission',
      notifType: 'ADMISSION',
      titleAr: 'إضافة وتسكين مريض جديد (Patient Admission)',
      titleEn: 'Patient Admission Alert',
      descAr: 'تنبيه سريري فوري عند تسكين مريض جديد في أحد أسِرّة العناية الستة.',
      descEn: 'Instant clinical notification upon new patient intake or bed allocation.',
      navNoteAr: 'عند النقر على التنبيه: يتم فتح ملف السرير المباشر للمريض.',
      navNoteEn: 'On click: Navigates directly to the bedside flowsheet.',
      icon: UserPlus,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      key: 'discharge',
      notifType: 'DISCHARGE',
      titleAr: 'خروج المريض، التحويل، أو الوفاة (Discharge, Transfer & Mortality)',
      titleEn: 'Discharge, Transfer & Mortality Alert',
      descAr: 'تنبيه فوري عند إتمام إجراءات خروج المريض، نقله للأجنحة، أو توثيق الوفاة.',
      descEn: 'Notification when a patient is discharged, transferred to step-down ward, or marked deceased.',
      navNoteAr: '🎯 عند النقر على التنبيه: يتم التحويل تلقائياً لملف المريض في الأرشيف الطبي.',
      navNoteEn: '🎯 On click: Automatically redirects directly to the patient record in Archive.',
      icon: LogOut,
      color: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      key: 'sbarHandover',
      notifType: 'SBAR_HANDOVER',
      titleAr: 'تسليم مناوبة SBAR (SBAR Shift Handover Signed)',
      titleEn: 'SBAR Shift Handover Signed Alert',
      descAr: 'تنبيه فوري للطاقم الطبي عند توقيع واعتماد تسليم المناوبة السريرية SBAR.',
      descEn: 'Notification triggered when an outgoing clinician signs the SBAR handover report.',
      navNoteAr: '🎯 عند النقر على التنبيه: يتم التحويل مباشرة إلى بطاقة التسليم الخاصة بالمريض.',
      navNoteEn: '🎯 On click: Automatically redirects directly to the specific patient SBAR handover dossier.',
      icon: ShieldCheck,
      color: 'text-teal-600 dark:text-teal-400',
    },
    {
      key: 'sbarReceived',
      notifType: 'SBAR_RECEIVED',
      titleAr: 'استلام وتأكيد مناوبة SBAR (SBAR Handover Received)',
      titleEn: 'SBAR Handover Acknowledged / Received',
      descAr: 'تنبيه تأكيدي يظهر بعد قيام الطبيب أو الممرض المستلم بالضغط على زر الاستلام.',
      descEn: 'Affirmative notification rendered once incoming clinician acknowledges receipt of the handover.',
      navNoteAr: '🎯 يظهر تنبيه فوري عند الضغط على زر استلام المناوبة واعتمادها.',
      navNoteEn: '🎯 Immediate feedback alert after confirming handover reception.',
      icon: CheckCircle2,
      color: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      key: 'isolationChange',
      notifType: 'ISOLATION_CHANGE',
      titleAr: 'تحويل الحالة إلى عزل طبي (Bed Isolation Precautions)',
      titleEn: 'Bed Isolation Status & Precautions',
      descAr: 'تنبيه عند تطبيق أو تعديل تدابير العزل الطبي (تلامسي، رذاذي، هوائي) لسرير المريض.',
      descEn: 'Instant alert when contact, droplet, or airborne isolation protocols are applied to a bed.',
      navNoteAr: 'عند النقر على التنبيه: يتم فتح ملف السرير وقائمة تدابير العزل.',
      navNoteEn: 'On click: Navigates to bed isolation protocol.',
      icon: ShieldAlert,
      color: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="space-y-6 mt-2" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Master Controls Panel (Fully Dual-Theme Responsive) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0a1122] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'التحكم العام بالتنبيهات المرئية والصوتية' : 'Master Notification Controls'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' 
                  ? 'تفعيل أو تعطيل التنبيهات المرئية والصوتية على مستوى المنظومة أو كتم الصوت' 
                  : 'Toggle global visual banners, audible tones, or quick audio mute'}
              </p>
            </div>
          </div>

          {/* Quick Mute Action Button */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
              notifs.isMuted
                ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 hover:bg-amber-200 dark:hover:bg-amber-500/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
            }`}
          >
            {notifs.isMuted ? <VolumeX className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <Volume2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />}
            <span>{notifs.isMuted ? (lang === 'ar' ? 'التنبيهات مكتومة' : 'Muted') : (lang === 'ar' ? 'كتم التنبيهات الصوتية' : 'Mute Sounds')}</span>
          </button>
        </div>

        {/* Master Toggles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Master Visual Toggle */}
          <button
            type="button"
            onClick={handleToggleMasterVisual}
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
              notifs.masterVisual
                ? 'bg-teal-50/80 dark:bg-[#0f172a] border-teal-400 dark:border-teal-500/40 text-slate-900 dark:text-white shadow-sm'
                : 'bg-slate-50 dark:bg-[#040811] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border shrink-0 ${
                notifs.masterVisual 
                  ? 'bg-teal-100 dark:bg-teal-500/20 border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-300' 
                  : 'bg-slate-200 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-600'
              }`}>
                {notifs.masterVisual ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'التنبيهات المرئية العامة (Visual Alerts)' : 'Master Visual Alerts'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'شريط لطيف أعلى الشاشة (2-3 ثواني)' : 'Gentle top-screen banner (2-3s)'}
                </div>
              </div>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
              notifs.masterVisual ? 'bg-teal-600 dark:bg-teal-500' : 'bg-slate-300 dark:bg-slate-800'
            }`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                notifs.masterVisual ? (isRTL ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'
              }`} />
            </div>
          </button>

          {/* Master Audio Toggle */}
          <button
            type="button"
            onClick={handleToggleMasterAudio}
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
              notifs.masterAudio
                ? 'bg-teal-50/80 dark:bg-[#0f172a] border-teal-400 dark:border-teal-500/40 text-slate-900 dark:text-white shadow-sm'
                : 'bg-slate-50 dark:bg-[#040811] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border shrink-0 ${
                notifs.masterAudio 
                  ? 'bg-teal-100 dark:bg-teal-500/20 border-teal-300 dark:border-teal-500/30 text-teal-700 dark:text-teal-300' 
                  : 'bg-slate-200 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-500 dark:text-slate-600'
              }`}>
                {notifs.masterAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'التنبيهات الصوتية العامة (Audio Chimes)' : 'Master Audio Chimes'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'ar' ? 'نغمة لطيفة ومخصصة لكل إجراء' : 'Gentle acoustic sound synthesized per event'}
                </div>
              </div>
            </div>
            <div className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
              notifs.masterAudio ? 'bg-teal-600 dark:bg-teal-500' : 'bg-slate-300 dark:bg-slate-800'
            }`}>
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                notifs.masterAudio ? (isRTL ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'
              }`} />
            </div>
          </button>
        </div>
      </div>

      {/* Firebase Cloud Messaging (FCM) & Web Push Status Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white to-teal-50/40 dark:from-[#0a1122] dark:to-[#0f1d35] border border-teal-200/80 dark:border-teal-500/30 shadow-sm transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'إشعارات الهاتف وتكامل Firebase Cloud Messaging (FCM)' : 'FCM Web Push & Mobile Lock Screen Alerts'}
                </h4>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isPushEnabled
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                    : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                }`}>
                  <Radio className={`w-2.5 h-2.5 ${isPushEnabled ? 'animate-pulse text-emerald-500' : 'text-amber-500'}`} />
                  {isPushEnabled 
                    ? (lang === 'ar' ? 'مفعّلة على هذا الجهاز' : 'Active on Device') 
                    : (lang === 'ar' ? 'غير مفعلة' : 'Disabled / Standby')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'ar'
                  ? 'استلام تنبيهات فورية على شاشة القفل وشريط إشعارات الهاتف عند تسجيل مريض، خروج، أو تسليم مناوبة SBAR.'
                  : 'Receive lock screen and status bar push alerts for admissions, discharges, and SBAR shift handovers.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isPushEnabled && (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isRequestingPush}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <BellRing className="w-4 h-4" />
                <span>
                  {isRequestingPush 
                    ? (lang === 'ar' ? 'جاري التفعيل...' : 'Activating...') 
                    : (lang === 'ar' ? 'تفعيل إشعارات الهاتف' : 'Enable Mobile Push')}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSendTestPush}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>
                {testSent 
                  ? (lang === 'ar' ? 'تم الإرسال بنجاح ✓' : 'Sent Successfully ✓') 
                  : (lang === 'ar' ? 'إرسال إشعار تجريبي' : 'Test Push Alert')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Granular Event Cards Grid (Dual Theme Friendly) */}
      <div className="space-y-3">
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider px-1">
          {lang === 'ar' ? 'تخصيص التنبيهات حسب الحدث السريري (Clinical Event Triggers)' : 'Granular Clinical Event Triggers'}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {eventConfigs.map((evt) => {
            const eventSetting = notifs.events[evt.key] || { visual: true, audio: true };
            const Icon = evt.icon;

            return (
              <div
                key={evt.key}
                className="p-4 rounded-2xl bg-white dark:bg-[#0a1122] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-3.5 shadow-sm"
              >
                {/* Event Header */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 ${evt.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                        {lang === 'ar' ? evt.titleAr : evt.titleEn}
                      </h5>
                    </div>

                    {/* Sound Preview Test Button */}
                    <button
                      type="button"
                      onClick={() => previewSound(evt.notifType)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 dark:bg-slate-900 dark:hover:bg-teal-950/60 border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-500/50 text-slate-700 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 text-[10px] font-mono font-semibold transition-all cursor-pointer shrink-0 shadow-sm"
                      title={lang === 'ar' ? 'سماع النغمة المخصصة' : 'Preview Chime'}
                    >
                      <Play className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                      <span>{lang === 'ar' ? 'تجربة النغمة' : 'Test Sound'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {lang === 'ar' ? evt.descAr : evt.descEn}
                  </p>

                  {evt.navNoteAr && (
                    <div className="text-[11px] font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/40 rounded-lg px-2.5 py-1.5 mt-1">
                      {lang === 'ar' ? evt.navNoteAr : evt.navNoteEn}
                    </div>
                  )}
                </div>

                {/* Granular Toggles (Visual & Audio) */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  {/* Visual Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleEventVisual(evt.key)}
                    className={`p-2 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                      eventSetting.visual
                        ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/40 text-teal-900 dark:text-teal-200'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Eye className={`w-3.5 h-3.5 ${eventSetting.visual ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                      <span className="text-[11px] font-bold">
                        {lang === 'ar' ? 'تنبيه مرئي' : 'Visual Alert'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      eventSetting.visual 
                        ? 'bg-teal-200 dark:bg-teal-500/30 text-teal-800 dark:text-teal-200' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {eventSetting.visual ? (lang === 'ar' ? 'مفعّل' : 'ON') : (lang === 'ar' ? 'معطل' : 'OFF')}
                    </span>
                  </button>

                  {/* Audio Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleEventAudio(evt.key)}
                    className={`p-2 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                      eventSetting.audio
                        ? 'bg-teal-50 dark:bg-teal-500/10 border-teal-300 dark:border-teal-500/40 text-teal-900 dark:text-teal-200'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Volume2 className={`w-3.5 h-3.5 ${eventSetting.audio ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'}`} />
                      <span className="text-[11px] font-bold">
                        {lang === 'ar' ? 'نغمة صوتية' : 'Audio Chime'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      eventSetting.audio 
                        ? 'bg-teal-200 dark:bg-teal-500/30 text-teal-800 dark:text-teal-200' 
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {eventSetting.audio ? (lang === 'ar' ? 'مفعّل' : 'ON') : (lang === 'ar' ? 'معطل' : 'OFF')}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
