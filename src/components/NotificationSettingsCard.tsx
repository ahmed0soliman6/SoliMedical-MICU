import React from 'react';
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
  Gauge
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { playGentleNotificationTone } from '../services/NotificationAudio.ts';
import { NotificationType } from '../types/notification.ts';
import { DEFAULT_VITAL_THRESHOLDS, VitalThresholdsConfig } from '../types/settings.ts';

export const NotificationSettingsCard: React.FC = () => {
  const { settings, updateNotificationSettings } = useSystemSettings();
  const { lang, isRTL } = useTranslation();

  const notifs = settings.notifications;
  const thresholds = notifs.vitalThresholds || DEFAULT_VITAL_THRESHOLDS;

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
    playGentleNotificationTone(type);
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
    {
      key: 'criticalTelemetry',
      notifType: 'CRITICAL_TELEMETRY',
      titleAr: 'هبوط المؤشرات الحيوية الطارئ (Emergency Telemetry & STAT Alarms)',
      titleEn: 'Emergency Telemetry & STAT Vitals Alerts',
      descAr: `تنبيه طوارئ فوري عند هبوط الضغط (< ${thresholds.minSystolicBp}/${thresholds.minDiastolicBp} أو MAP < ${thresholds.minMap}) أو نقص الأكسجين (SpO₂ < ${thresholds.minSpo2}%).`,
      descEn: `Urgent telemetry alert on severe hypotension (< ${thresholds.minSystolicBp}/${thresholds.minDiastolicBp}, MAP < ${thresholds.minMap}) or hypoxia (SpO₂ < ${thresholds.minSpo2}%).`,
      icon: Activity,
      color: 'text-rose-600 dark:text-rose-400',
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

      {/* Vital Signs Alert Thresholds Customization (التحكم في حدود العلامات الحيوية) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0a1122] border border-slate-200 dark:border-slate-800 shadow-sm transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'معايير وحدود تنبيهات العلامات الحيوية (Vital Signs Alert Thresholds)' : 'Vital Signs STAT Alert Thresholds'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' 
                  ? 'ضبط حدود انخفاض الضغط والأكسجين التي يُطلق عندها النظام تنبيهاً طارئاً' 
                  : 'Customize critical thresholds for hypotension, desaturation, and telemetry alarms'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetThresholds}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
              title={lang === 'ar' ? 'استعادة القيم الافتراضية' : 'Reset to Defaults'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'الافتراضي (90/50 - 80%)' : 'Reset (90/50 - 80%)'}</span>
            </button>
          </div>
        </div>

        {/* Master Telemetry Trigger Switch */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? 'تفعيل تنبيهات الطوارئ للعلامات الحيوية (Telemetry Emergency Monitor)' : 'Enable Telemetry Vitals Safety Monitor'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'ar' ? 'مراقبة هبوط الضغط والأكسجين والتنبيه الفوري في الكونسول ومركز الإشعارات' : 'Auto-detect acute hypotension, hypoxia or severe brady/tachycardia for active beds'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleUpdateThresholds({ enableTelemetryAlerts: !thresholds.enableTelemetryAlerts })}
            className={`w-10 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 cursor-pointer ${
              thresholds.enableTelemetryAlerts ? 'bg-rose-600 dark:bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
              thresholds.enableTelemetryAlerts ? (isRTL ? '-translate-x-4' : 'translate-x-4') : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Numeric Threshold Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Blood Pressure Systolic */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070d19] border border-slate-200 dark:border-slate-800/80 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>{lang === 'ar' ? 'الحد الأدنى للانقباضي (Systolic BP)' : 'Min Systolic BP'}</span>
              <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold">&lt; {thresholds.minSystolicBp} mmHg</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={60}
                max={120}
                step={5}
                value={thresholds.minSystolicBp}
                onChange={(e) => handleUpdateThresholds({ minSystolicBp: Number(e.target.value) || 90 })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
              <span className="text-xs text-slate-500 font-mono">mmHg</span>
            </div>
          </div>

          {/* Blood Pressure Diastolic */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070d19] border border-slate-200 dark:border-slate-800/80 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>{lang === 'ar' ? 'الحد الأدنى للانبساطي (Diastolic BP)' : 'Min Diastolic BP'}</span>
              <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold">&lt; {thresholds.minDiastolicBp} mmHg</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={30}
                max={70}
                step={5}
                value={thresholds.minDiastolicBp}
                onChange={(e) => handleUpdateThresholds({ minDiastolicBp: Number(e.target.value) || 50 })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
              <span className="text-xs text-slate-500 font-mono">mmHg</span>
            </div>
          </div>

          {/* Oxygen Saturation SpO2 */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070d19] border border-slate-200 dark:border-slate-800/80 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>{lang === 'ar' ? 'الحد الأدنى للأكسجين (SpO₂)' : 'Min SpO₂ Saturation'}</span>
              <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">&lt; {thresholds.minSpo2}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={60}
                max={95}
                step={1}
                value={thresholds.minSpo2}
                onChange={(e) => handleUpdateThresholds({ minSpo2: Number(e.target.value) || 80 })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
              <span className="text-xs text-slate-500 font-mono">%</span>
            </div>
          </div>

          {/* Mean Arterial Pressure MAP */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#070d19] border border-slate-200 dark:border-slate-800/80 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>{lang === 'ar' ? 'الحد الأدنى لـ MAP' : 'Min MAP (Mean BP)'}</span>
              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-bold">&lt; {thresholds.minMap} mmHg</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={50}
                max={80}
                step={1}
                value={thresholds.minMap}
                onChange={(e) => handleUpdateThresholds({ minMap: Number(e.target.value) || 60 })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
              <span className="text-xs text-slate-500 font-mono">mmHg</span>
            </div>
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
