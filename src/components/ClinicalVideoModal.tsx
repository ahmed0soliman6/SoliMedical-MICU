import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Film, 
  Layers, 
  UserPlus, 
  Activity, 
  Wind, 
  Syringe, 
  Droplet, 
  ArrowRightLeft, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  FastForward,
  Loader2
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';

interface ClinicalVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Scene {
  id: string;
  number: number;
  titleAr: string;
  titleEn: string;
  duration: number; // in seconds
  icon: any;
  color: string;
  actionTextAr: string;
  actionTextEn: string;
  subtitleAr: string;
  subtitleEn: string;
  screenType: 'matrix' | 'admission' | 'vitals' | 'ventilator' | 'infusions' | 'fluid' | 'sbar' | 'discharge';
}

export const ClinicalVideoModal: React.FC<ClinicalVideoModalProps> = ({ isOpen, onClose }) => {
  const { lang, isRTL } = useTranslation();

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0); // 0 to 100%
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const scenes: Scene[] = [
    {
      id: 'matrix',
      number: 1,
      titleAr: '1. نظرة عامة على الكونسول المركزي والأسِرّة الستة',
      titleEn: '1. 6-Bed Central Console Matrix Overview',
      duration: 5,
      icon: Layers,
      color: '#0d9488',
      actionTextAr: 'عرض شاشة المراقبة اللحظية لجميع الأسرة ومعدل الإشغال وحالات العزل السريري.',
      actionTextEn: 'Realtime central overview showing all 6 ICU beds, isolation tags, and occupancy rate.',
      subtitleAr: 'الكونسول المركزي يعرض حالة الأسرة الستة في وقت واحد مع تمييز فوري لحالات العزل وحساب معدل الإشغال السريري.',
      subtitleEn: 'The central console monitors all 6 ICU beds concurrently with instant isolation badges and occupancy statistics.',
      screenType: 'matrix'
    },
    {
      id: 'admission',
      number: 2,
      titleAr: '2. تسجيل وتسكين مريض جديد على السرير (Admission)',
      titleEn: '2. Patient Admission & Bed Allocation',
      duration: 6,
      icon: UserPlus,
      color: '#059669',
      actionTextAr: 'النقر على السرير الشاغر وإدخال بيانات الهوية وحساب الوزن المثالي (IBW) وتدابير العزل.',
      actionTextEn: 'Clicking vacant bed, entering national ID, auto-calculating IBW, and setting isolation precautions.',
      subtitleAr: 'يتم إدخال اسم المريض ورقم الهوية والطول والوزن، ليقوم النظام بحساب الوزن المثالي (IBW) تلقائياً لمعايرة أجهزة التنفس.',
      subtitleEn: 'Patient details and anthropometrics are entered; ideal body weight (IBW) is computed automatically for lung ventilation targets.',
      screenType: 'admission'
    },
    {
      id: 'vitals',
      number: 3,
      titleAr: '3. رصد العلامات الحيوية وحساب الضغط الوسطي (MAP)',
      titleEn: '3. Telemetry Vitals & Real-Time MAP Alert',
      duration: 5,
      icon: Activity,
      color: '#0284c7',
      actionTextAr: 'تسجيل النبض والضغط الشرياني، وحساب MAP تلقائياً مع تنبيه هيموديناميكي عند نزوله عن 65.',
      actionTextEn: 'Logging vitals with instant MAP calculation; critical red alarm triggers if MAP drops below 65 mmHg.',
      subtitleAr: 'عند إدخال قراءات الضغط، يتم احتساب الضغط الشرياني الوسطي MAP لحظياً، ويومض النظام بالأحمر التحذيري إذا قل عن 65 mmHg.',
      subtitleEn: 'System computes Mean Arterial Pressure (MAP) instantaneously, triggering red warning flash if perfusion drops below 65 mmHg.',
      screenType: 'vitals'
    },
    {
      id: 'ventilator',
      number: 4,
      titleAr: '4. ضبط جهاز التنفس الصناعي والتهوية الوقائية',
      titleEn: '4. Mechanical Ventilation & Lung Protection',
      duration: 5,
      icon: Wind,
      color: '#0891b2',
      actionTextAr: 'تحديث أنماط التهوية (SIMV, PRVC)، نسبة الأكسجين FiO2، وضغط PEEP ومطابقة الحجم مع IBW.',
      actionTextEn: 'Updating ventilation modes, FiO2%, PEEP, and validating tidal volume against lung-protective targets.',
      subtitleAr: 'متابعة مؤشرات التنفس الصناعي ومطابقة الحجم المدي (Tidal Volume) مع وزن الرئة المثالي لضمان سلامة مجرى الهواء.',
      subtitleEn: 'Validating lung-protective tidal volumes (6-8 mL/kg of IBW), PEEP levels, and continuous oxygen concentration.',
      screenType: 'ventilator'
    },
    {
      id: 'infusions',
      number: 5,
      titleAr: '5. مضخات التسريب الوريدي وأدوية الإنعاش (Infusion Pumps)',
      titleEn: '5. Vasoactive Infusion Pumps & Titration',
      duration: 5,
      icon: Syringe,
      color: '#d97706',
      actionTextAr: 'برمجة محاليل الضغط والمهدئات مع حساب الجرعة السريرية بالمل/ساعة وتعديلها بضغطة زر.',
      actionTextEn: 'Titrating inotropes, vasopressors, and sedation lines with real-time rate (mL/h) and dosage verification.',
      subtitleAr: 'إدارة وتعديل جرعات أدوية الإنعاش والضغط الحيوية (Norepinephrine, Propofol) مع متابعة خطوط الوريد المركزي (CVC).',
      subtitleEn: 'Managing vital vasoactive infusions (e.g. Norepinephrine) with one-touch titration and central line route verification.',
      screenType: 'infusions'
    },
    {
      id: 'fluid',
      number: 6,
      titleAr: '6. ميزان السوائل 12 ساعة و 24 ساعة (Fluid Balance)',
      titleEn: '6. 12H & 24H Cumulative Fluid Balance',
      duration: 5,
      icon: Droplet,
      color: '#0284c7',
      actionTextAr: 'تسجيل المدخلات الوريدية ومخرجات البول والنزح الجراحي مع حساب المحصلة الصافية (Net Balance).',
      actionTextEn: 'Tracking total IV intake versus urine output/drains with automated positive/negative net calculation.',
      subtitleAr: 'يقوم النظام بحساب صافي توازن السوائل تلقائياً؛ الأزرق للفائض الإيجابي والكهرماني للعجز لتجنب وذمة الرئة.',
      subtitleEn: 'Realtime net fluid balance calculation; positive surplus flagged in blue and negative deficit in amber for hemodynamic safety.',
      screenType: 'fluid'
    },
    {
      id: 'sbar',
      number: 7,
      titleAr: '7. تسليم المناوبة المتقدم SBAR واعتماد الطبيب المستلم',
      titleEn: '7. SBAR Shift Handover & Receiving Doctor Sign-Off',
      duration: 6,
      icon: ArrowRightLeft,
      color: '#e11d48',
      actionTextAr: 'صياغة تقرير التسليم الرباعي، ثم نقر الطبيب المستلم على "استلام المناوبة" لتحديث اسمه على السرير فوراً.',
      actionTextEn: 'Generating SBAR report; incoming doctor clicks "Receive Shift" to immediately take ownership of the bed.',
      subtitleAr: 'توثيق تقرير المناوبة الرباعي SBAR، وفور قيام الطبيب المستلم بالنقر على "استلام المناوبة"، يتحدث اسمه فوراً على شاشة السرير.',
      subtitleEn: 'Structured SBAR transfer; clicking "Receive Shift" instantly updates the assigned attending physician on the bedside console.',
      screenType: 'sbar'
    },
    {
      id: 'discharge',
      number: 8,
      titleAr: '8. خروج المريض والأرشفة السحابية الآمنة (Discharge)',
      titleEn: '8. Patient Discharge & Cloud Archiving',
      duration: 5,
      icon: LogOut,
      color: '#64748b',
      actionTextAr: 'إخلاء السرير ونقل المريض للجناح وتفريغه فورياً، مع حفظ الإقامة في الأرشيف السحابي الدائم.',
      actionTextEn: 'Discharging patient, returning bed to vacant state, and permanently archiving clinical stay to cloud storage.',
      subtitleAr: 'إتمام الخروج يفرغ السرير فوراً لاستقبال حالة حرجة جديدة، مع حفظ كافة القياسات والملاحظات في الأرشيف السحابي الآمن.',
      subtitleEn: 'Discharging vacates bed for incoming emergencies, securely archiving all telemetry and notes to permanent cloud storage.',
      screenType: 'discharge'
    }
  ];

  const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);

  // Playback timer & scene transitions
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const currentScene = scenes[currentSceneIndex];
    const intervalMs = 50;
    const increment = (100 / (currentScene.duration * 1000 / intervalMs)) * playbackSpeed;

    const timer = setInterval(() => {
      setSceneProgress((prev) => {
        if (prev + increment >= 100) {
          // Move to next scene or loop
          if (currentSceneIndex < scenes.length - 1) {
            setCurrentSceneIndex((idx) => idx + 1);
            return 0;
          } else {
            // Reached end, loop back
            setCurrentSceneIndex(0);
            return 0;
          }
        }
        return prev + increment;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, currentSceneIndex, playbackSpeed]);

  if (!isOpen) return null;

  const currentScene = scenes[currentSceneIndex];

  const handleNextScene = () => {
    if (currentSceneIndex < scenes.length - 1) {
      setCurrentSceneIndex(currentSceneIndex + 1);
      setSceneProgress(0);
    } else {
      setCurrentSceneIndex(0);
      setSceneProgress(0);
    }
  };

  const handlePrevScene = () => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex(currentSceneIndex - 1);
      setSceneProgress(0);
    } else {
      setCurrentSceneIndex(scenes.length - 1);
      setSceneProgress(0);
    }
  };

  const handleSelectScene = (index: number) => {
    setCurrentSceneIndex(index);
    setSceneProgress(0);
  };

  const handleExportVideo = async () => {
    setIsExporting(true);
    setExportProgress(10);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas 2D context not available');

      // Check MediaRecorder support
      const stream = canvas.captureStream(30);
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Soli_MICU_Clinical_Workflow_Video_${new Date().toISOString().slice(0, 10)}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };

      mediaRecorder.start();

      // Render each scene smoothly onto the canvas
      for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
        const sc = scenes[sIdx];
        setExportProgress(Math.round(((sIdx + 1) / scenes.length) * 90));

        const frames = sc.duration * 30; // 30 fps
        for (let f = 0; f < frames; f++) {
          const progress = f / frames;

          // Background
          ctx.fillStyle = '#070d1e';
          ctx.fillRect(0, 0, 1280, 720);

          // Top Header Bar
          ctx.fillStyle = '#0f1b38';
          ctx.fillRect(0, 0, 1280, 80);
          ctx.fillStyle = '#14b8a6';
          ctx.font = 'bold 22px Arial, Tahoma';
          ctx.fillText('Soli Medical MICU System - Clinical Video Guide', 40, 48);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '16px Arial, Tahoma';
          ctx.fillText(`Scene ${sc.number} / ${scenes.length}: ${sc.titleEn}`, 40, 120);

          // Center Card Box
          ctx.fillStyle = '#0e172e';
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(40, 140, 1200, 440, 16);
          ctx.fill();
          ctx.stroke();

          // Title inside card
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 28px Arial, Tahoma';
          ctx.fillText(sc.titleAr, 70, 200);

          // Action step
          ctx.fillStyle = '#2dd4bf';
          ctx.font = '20px Arial, Tahoma';
          ctx.fillText(`الخطوة الإجرائية: ${sc.actionTextAr}`, 70, 260);

          // Visual representation / telemetry gauge simulation
          ctx.fillStyle = '#091124';
          ctx.beginPath();
          ctx.roundRect(70, 290, 1140, 200, 12);
          ctx.fill();

          // Simulated data items based on screenType
          if (sc.screenType === 'vitals') {
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('HR: 84 bpm', 100, 360);
            ctx.fillStyle = '#ef4444';
            ctx.fillText('BP: 110/65 (MAP: 80 mmHg)', 380, 360);
            ctx.fillStyle = '#38bdf8';
            ctx.fillText('SpO2: 98% on 40% FiO2', 850, 360);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '18px Arial';
            ctx.fillText('✓ Hemodynamics stable | Target MAP > 65 mmHg', 100, 420);
          } else if (sc.screenType === 'ventilator') {
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('Mode: PRVC (SIMV)', 100, 360);
            ctx.fillStyle = '#2dd4bf';
            ctx.fillText('Vt: 440 mL (6.5 mL/kg IBW)', 480, 360);
            ctx.fillStyle = '#a855f7';
            ctx.fillText('PEEP: 8 cmH2O | FiO2: 45%', 920, 360);
          } else if (sc.screenType === 'sbar') {
            ctx.fillStyle = '#f43f5e';
            ctx.font = 'bold 32px Arial';
            ctx.fillText('S: Sepsis Post-Op Day 2 | B: Septic Shock, CVC Placed', 100, 360);
            ctx.fillStyle = '#38bdf8';
            ctx.fillText('A: Stable on low-dose NorEpi | R: Wean sedation at 08:00', 100, 420);
            ctx.fillStyle = '#22c55e';
            ctx.fillText('✓ Signed & Received by Dr. Incoming MD', 100, 460);
          } else {
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 24px Arial, Tahoma';
            ctx.fillText(sc.subtitleAr, 100, 380);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '18px Arial';
            ctx.fillText(sc.subtitleEn, 100, 430);
          }

          // Subtitle Banner at bottom
          ctx.fillStyle = '#050b18';
          ctx.fillRect(0, 600, 1280, 120);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px Arial, Tahoma';
          ctx.textAlign = 'center';
          ctx.fillText(sc.subtitleAr, 640, 645);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '16px Arial';
          ctx.fillText(sc.subtitleEn, 640, 680);
          ctx.textAlign = 'left';

          // Progress Bar
          ctx.fillStyle = '#0f766e';
          ctx.fillRect(0, 712, 1280 * ((sIdx + progress) / scenes.length), 8);

          // Wait small tick
          await new Promise((r) => setTimeout(r, 10));
        }
      }

      mediaRecorder.stop();
    } catch (err) {
      console.error('Video recording failed:', err);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-[#080e21] border border-slate-700/80 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        
        {/* Video Player Modal Header */}
        <div className="px-5 py-3.5 bg-[#0d162d] border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'فيديو الشرح العملي المصور لمنظومة العناية المركزة' : 'Interactive Clinical Video Walkthrough'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono border border-teal-500/40">
                  Full HD Simulated Video
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'محاكاة حية بالفيديو لجميع مراحل تسجيل المريض، المتابعة، والـ SBAR' : 'Live animated walkthrough covering admission, telemetry, flowsheet, and SBAR'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportVideo}
              disabled={isExporting}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title={lang === 'ar' ? 'تحميل كملف فيديو MP4 / WebM' : 'Download Video File'}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'ar' ? `جارٍ تجهيز الفيديو (${exportProgress}%)...` : `Exporting (${exportProgress}%)...`}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تحميل الفيديو' : 'Download Video'}</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Canvas & Live Screen Simulation */}
        <div className="relative bg-[#050b18] aspect-video w-full flex flex-col justify-between p-4 sm:p-6 select-none overflow-hidden border-b border-slate-800">
          
          {/* Top Video Overlay Bar */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>REC • 1080p</span>
              </span>
              <span className="text-xs text-slate-300 font-mono bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                Scene {currentScene.number} of {scenes.length}
              </span>
            </div>

            <div className="text-xs font-bold text-teal-400 bg-slate-900/90 border border-teal-500/30 px-3 py-1 rounded-xl shadow">
              {lang === 'ar' ? currentScene.titleAr : currentScene.titleEn}
            </div>
          </div>

          {/* Center Stage: Simulated UI Screen Animation */}
          <div className="my-auto z-10 max-w-3xl mx-auto w-full">
            <div className="bg-[#0b1328]/95 border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 backdrop-blur-md">
              
              {/* Scene Badge & Clinical Action */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40">
                    <currentScene.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {lang === 'ar' ? currentScene.titleAr : currentScene.titleEn}
                    </h3>
                    <p className="text-xs text-teal-300 font-medium mt-0.5">
                      {lang === 'ar' ? currentScene.actionTextAr : currentScene.actionTextEn}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-xs font-bold shrink-0">
                  {Math.round(sceneProgress)}%
                </span>
              </div>

              {/* Dynamic UI Simulation per Screen Type */}
              {currentScene.screenType === 'matrix' && (
                <div className="grid grid-cols-3 gap-2.5 py-1 text-center font-mono">
                  {['BED 01 (OCCUPIED)', 'BED 02 (ISOLATION)', 'BED 03 (VACANT)', 'BED 04 (OCCUPIED)', 'BED 05 (OCCUPIED)', 'BED 06 (VACANT)'].map((b, bIdx) => (
                    <div 
                      key={bIdx}
                      className={`p-2.5 rounded-xl border text-xs font-bold ${
                        b.includes('ISOLATION') 
                          ? 'bg-red-950/40 border-red-500/50 text-red-300' 
                          : b.includes('OCCUPIED')
                          ? 'bg-teal-950/40 border-teal-500/50 text-teal-300'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                    >
                      {b}
                    </div>
                  ))}
                </div>
              )}

              {currentScene.screenType === 'admission' && (
                <div className="space-y-2 text-xs">
                  <div className="bg-[#070d1e] p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Patient: <strong>محمد أحمد عبدالله</strong></span>
                    <span className="text-teal-400 font-mono">MRN: 948201</span>
                    <span className="text-emerald-400 font-bold">IBW: 68.2 kg (Auto)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 rounded bg-teal-500/20 text-teal-300 text-[11px] font-bold">✓ Pathway: Emergency (ER)</span>
                    <span className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-[11px] font-bold">✓ Isolation: Contact Precautions</span>
                  </div>
                </div>
              )}

              {currentScene.screenType === 'vitals' && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-[#070d1e] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">HEART RATE</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">86 bpm</span>
                  </div>
                  <div className="bg-[#070d1e] p-3 rounded-xl border border-red-500/40 bg-red-950/20">
                    <span className="text-[10px] text-red-300 block">BP & AUTO MAP</span>
                    <span className="text-lg font-mono font-bold text-red-400">118/72 (87)</span>
                  </div>
                  <div className="bg-[#070d1e] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">SPO2 / FIO2</span>
                    <span className="text-lg font-mono font-bold text-cyan-400">97% / 40%</span>
                  </div>
                </div>
              )}

              {currentScene.screenType === 'ventilator' && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-[#070d1e] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">VENT MODE</span>
                    <span className="text-sm font-mono font-bold text-cyan-300">PRVC / SIMV</span>
                  </div>
                  <div className="bg-[#070d1e] p-3 rounded-xl border border-teal-500/40">
                    <span className="text-[10px] text-teal-300 block">TIDAL VOLUME (IBW)</span>
                    <span className="text-sm font-mono font-bold text-teal-300">440 mL (6.4 ml/kg)</span>
                  </div>
                  <div className="bg-[#070d1e] p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">PEEP / FIO2</span>
                    <span className="text-sm font-mono font-bold text-purple-300">8.0 / 45%</span>
                  </div>
                </div>
              )}

              {currentScene.screenType === 'infusions' && (
                <div className="bg-[#070d1e] p-3 rounded-xl border border-amber-500/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-amber-300 block">Norepinephrine (4mg / 50mL)</span>
                    <span className="text-[10px] text-slate-400">Central Line (CVC) • Rate: 6.0 mL/hr</span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                    0.08 mcg/kg/min
                  </span>
                </div>
              )}

              {currentScene.screenType === 'fluid' && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#070d1e] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">TOTAL INTAKE</span>
                    <span className="font-mono font-bold text-blue-400">+ 1,850 mL</span>
                  </div>
                  <div className="bg-[#070d1e] p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">TOTAL OUTPUT</span>
                    <span className="font-mono font-bold text-amber-400">- 1,420 mL</span>
                  </div>
                  <div className="bg-[#070d1e] p-2.5 rounded-xl border border-emerald-500/40">
                    <span className="text-[10px] text-emerald-400 block">NET BALANCE</span>
                    <span className="font-mono font-bold text-emerald-300">+ 430 mL</span>
                  </div>
                </div>
              )}

              {currentScene.screenType === 'sbar' && (
                <div className="space-y-1.5 text-xs bg-[#070d1e] p-3 rounded-xl border border-rose-500/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300">SBAR Shift Transition</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                      ✓ Received by Incoming MD
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    <strong>Situation:</strong> Septic Shock post appendectomy • <strong>Recommendation:</strong> Wean noradrenaline and monitor ABG at 04:00.
                  </p>
                </div>
              )}

              {currentScene.screenType === 'discharge' && (
                <div className="bg-[#070d1e] p-3 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">Discharge & Transfer to Ward</span>
                    <span className="text-[10px] text-slate-400">Bed 04 Status: VACANT (Ready for Next Patient)</span>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-slate-800 text-teal-300 font-mono font-bold border border-teal-500/30">
                    Cold Cloud Archived
                  </span>
                </div>
              )}

            </div>
          </div>

          {/* Bottom Subtitle Caption Overlay */}
          <div className="z-10 bg-black/80 backdrop-blur-md rounded-xl p-3 text-center border border-slate-800/80 space-y-0.5">
            <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
              {lang === 'ar' ? currentScene.subtitleAr : currentScene.subtitleEn}
            </p>
            <p className="text-[11px] text-slate-400 font-normal">
              {lang === 'ar' ? currentScene.subtitleEn : currentScene.subtitleAr}
            </p>
          </div>

        </div>

        {/* Video Control Bar */}
        <div className="px-5 py-3 bg-[#0c142b] border-t border-slate-700/80 flex flex-col gap-2.5 shrink-0">
          
          {/* Progress Timeline Track */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex cursor-pointer">
            {scenes.map((s, idx) => (
              <div 
                key={s.id}
                onClick={() => handleSelectScene(idx)}
                className="h-full border-r border-slate-900 transition-all relative group"
                style={{ width: `${(s.duration / totalDuration) * 100}%` }}
              >
                <div 
                  className={`h-full ${
                    idx < currentSceneIndex
                      ? 'bg-teal-500'
                      : idx === currentSceneIndex
                      ? 'bg-teal-400'
                      : 'bg-slate-700'
                  }`}
                  style={{
                    width: idx === currentSceneIndex ? `${sceneProgress}%` : idx < currentSceneIndex ? '100%' : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Media Player Controls */}
          <div className="flex items-center justify-between gap-3 text-xs">
            
            {/* Left: Play/Pause, Prev, Next */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all shadow cursor-pointer active:scale-95"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              <button
                onClick={handlePrevScene}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Previous Scene"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={handleNextScene}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Next Scene"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setCurrentSceneIndex(0);
                  setSceneProgress(0);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Restart Video"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <span className="font-mono text-slate-400 text-xs px-2">
                0{currentScene.number} / 0{scenes.length}
              </span>
            </div>

            {/* Center: Scene Quick Navigation Pills */}
            <div className="hidden lg:flex items-center gap-1">
              {scenes.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => handleSelectScene(idx)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer ${
                    currentSceneIndex === idx 
                      ? 'bg-teal-600 text-white shadow-sm' 
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  0{s.number}
                </button>
              ))}
            </div>

            {/* Right: Speed & Download */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-bold text-xs border border-slate-700 cursor-pointer"
                title="Playback Speed"
              >
                {playbackSpeed}x
              </button>

              <button
                onClick={handleExportVideo}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'ar' ? 'تصدير الفيديو' : 'Export Video'}</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
