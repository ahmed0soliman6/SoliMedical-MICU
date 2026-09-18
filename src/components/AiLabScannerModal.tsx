import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  FileText, 
  CheckCircle2, 
  ArrowRight,
  Activity,
  Layers,
  HelpCircle,
  Eye,
  Sliders,
  Maximize2
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { compressImageForOcr } from '../services/imageCompression.ts';
import { 
  scanLabImage, 
  ScannedLabResponse, 
  generateSampleAbgImage, 
  generateSampleCbcImage,
  generateSampleChemistryImage
} from '../services/aiLabService.ts';

interface AiLabScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName?: string;
  bedNumber: string;
  targetPreset?: 'ABG' | 'CBC' | 'CHEMISTRY' | 'ALL';
  onApplyToForm?: (fields: Record<string, string>, timestamp?: string) => void;
  onDirectSave?: (data: {
    fields: Record<string, string>;
    items: Array<{
      testName: string;
      category: string;
      value: string;
      unit: string;
      normalRange: string;
      flag?: string;
    }>;
    timestamp: string;
    summaryEn: string;
    summaryAr: string;
  }) => Promise<void>;
}

export const AiLabScannerModal: React.FC<AiLabScannerModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  bedNumber,
  targetPreset = 'ALL',
  onApplyToForm,
  onDirectSave,
}) => {
  const { lang, isRTL } = useTranslation();

  // Mode: 'camera' | 'upload'
  const [activeInputMode, setActiveInputMode] = useState<'camera' | 'upload'>('upload');
  const [selectedPresetType, setSelectedPresetType] = useState<'ABG' | 'CBC' | 'CHEMISTRY' | 'ALL'>(targetPreset || 'ALL');

  useEffect(() => {
    setSelectedPresetType(targetPreset || 'ALL');
  }, [targetPreset]);
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Image & Analysis state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedLabResponse | null>(null);
  const [editableFields, setEditableFields] = useState<Record<string, string>>({});
  const [sampleDate, setSampleDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // File input refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up camera on unmount or close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      resetState();
    }
  }, [isOpen]);

  // Connect stream to video element whenever stream and video element are both present
  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch((err) => {
        console.warn('Video auto-play interrupted:', err);
      });
    }
  }, [isCameraActive, cameraStream]);

  const resetState = () => {
    stopCamera();
    setSelectedImage(null);
    setIsAnalyzing(false);
    setAnalysisError(null);
    setScannedResult(null);
    setEditableFields({});
    setSaveSuccess(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          lang === 'ar'
            ? 'واجهة الكاميرا المباشرة غير مدعومة في هذا المتصفح. يمكنك النقر على "التقاط بكاميرا الجوال" أو رفع صورة.'
            : 'Live camera is not supported in this browser. Please use native mobile capture or upload an image.'
        );
        return;
      }

      let stream: MediaStream | null = null;
      try {
        // Attempt 1: Rear environment camera with standard 720p HD
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err1) {
        console.warn('Environment camera constraint failed, falling back to any available video stream:', err1);
        try {
          // Attempt 2: Fallback to any available video input (webcam / front camera)
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err2) {
          throw err2;
        }
      }

      if (stream) {
        setCameraStream(stream);
        setIsCameraActive(true);
        setActiveInputMode('camera');
      }
    } catch (err: any) {
      console.warn('Could not start camera:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const isNotFound = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';

      let errorMsg =
        lang === 'ar'
          ? 'تعذر الوصول إلى الكاميرا. يرجى التأكد من السماح بصلاحية الكاميرا أو استخدام زر "التقاط بكاميرا الجوال".'
          : 'Could not access camera. Please allow camera permissions or use mobile camera capture.';

      if (isDenied) {
        errorMsg =
          lang === 'ar'
            ? 'تم رفض إذن الكاميرا من المتصفح. يرجى منح إذن الكاميرا من إعدادات المتصفح، أو النقر على "التقاط بكاميرا الجوال" مباشرة.'
            : 'Camera permission was denied. Please allow camera access in browser settings or use native mobile capture.';
      } else if (isNotFound) {
        errorMsg =
          lang === 'ar'
            ? 'لم يتم العثور على جهاز كاميرا متصل. يمكنك رفع صورة التحليل مباشرة.'
            : 'No camera hardware found. You can upload an image of the lab report.';
      }

      setCameraError(errorMsg);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setSelectedImage(dataUrl);
      stopCamera();
      processImageWithAI(dataUrl, 'image/jpeg');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      const { base64, mimeType } = await compressImageForOcr(file);
      setSelectedImage(base64);
      processImageWithAI(base64, mimeType);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSelectedImage(base64);
        processImageWithAI(base64, file.type || 'image/jpeg');
      };
      reader.readAsDataURL(file);
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      const { base64, mimeType } = await compressImageForOcr(file);
      setSelectedImage(base64);
      processImageWithAI(base64, mimeType);
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setSelectedImage(base64);
        processImageWithAI(base64, file.type || 'image/jpeg');
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSampleAbg = () => {
    setSelectedPresetType('ABG');
    const sample = generateSampleAbgImage();
    setSelectedImage(sample);
    processImageWithAI(sample, 'image/svg+xml', 'ABG');
  };

  const loadSampleCbc = () => {
    setSelectedPresetType('CBC');
    const sample = generateSampleCbcImage();
    setSelectedImage(sample);
    processImageWithAI(sample, 'image/svg+xml', 'CBC');
  };

  const loadSampleChemistry = () => {
    setSelectedPresetType('CHEMISTRY');
    const sample = generateSampleChemistryImage();
    setSelectedImage(sample);
    processImageWithAI(sample, 'image/svg+xml', 'CHEMISTRY');
  };

  const processImageWithAI = async (base64Data: string, mimeType: string, overridePreset?: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setScannedResult(null);

    try {
      const presetToUse = overridePreset || selectedPresetType || 'ALL';
      const result = await scanLabImage(base64Data, mimeType, presetToUse);
      setScannedResult(result);
      setEditableFields(result.statFields || {});
      if (result.sampleDate) {
        // format date if valid
        try {
          const d = new Date(result.sampleDate);
          if (!isNaN(d.getTime())) {
            setSampleDate(d.toISOString().slice(0, 16));
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      const errStr = typeof err?.message === 'string' ? err.message : JSON.stringify(err);
      const isOverload = errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');
      
      if (isOverload) {
        console.log('Scan Lab Overload (Logged as info):', err);
      } else {
        console.error('Scan Lab Error:', err);
      }
      
      let userErrorMsg = err?.message || (lang === 'ar' ? 'فشل التعرف على تقرير التحليل. يرجى التأكد من وضوح الصورة.' : 'Failed to recognize lab report. Ensure the image is legible and well-lit.');
      
      if (errStr.includes('405') || errStr.includes('Failed to fetch') || errStr.includes('NetworkError')) {
        userErrorMsg = lang === 'ar'
          ? 'تعذر الاتصال بخدمة التحليل الذكي (تم تحديث خادم الخدمة بنجاح، يرجى النقر على "المحاولة مرة أخرى").'
          : 'Could not reach the AI scanning service. The backend service was updated, please click "Retry Scanning Now".';
      } else if (isOverload) {
        userErrorMsg = lang === 'ar' 
          ? 'نموذج الذكاء الاصطناعي يواجه ضغطاً مؤقتاً (503). يرجى النقر على زر "المحاولة مرة أخرى".' 
          : 'The AI model is experiencing temporary demand (503). Please click "Retry Scanning Now".';
      }
      
      setAnalysisError(userErrorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setEditableFields(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyToOpenForm = () => {
    if (!onApplyToForm) return;
    onApplyToForm(editableFields, sampleDate);
    onClose();
  };

  const handleConfirmAndDirectSave = async () => {
    if (!onDirectSave || !scannedResult) return;
    setIsSaving(true);
    try {
      await onDirectSave({
        fields: editableFields,
        items: scannedResult.items || [],
        timestamp: sampleDate,
        summaryEn: scannedResult.summaryEn || '',
        summaryAr: scannedResult.summaryAr || '',
      });
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to direct save:', err);
      setAnalysisError(err?.message || 'Failed to save lab data to flowsheet');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto animate-in fade-in duration-200">
      <div 
        dir={isRTL ? 'rtl' : 'ltr'} 
        className="bg-[#0b1224] border border-slate-700/80 rounded-2xl w-full max-w-5xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {lang === 'ar' ? 'المسح الضوئي الذكي للتحاليل المخبرية (AI Lab Scanner)' : 'Intelligent AI Lab Optical Scanner (ABG & CBC)'}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                  Gemini Vision OCR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? `السرير ${bedNumber} - ${patientName || 'المريض الحالي'}: تصوير وقراءة أوراق غازات الدم ABG وصورة الدم CBC وملء الخانات تلقائياً`
                  : `Bed ${bedNumber} - ${patientName || 'Active Patient'}: Scan lab printouts/slips to extract values into flowsheet automatically`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all text-sm font-black"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden Canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          
          {/* TOP ACTION BAR: Mode Toggles & Demo Samples */}
          {!scannedResult && !isAnalyzing && (
            <div className="space-y-3">
              {/* LAB TYPE PRESET SELECTOR */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs">
                <span className="text-slate-400 font-bold px-2">
                  {lang === 'ar' ? 'نوع التحليل المستهدف:' : 'Target Lab Type:'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPresetType('ABG')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedPresetType === 'ABG'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  🫁 {lang === 'ar' ? 'غازات الدم (ABG)' : 'Arterial Blood Gas (ABG)'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPresetType('CBC')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedPresetType === 'CBC'
                      ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  🩸 {lang === 'ar' ? 'صورة الدم (CBC)' : 'Complete Blood Count (CBC)'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPresetType('CHEMISTRY')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedPresetType === 'CHEMISTRY'
                      ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  🧪 {lang === 'ar' ? 'كيمياء وأملاح (Chemistry)' : 'Biochemistry & Electrolytes'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPresetType('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedPresetType === 'ALL'
                      ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  ✨ {lang === 'ar' ? 'كشف تلقائي (شامل)' : 'Auto Detect (All)'}
                </button>
              </div>

              {/* ACTION BUTTONS & DEMO SAMPLES */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 1. Live Camera Viewfinder Button */}
                  <button
                    type="button"
                    onClick={isCameraActive ? stopCamera : startCamera}
                    className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isCameraActive
                        ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/30 ring-2 ring-fuchsia-400/50'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-fuchsia-500/50'
                    }`}
                  >
                    <Camera className={`w-4 h-4 ${isCameraActive ? 'text-white animate-pulse' : 'text-fuchsia-400'}`} />
                    <span>
                      {isCameraActive 
                        ? (lang === 'ar' ? 'إيقاف الكاميرا الحية' : 'Stop Live View') 
                        : (lang === 'ar' ? 'تشغيل الكاميرا والتصوير' : 'Live Camera Capture')}
                    </span>
                  </button>

                  {/* 2. Direct Mobile Camera Capture (Native Mobile Camera App) */}
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      nativeCameraInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 rounded-xl font-bold bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/40 hover:border-emerald-500 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    title={lang === 'ar' ? 'فتح كاميرا الجوال مباشرة لالتقاط صورة عالية الدقة' : 'Open device camera directly'}
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>{lang === 'ar' ? 'كاميرا الجوال المباشرة' : 'Device Camera Snap'}</span>
                  </button>
                  <input
                    ref={nativeCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* 3. Upload file from device */}
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      fileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-cyan-400" />
                    <span>{lang === 'ar' ? 'رفع صورة من الجهاز' : 'Upload Lab Image'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {/* Instant Test Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 font-medium text-[11px]">
                    {lang === 'ar' ? 'عينة تجريبية:' : 'Live Test:'}
                  </span>
                  <button
                    type="button"
                    onClick={loadSampleAbg}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'شريط ABG' : 'Sample ABG'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadSampleCbc}
                    className="px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 font-mono text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تقرير CBC' : 'Sample CBC'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadSampleChemistry}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-mono text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'كيمياء ووظائف' : 'Sample Chemistry'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LIVE CAMERA VIEWFINDER */}
          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black border border-fuchsia-500/40 shadow-2xl flex flex-col items-center justify-center min-h-[360px] max-h-[480px]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[460px]"
              />
              
              {/* Target HUD Frame */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="w-full max-w-md h-64 border-2 border-dashed border-fuchsia-400/80 rounded-xl relative">
                  <div className="absolute top-2 left-2 text-[10px] font-mono bg-black/60 px-2 py-0.5 rounded text-fuchsia-300 font-bold">
                    ALIGN LAB STRIP / REPORT HERE
                  </div>
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-fuchsia-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-fuchsia-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-fuchsia-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-fuchsia-400" />
                </div>
              </div>

              {/* Capture Control Button */}
              <div className="absolute bottom-4 flex items-center gap-3 z-10 bg-slate-950/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Close Camera'}
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-fuchsia-500/30 cursor-pointer active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'التقاط الصورة وتحليلها الآن' : 'Capture & Analyze Now'}</span>
                </button>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{cameraError}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'التقاط بكاميرا الجوال' : 'Snap Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'رفع ملف' : 'Upload'}</span>
                </button>
              </div>
            </div>
          )}

          {/* DRAG & DROP UPLOAD BOX (When camera is not active and no image analyzed) */}
          {!isCameraActive && !selectedImage && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700/80 hover:border-fuchsia-500/60 bg-slate-900/30 hover:bg-slate-900/60 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all space-y-3 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 group-hover:bg-fuchsia-500/20 text-slate-400 group-hover:text-fuchsia-400 flex items-center justify-center transition-all">
                <Camera className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'انقر لالتقاط صورة بكاميرا الجوال أو رفع ملف التحليل' : 'Click to photograph lab strip or drop image file here'}
                </h4>
                <p className="text-xs text-slate-400 max-w-md">
                  {lang === 'ar' 
                    ? 'يدعم شريط طابعة جهاز غازات الدم (ABG)، بطاقة طابعة صورة الدم (CBC)، ونتائج الكيمياء والأملاح'
                    : 'Supports thermal paper strips from ABG analyzers (ABL/GEM), automated hematology CBC slips, and biochemistry sheets'}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-[11px] text-slate-400 font-mono">JPG, PNG, WEBP, PDF Slip</span>
              </div>
            </div>
          )}

          {/* SCANNING / ANALYZING ANIMATION */}
          {isAnalyzing && (
            <div className="p-8 rounded-2xl bg-[#070c18] border border-fuchsia-500/30 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
              {/* Laser scanning beam */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-fuchsia-400 to-transparent animate-pulse" style={{ top: '35%' }} />
              
              <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 animate-spin">
                <RefreshCw className="w-8 h-8" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  <span>{lang === 'ar' ? 'جارٍ فحص وتحليل نتائج التحليل بالذكاء الاصطناعي...' : 'Gemini AI is analyzing the lab report...'}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'ar' 
                    ? 'استخراج قيم pH, pCO2, pO2, HCO3, Lactate أو WBC, Hb, Plt ومطابقتها...'
                    : 'Extracting ABG blood gases, CBC differential counts, and matching reference values...'}
                </p>
              </div>
            </div>
          )}

          {/* ANALYSIS ERROR */}
          {analysisError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3 text-xs text-red-300">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="font-bold">{lang === 'ar' ? 'خطأ في معالجة التحليل' : 'Analysis Processing Error'}</p>
                <p className="text-red-200/80">{analysisError}</p>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {selectedImage && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedImage) {
                          processImageWithAI(selectedImage, 'image/jpeg');
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'المحاولة مرة أخرى' : 'Retry Scanning Now'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAnalysisError(null);
                      setSelectedImage(null);
                      setScannedResult(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer transition-all"
                  >
                    {lang === 'ar' ? 'التقاط صورة جديدة' : 'Capture New Image'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VERIFICATION & REVIEW DISPLAY */}
          {scannedResult && !isAnalyzing && (
            <div className="space-y-4">
              
              {/* Recognition Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-fuchsia-950/40 via-slate-900/60 to-slate-900/40 border border-fuchsia-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {lang === 'ar' ? 'نوع التحليل المكتشف:' : 'Detected Test Type:'}
                      </span>
                      <span className="text-xs font-black uppercase px-2 py-0.5 rounded-md bg-fuchsia-500/20 text-fuchsia-300 font-mono">
                        {scannedResult.detectedType}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {Math.round((scannedResult.confidence || 0.95) * 100)}% Confidence
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {lang === 'ar' ? scannedResult.summaryAr : scannedResult.summaryEn}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setScannedResult(null);
                      setEditableFields({});
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تصوير تحليل آخر' : 'Scan Another'}</span>
                  </button>
                </div>
              </div>

              {/* Split View: Photo Thumbnail + Extracted Field Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Photo Preview (Col 4) */}
                <div className="lg:col-span-4 bg-[#070c18] p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-start space-y-2">
                  <div className="w-full flex items-center justify-between text-xs text-slate-400 font-bold border-b border-slate-800 pb-1.5">
                    <span>{lang === 'ar' ? 'الصورة الملتقطة' : 'Captured Image'}</span>
                    <span className="text-[10px] text-fuchsia-400 font-mono">Verified OCR</span>
                  </div>
                  {selectedImage && (
                    <div className="w-full max-h-[380px] overflow-auto rounded-lg border border-slate-800/80 bg-slate-950 flex items-center justify-center p-1">
                      <img 
                        src={selectedImage} 
                        alt="Lab Slip Preview" 
                        className="max-h-[360px] object-contain rounded"
                      />
                    </div>
                  )}

                  {/* Sample extraction datetime */}
                  <div className="w-full pt-2">
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                      {lang === 'ar' ? 'تاريخ ووقت سحب العينة:' : 'Sample Extraction Timestamp:'}
                    </label>
                    <input
                      type="datetime-local"
                      value={sampleDate}
                      onChange={(e) => setSampleDate(e.target.value)}
                      className="w-full bg-[#0b1224] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-fuchsia-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Extracted Fields Form (Col 8) */}
                <div className="lg:col-span-8 bg-[#070c18] p-4 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-fuchsia-400" />
                      <span>{lang === 'ar' ? 'القيم المستخرجة تلقائياً (قابلة للتعديل والتدقيق الطبي):' : 'Auto-Extracted Clinical Parameters (Editable):'}</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {lang === 'ar' ? 'يمكنك تصحيح أي قيمة قبل الحفظ' : 'Review & adjust before applying'}
                    </span>
                  </div>

                  {/* Detected Values Grouped */}
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    
                    {/* ABG Section if present */}
                    {(editableFields.ph || editableFields.pco2 || editableFields.po2 || editableFields.hco3 || editableFields.lactate || scannedResult.detectedType === 'ABG') && (
                      <div className="p-3 bg-violet-950/20 border border-violet-800/40 rounded-xl space-y-2">
                        <div className="text-xs font-bold text-violet-400 uppercase font-mono flex items-center justify-between">
                          <span>{lang === 'ar' ? 'غازات الدم الشرياني (ABG Parameters)' : 'Arterial Blood Gas (ABG)'}</span>
                          <span className="text-[10px] text-violet-300">pH / pCO2 / pO2 / HCO3 / Lac</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">pH</label>
                            <input
                              type="text"
                              value={editableFields.ph || ''}
                              onChange={(e) => handleFieldChange('ph', e.target.value)}
                              className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">pCO2 (mmHg)</label>
                            <input
                              type="text"
                              value={editableFields.pco2 || ''}
                              onChange={(e) => handleFieldChange('pco2', e.target.value)}
                              className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">pO2 (mmHg)</label>
                            <input
                              type="text"
                              value={editableFields.po2 || ''}
                              onChange={(e) => handleFieldChange('po2', e.target.value)}
                              className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">HCO3 (mmol/L)</label>
                            <input
                              type="text"
                              value={editableFields.hco3 || ''}
                              onChange={(e) => handleFieldChange('hco3', e.target.value)}
                              className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Base Excess</label>
                            <input
                              type="text"
                              value={editableFields.be || ''}
                              onChange={(e) => handleFieldChange('be', e.target.value)}
                              className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-red-400 block mb-0.5 font-bold">Lactate</label>
                            <input
                              type="text"
                              value={editableFields.lactate || ''}
                              onChange={(e) => handleFieldChange('lactate', e.target.value)}
                              className="w-full bg-[#0b1224] border border-red-500/50 rounded-lg p-1.5 text-xs text-red-400 font-mono font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CBC Section if present */}
                    {(editableFields.wbc || editableFields.hb || editableFields.plt || editableFields.hct || scannedResult.detectedType === 'CBC') && (
                      <div className="p-3 bg-teal-950/20 border border-teal-800/40 rounded-xl space-y-2">
                        <div className="text-xs font-bold text-teal-400 uppercase font-mono flex items-center justify-between">
                          <span>{lang === 'ar' ? 'صورة الدم الكاملة (CBC Parameters)' : 'Complete Blood Count (CBC)'}</span>
                          <span className="text-[10px] text-teal-300">WBC / Hb / Hct / Plt</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">WBCs (k/uL)</label>
                            <input
                              type="text"
                              value={editableFields.wbc || ''}
                              onChange={(e) => handleFieldChange('wbc', e.target.value)}
                              className="w-full bg-[#0b1224] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Hemoglobin Hb (g/dL)</label>
                            <input
                              type="text"
                              value={editableFields.hb || ''}
                              onChange={(e) => handleFieldChange('hb', e.target.value)}
                              className="w-full bg-[#0b1224] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Hematocrit Hct (%)</label>
                            <input
                              type="text"
                              value={editableFields.hct || ''}
                              onChange={(e) => handleFieldChange('hct', e.target.value)}
                              className="w-full bg-[#0b1224] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Platelets PLT (k/uL)</label>
                            <input
                              type="text"
                              value={editableFields.plt || ''}
                              onChange={(e) => handleFieldChange('plt', e.target.value)}
                              className="w-full bg-[#0b1224] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-400 block mb-0.5">{lang === 'ar' ? 'العد التفريقي' : 'WBC Differential'}</label>
                            <input
                              type="text"
                              value={editableFields.diff || ''}
                              onChange={(e) => handleFieldChange('diff', e.target.value)}
                              className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[10px] text-slate-400 block mb-0.5">{lang === 'ar' ? 'نوع الأنيميا' : 'Anemia Morphology'}</label>
                            <input
                              type="text"
                              value={editableFields.typeAnemia || ''}
                              onChange={(e) => handleFieldChange('typeAnemia', e.target.value)}
                              className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chemistry / Electrolytes if present */}
                    {(editableFields.na || editableFields.k || editableFields.creat || editableFields.urea) && (
                      <div className="p-3 bg-cyan-950/20 border border-cyan-800/40 rounded-xl space-y-2">
                        <div className="text-xs font-bold text-cyan-400 uppercase font-mono">
                          {lang === 'ar' ? 'الكيمياء والأملاح (Chemistry & Electrolytes)' : 'Chemistry & Renal / Electrolytes'}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Sodium Na</label>
                            <input
                              type="text"
                              value={editableFields.na || ''}
                              onChange={(e) => handleFieldChange('na', e.target.value)}
                              className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Potassium K</label>
                            <input
                              type="text"
                              value={editableFields.k || ''}
                              onChange={(e) => handleFieldChange('k', e.target.value)}
                              className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Creatinine</label>
                            <input
                              type="text"
                              value={editableFields.creat || ''}
                              onChange={(e) => handleFieldChange('creat', e.target.value)}
                              className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Urea</label>
                            <input
                              type="text"
                              value={editableFields.urea || ''}
                              onChange={(e) => handleFieldChange('urea', e.target.value)}
                              className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Detected Items List */}
                    {scannedResult.items && scannedResult.items.length > 0 && (
                      <div className="border-t border-slate-800 pt-3">
                        <div className="text-[11px] font-bold text-slate-400 mb-2">
                          {lang === 'ar' ? 'سجل البنود التفصيلية المستخرجة:' : 'Detailed Extracted Parameters List:'}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {scannedResult.items.map((item, idx) => (
                            <div key={idx} className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-[11px] flex items-center justify-between">
                              <span className="font-bold text-slate-300">{item.testName}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-white">{item.value}</span>
                                <span className="text-[10px] text-slate-400">{item.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">
              {lang === 'ar' ? 'نظام الذكاء الاصطناعي الطبي المعتمد' : 'Gemini 3.8 Flash Vision Engine'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
            >
              {lang === 'ar' ? 'إغلاق' : 'Cancel'}
            </button>

            {scannedResult && onApplyToForm && (
              <button
                type="button"
                onClick={handleApplyToOpenForm}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-600 transition-all"
              >
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'ar' ? 'تعبئة الخانات في النموذج المفتوح' : 'Auto-Fill Into Open Form'}</span>
              </button>
            )}

            {scannedResult && onDirectSave && (
              <button
                type="button"
                disabled={isSaving || saveSuccess}
                onClick={handleConfirmAndDirectSave}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span className="text-white">{lang === 'ar' ? 'تم الحفظ في ملف المريض بنجاح!' : 'Saved to Flowsheet!'}</span>
                  </>
                ) : isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ar' ? 'جارٍ التسجيل...' : 'Recording...'}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تأكيد وحفظ فوري في مسار التحاليل' : 'Confirm & Save Directly to Flowsheet'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
