import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Sliders,
  ChevronDown,
  ChevronUp,
  Trash2,
  Activity,
  Droplet
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { compressImageForOcr } from '../services/imageCompression.ts';
import { 
  scanLabImage, 
  ScannedLabResponse
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

  // Selected Preset: CBC, ABG, Chemistry, INR, or ALL
  const [selectedPresetType, setSelectedPresetType] = useState<'ABG' | 'CBC' | 'CHEMISTRY' | 'INR' | 'ALL'>(
    (targetPreset as any) || 'ALL'
  );

  useEffect(() => {
    setSelectedPresetType((targetPreset as any) || 'ALL');
  }, [targetPreset]);
  
  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Image & Analysis state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/jpeg');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedLabResponse | null>(null);
  const [editableFields, setEditableFields] = useState<Record<string, string>>({});
  const [sampleDate, setSampleDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 4 Collapsible Cards State - Default collapsed (مطوية افتراضياً)
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({
    ABG: true,
    CBC: true,
    Chemistry: true,
    INR: true,
  });

  const toggleCard = (cardKey: string) => {
    setCollapsedCards(prev => ({
      ...prev,
      [cardKey]: !prev[cardKey]
    }));
  };

  // File input ref for unified capture / upload box
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setSelectedImageMime('image/jpeg');
    setIsAnalyzing(false);
    setAnalysisError(null);
    setScannedResult(null);
    setEditableFields({});
    setSaveSuccess(false);
    setCollapsedCards({
      ABG: true,
      CBC: true,
      Chemistry: true,
      INR: true,
    });
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          lang === 'ar'
            ? 'واجهة الكاميرا غير مدعومة في هذا المتصفح. يمكنك استخدام صندوق النقر لرفع الصورة أو التقاطها.'
            : 'Live camera is not supported in this browser. Please use the upload/capture box.'
        );
        return;
      }

      let stream: MediaStream | null = null;
      try {
        // Attempt 1: Rear environment camera with mobile-friendly portrait/adaptive aspect
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
      }
    } catch (err: any) {
      console.warn('Could not start camera:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const isNotFound = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';

      let errorMsg =
        lang === 'ar'
          ? 'تعذر الوصول إلى الكاميرا. يرجى التأكد من السماح بصلاحية الكاميرا أو النقر على الصندوق لرفع صورة.'
          : 'Could not access camera. Please allow camera permissions or upload an image file.';

      if (isDenied) {
        errorMsg =
          lang === 'ar'
            ? 'تم رفض إذن الكاميرا من المتصفح. يرجى منح إذن الكاميرا من إعدادات المتصفح.'
            : 'Camera permission was denied. Please allow camera access in browser settings.';
      } else if (isNotFound) {
        errorMsg =
          lang === 'ar'
            ? 'لم يتم العثور على كاميرا متصلة. يمكنك رفع صورة التحليل من جهازك.'
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
      setSelectedImageMime('image/jpeg');
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
      setSelectedImageMime(mimeType);
      processImageWithAI(base64, mimeType);
    } catch (err) {
      console.warn('Image compression fallback:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const resolvedMime = file.type || 'image/jpeg';
        setSelectedImage(base64);
        setSelectedImageMime(resolvedMime);
        processImageWithAI(base64, resolvedMime);
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
      setSelectedImageMime(mimeType);
      processImageWithAI(base64, mimeType);
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const resolvedMime = file.type || 'image/jpeg';
        setSelectedImage(base64);
        setSelectedImageMime(resolvedMime);
        processImageWithAI(base64, resolvedMime);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImageWithAI = async (base64Data: string, mimeType: string, overridePreset?: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setScannedResult(null);
    setSelectedImageMime(mimeType);

    try {
      const presetToUse = overridePreset || selectedPresetType || 'ALL';
      const result = await scanLabImage(base64Data, mimeType, presetToUse);

      // Clean up unwanted parameters from raw result (Hct, Thbc, Be for ABG)
      const rawFields = { ...(result.statFields || {}) };
      delete rawFields.be;
      delete rawFields.thbc;
      delete rawFields.tHb;
      delete rawFields.ctHb;
      // Note: If user wants Hct removed from ABG, we keep Hct for CBC card only
      if (result.detectedType === 'ABG') {
        delete rawFields.hct;
      }

      setScannedResult({
        ...result,
        statFields: rawFields,
        items: (result.items || []).filter(item => {
          const lower = (item.testName || '').toLowerCase().trim();
          return !['be', 'base excess', 'thbc', 'cthb', 'thb', 'hct (abg)'].includes(lower);
        })
      });

      setEditableFields(rawFields);

      if (result.sampleDate) {
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
      
      if (errStr.includes('404')) {
        userErrorMsg = lang === 'ar'
          ? 'تعذر الوصول إلى نقطة المعالجة (404: Endpoint Not Found). يرجى التأكد من رفع ونشر مجلد /api.'
          : 'API Endpoint not found (404). Please ensure /api is deployed.';
      } else if (errStr.includes('GEMINI_API_KEY')) {
        userErrorMsg = lang === 'ar'
          ? 'مفتاح GEMINI_API_KEY غير موجود في إعدادات البيئة. يرجى إضافته في إعدادات التطبيق.'
          : 'GEMINI_API_KEY is missing from environment variables.';
      } else if (errStr.includes('405') || errStr.includes('Failed to fetch') || errStr.includes('NetworkError')) {
        userErrorMsg = lang === 'ar'
          ? 'تعذر الاتصال بخدمة التحليل الذكي. يرجى النقر على "المحاولة مرة أخرى".'
          : 'Could not reach the AI scanning service. Please click "Retry Scanning Now".';
      } else if (isOverload) {
        userErrorMsg = lang === 'ar' 
          ? 'خوادم الذكاء الاصطناعي تواجه ضغطاً مؤقتاً (503). يرجى النقر على زر "المحاولة مرة أخرى".' 
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

  // Helper to trigger direct saving automatically
  const triggerAutoSave = async (updatedFields: Record<string, string>, updatedItems: Array<any>) => {
    if (!onDirectSave) return;
    try {
      await onDirectSave({
        fields: updatedFields,
        items: updatedItems,
        timestamp: sampleDate,
        summaryEn: scannedResult?.summaryEn || '',
        summaryAr: scannedResult?.summaryAr || '',
      });
    } catch (err) {
      console.warn('Auto-save after parameter deletion failed:', err);
    }
  };

  // Delete a specific extracted field and auto-save the remaining values
  const handleDeleteField = (key: string) => {
    const updated = { ...editableFields };
    delete updated[key];
    setEditableFields(updated);

    // Also remove from detailed items list if matching
    const updatedItems = (scannedResult?.items || []).filter(item => {
      const lower = (item.testName || '').toLowerCase().trim();
      return lower !== key.toLowerCase() && !lower.startsWith(key.toLowerCase() + ' ');
    });

    if (scannedResult) {
      setScannedResult({
        ...scannedResult,
        items: updatedItems
      });
    }

    // Auto-save the remaining parameters
    triggerAutoSave(updated, updatedItems);
  };

  // Delete an item from the detailed list and auto-save
  const handleDeleteDetailedItem = (index: number) => {
    if (!scannedResult || !scannedResult.items) return;
    const updatedItems = scannedResult.items.filter((_, idx) => idx !== index);
    setScannedResult({
      ...scannedResult,
      items: updatedItems
    });
    triggerAutoSave(editableFields, updatedItems);
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
                  {lang === 'ar' ? 'المسح الضوئي الذكي للتحاليل المخبرية (AI Lab Scanner)' : 'Intelligent AI Lab Optical Scanner'}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                  Gemini Vision OCR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? `السرير ${bedNumber} - ${patientName || 'المريض الحالي'}: مسح ذكي للتحاليل وتصنيف تلقائي للقيم المستخرجة`
                  : `Bed ${bedNumber} - ${patientName || 'Active Patient'}: Smart lab OCR and automatic categorization`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all text-sm font-black cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden Canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          
          {/* Top Bar: Lab Type Medical Abbreviations Selector & Camera Launcher */}
          {!scannedResult && !isAnalyzing && (
            <div className="space-y-3">
              {/* Category boxes named strictly with medical abbreviations: CBC, ABG, Chemistry, INR */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 font-bold px-2">
                    {lang === 'ar' ? 'تصنيف التحليل:' : 'Category:'}
                  </span>
                  
                  {/* CBC Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('CBC')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold font-mono transition-all cursor-pointer ${
                      selectedPresetType === 'CBC'
                        ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    CBC
                  </button>

                  {/* ABG Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('ABG')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold font-mono transition-all cursor-pointer ${
                      selectedPresetType === 'ABG'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    ABG
                  </button>

                  {/* Chemistry Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('CHEMISTRY')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold font-mono transition-all cursor-pointer ${
                      selectedPresetType === 'CHEMISTRY'
                        ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Chemistry
                  </button>

                  {/* INR Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('INR')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold font-mono transition-all cursor-pointer ${
                      selectedPresetType === 'INR'
                        ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    INR
                  </button>

                  {/* ALL / Comprehensive Auto-Detect */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('ALL')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      selectedPresetType === 'ALL'
                        ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {lang === 'ar' ? 'كشف شامل (ALL)' : 'ALL'}
                  </button>
                </div>

                {/* Only button retained: "تشغيل الكاميرا للتصوير" */}
                <div>
                  <button
                    type="button"
                    onClick={isCameraActive ? stopCamera : startCamera}
                    className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                      isCameraActive
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>
                      {isCameraActive 
                        ? (lang === 'ar' ? 'إغلاق الكاميرا' : 'Close Camera') 
                        : (lang === 'ar' ? 'تشغيل الكاميرا للتصوير' : 'Start Camera')}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MOBILE-COMPATIBLE LIVE CAMERA VIEWFINDER BOX */}
          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-teal-500/50 shadow-2xl flex flex-col items-center justify-center min-h-[340px] max-h-[500px] w-full max-w-lg mx-auto">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[460px] aspect-[3/4] sm:aspect-[4/3]"
              />
              
              {/* Mobile Target HUD Frame */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="w-full h-full max-w-sm max-h-[320px] border-2 border-dashed border-teal-400/90 rounded-2xl relative flex flex-col justify-between p-3">
                  <div className="text-[10px] font-mono bg-black/70 px-2.5 py-1 rounded-md text-teal-300 font-bold self-center shadow">
                    {lang === 'ar' ? 'وجّه كاميرا الجوال على ورقة التحليل' : 'ALIGN LAB STRIP INSIDE FRAME'}
                  </div>
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-teal-300" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-teal-300" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-teal-300" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-teal-300" />
                </div>
              </div>

              {/* Capture Controls */}
              <div className="absolute bottom-4 flex items-center gap-3 z-10 bg-slate-950/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700/80">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-500/30 cursor-pointer active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'التقاط الصورة وتحليلها' : 'Capture & Analyze'}</span>
                </button>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* MERGED SINGLE CAPTURE / UPLOAD BOX (Matching Investigations Box Style) */}
          {!isCameraActive && !selectedImage && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="p-8 sm:p-12 text-center rounded-2xl border-2 border-dashed border-slate-700 hover:border-teal-500 bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'انقر لالتقاط صورة أو رفع صورة التحليل' : 'Click to capture photo or upload lab image here'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'ar' ? 'يدعم صور PNG, JPG, JPEG أو تصوير الكاميرا' : 'Supports PNG, JPG, JPEG or camera captures'}
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                {lang === 'ar' ? 'تصفح جهازك / الكاميرا' : 'Browse Files / Camera'}
              </button>
            </div>
          )}

          {/* SCANNING / ANALYZING ANIMATION */}
          {isAnalyzing && (
            <div className="p-8 rounded-2xl bg-[#070c18] border border-teal-500/30 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" style={{ top: '35%' }} />
              
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 animate-spin">
                <RefreshCw className="w-8 h-8" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                  <span>{lang === 'ar' ? 'جارٍ فحص وتحليل نتائج التحليل بالذكاء الاصطناعي...' : 'Gemini AI is analyzing the lab report...'}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {lang === 'ar' 
                    ? 'التعرف على التحاليل وتصنيفها في بطاقات ABG, CBC, Chemistry, INR تلقائياً...'
                    : 'Extracting and categorizing into ABG, CBC, Chemistry, and INR cards...'}
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
                          processImageWithAI(selectedImage, selectedImageMime || 'image/jpeg');
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
                    onClick={resetState}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer transition-all"
                  >
                    {lang === 'ar' ? 'التقاط صورة جديدة' : 'Capture New Image'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VERIFICATION & REVIEW DISPLAY: 4 COLLAPSIBLE CARDS */}
          {scannedResult && !isAnalyzing && (
            <div className="space-y-4">
              
              {/* Recognition Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-950/40 via-slate-900/60 to-slate-900/40 border border-teal-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {lang === 'ar' ? 'نوع التحليل المكتشف:' : 'Detected Test Type:'}
                      </span>
                      <span className="text-xs font-black uppercase px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 font-mono">
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
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تصوير تحليل آخر' : 'Scan Another'}</span>
                  </button>
                </div>
              </div>

              {/* Split View: Photo Thumbnail + Extracted Field Matrix with 4 Collapsible Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Photo Preview (Col 4) */}
                <div className="lg:col-span-4 bg-[#070c18] p-3 rounded-xl border border-slate-800 flex flex-col items-center justify-start space-y-2">
                  <div className="w-full flex items-center justify-between text-xs text-slate-400 font-bold border-b border-slate-800 pb-1.5">
                    <span>{lang === 'ar' ? 'الصورة الملتقطة' : 'Captured Image'}</span>
                    <span className="text-[10px] text-teal-400 font-mono">Verified OCR</span>
                  </div>
                  {selectedImage && (
                    <div className="w-full max-h-[360px] overflow-auto rounded-lg border border-slate-800/80 bg-slate-950 flex items-center justify-center p-1">
                      <img 
                        src={selectedImage} 
                        alt="Lab Slip Preview" 
                        className="max-h-[340px] object-contain rounded"
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
                      className="w-full bg-[#0b1224] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4 Collapsible Cards (Col 8) */}
                <div className="lg:col-span-8 space-y-3">
                  
                  {/* CARD 1: ABG Card (Collapsible, default collapsed) */}
                  <div className="rounded-xl border border-violet-800/50 bg-[#070c18] overflow-hidden transition-all shadow-md">
                    <div 
                      onClick={() => toggleCard('ABG')}
                      className="p-3 bg-violet-950/30 hover:bg-violet-950/50 flex items-center justify-between cursor-pointer border-b border-violet-800/30 select-none transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-violet-400" />
                        <h4 className="text-xs font-bold text-violet-300 font-mono">
                          ABG {lang === 'ar' ? '(غازات الدم الشرياني)' : '(Arterial Blood Gas)'}
                        </h4>
                        <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-mono">
                          pH, pCO2, pO2, HCO3, Lac, P/F
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-violet-400 text-xs">
                        <span className="text-[11px]">{collapsedCards.ABG ? (lang === 'ar' ? 'فتح' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}</span>
                        {collapsedCards.ABG ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </div>
                    </div>

                    {!collapsedCards.ABG && (
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                          {/* pH */}
                          {'ph' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">pH</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('ph')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.ph || ''}
                                onChange={(e) => handleFieldChange('ph', e.target.value)}
                                className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* pCO2 */}
                          {'pco2' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">pCO2 (mmHg)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('pco2')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.pco2 || ''}
                                onChange={(e) => handleFieldChange('pco2', e.target.value)}
                                className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* pO2 */}
                          {'po2' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">pO2 (mmHg)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('po2')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.po2 || ''}
                                onChange={(e) => handleFieldChange('po2', e.target.value)}
                                className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* HCO3 */}
                          {'hco3' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">HCO3 (mmol/L)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('hco3')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.hco3 || ''}
                                onChange={(e) => handleFieldChange('hco3', e.target.value)}
                                className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Lactate */}
                          {'lactate' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-red-400 font-bold">Lactate</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('lactate')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.lactate || ''}
                                onChange={(e) => handleFieldChange('lactate', e.target.value)}
                                className="w-full bg-[#0b1224] border border-red-500/50 rounded-lg p-1.5 text-xs text-red-400 font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* P/F Ratio */}
                          {'pf' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">P/F Ratio</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('pf')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.pf || ''}
                                onChange={(e) => handleFieldChange('pf', e.target.value)}
                                className="w-full bg-[#0b1224] border border-violet-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CARD 2: CBC Card (Collapsible, default collapsed) */}
                  <div className="rounded-xl border border-teal-800/50 bg-[#070c18] overflow-hidden transition-all shadow-md">
                    <div 
                      onClick={() => toggleCard('CBC')}
                      className="p-3 bg-teal-950/30 hover:bg-teal-950/50 flex items-center justify-between cursor-pointer border-b border-teal-800/30 select-none transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Droplet className="w-4 h-4 text-teal-400" />
                        <h4 className="text-xs font-bold text-teal-300 font-mono">
                          CBC {lang === 'ar' ? '(صورة الدم الكاملة)' : '(Complete Blood Count)'}
                        </h4>
                        <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full font-mono">
                          WBC, Hb, Hct, PLT
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-teal-400 text-xs">
                        <span className="text-[11px]">{collapsedCards.CBC ? (lang === 'ar' ? 'فتح' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}</span>
                        {collapsedCards.CBC ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </div>
                    </div>

                    {!collapsedCards.CBC && (
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          {/* WBC */}
                          {'wbc' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">WBCs (k/uL)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('wbc')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.wbc || ''}
                                onChange={(e) => handleFieldChange('wbc', e.target.value)}
                                className="w-full bg-[#0b1224] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Hb */}
                          {'hb' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Hb (g/dL)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('hb')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.hb || ''}
                                onChange={(e) => handleFieldChange('hb', e.target.value)}
                                className="w-full bg-[#0b1224] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Hct */}
                          {'hct' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Hematocrit Hct (%)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('hct')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.hct || ''}
                                onChange={(e) => handleFieldChange('hct', e.target.value)}
                                className="w-full bg-[#0b1224] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Platelets */}
                          {'plt' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Platelets PLT (k/uL)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('plt')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.plt || ''}
                                onChange={(e) => handleFieldChange('plt', e.target.value)}
                                className="w-full bg-[#0b1224] border border-teal-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Differential */}
                          {'diff' in editableFields && (
                            <div className="col-span-2 bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">{lang === 'ar' ? 'العد التفريقي' : 'WBC Differential'}</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('diff')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.diff || ''}
                                onChange={(e) => handleFieldChange('diff', e.target.value)}
                                className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono"
                              />
                            </div>
                          )}

                          {/* Anemia Type */}
                          {'typeAnemia' in editableFields && (
                            <div className="col-span-2 bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">{lang === 'ar' ? 'نوع الأنيميا' : 'Anemia Morphology'}</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('typeAnemia')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.typeAnemia || ''}
                                onChange={(e) => handleFieldChange('typeAnemia', e.target.value)}
                                className="w-full bg-[#0b1224] border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CARD 3: Chemistry Card (Collapsible, default collapsed) */}
                  <div className="rounded-xl border border-cyan-800/50 bg-[#070c18] overflow-hidden transition-all shadow-md">
                    <div 
                      onClick={() => toggleCard('Chemistry')}
                      className="p-3 bg-cyan-950/30 hover:bg-cyan-950/50 flex items-center justify-between cursor-pointer border-b border-cyan-800/30 select-none transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-bold text-cyan-300 font-mono">
                          Chemistry {lang === 'ar' ? '(الكيمياء الحيوية والأملاح ووظائف الأعضاء)' : '(Biochemistry & Electrolytes)'}
                        </h4>
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono">
                          Na, K, Creat, Urea, Liver, Ions
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-cyan-400 text-xs">
                        <span className="text-[11px]">{collapsedCards.Chemistry ? (lang === 'ar' ? 'فتح' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}</span>
                        {collapsedCards.Chemistry ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </div>
                    </div>

                    {!collapsedCards.Chemistry && (
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                          {/* Sodium Na */}
                          {'na' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Sodium Na</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('na')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.na || ''}
                                onChange={(e) => handleFieldChange('na', e.target.value)}
                                className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Potassium K */}
                          {'k' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Potassium K</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('k')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.k || ''}
                                onChange={(e) => handleFieldChange('k', e.target.value)}
                                className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Creatinine */}
                          {'creat' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Creatinine</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('creat')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.creat || ''}
                                onChange={(e) => handleFieldChange('creat', e.target.value)}
                                className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Urea */}
                          {'urea' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Urea</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('urea')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.urea || ''}
                                onChange={(e) => handleFieldChange('urea', e.target.value)}
                                className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Calcium Ca */}
                          {'ca' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Calcium (Ca)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('ca')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.ca || ''}
                                onChange={(e) => handleFieldChange('ca', e.target.value)}
                                className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Magnesium Mg */}
                          {'mg' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Magnesium (Mg)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('mg')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.mg || ''}
                                onChange={(e) => handleFieldChange('mg', e.target.value)}
                                className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Total Bilirubin */}
                          {'totalBili' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Total Bilirubin</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('totalBili')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.totalBili || ''}
                                onChange={(e) => handleFieldChange('totalBili', e.target.value)}
                                className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* Albumin */}
                          {'alb' in editableFields && (
                            <div className="bg-slate-900/70 p-2 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold">Albumin</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('alb')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.alb || ''}
                                onChange={(e) => handleFieldChange('alb', e.target.value)}
                                className="w-full bg-[#0b1224] border border-cyan-500/40 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CARD 4: INR Card (Collapsible, default collapsed, contains only INR values) */}
                  <div className="rounded-xl border border-rose-800/50 bg-[#070c18] overflow-hidden transition-all shadow-md">
                    <div 
                      onClick={() => toggleCard('INR')}
                      className="p-3 bg-rose-950/30 hover:bg-rose-950/50 flex items-center justify-between cursor-pointer border-b border-rose-800/30 select-none transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-rose-400" />
                        <h4 className="text-xs font-bold text-rose-300 font-mono">
                          INR {lang === 'ar' ? '(سيولة الدم وتخثر الدم)' : '(Coagulation Profile / INR)'}
                        </h4>
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full font-mono">
                          INR, PT, PTT
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-rose-400 text-xs">
                        <span className="text-[11px]">{collapsedCards.INR ? (lang === 'ar' ? 'فتح' : 'Expand') : (lang === 'ar' ? 'طي' : 'Collapse')}</span>
                        {collapsedCards.INR ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </div>
                    </div>

                    {!collapsedCards.INR && (
                      <div className="p-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          {/* INR Field */}
                          {'inr' in editableFields && (
                            <div className="bg-slate-900/70 p-2.5 rounded-lg border border-rose-800/40 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-rose-400 font-bold font-mono">INR (Ratio)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('inr')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.inr || ''}
                                onChange={(e) => handleFieldChange('inr', e.target.value)}
                                className="w-full bg-[#0b1224] border border-rose-500/40 rounded-lg p-2 text-sm text-white font-mono font-black text-center"
                              />
                            </div>
                          )}

                          {/* PT Seconds */}
                          {'pt' in editableFields && (
                            <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold font-mono">PT (sec)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('pt')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.pt || ''}
                                onChange={(e) => handleFieldChange('pt', e.target.value)}
                                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}

                          {/* PTT Seconds */}
                          {'ptt' in editableFields && (
                            <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800 relative group">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400 font-bold font-mono">PTT / aPTT (sec)</label>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteField('ptt')}
                                  className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                                  title={lang === 'ar' ? 'حذف هذه القيمة وحفظ الباقي تلقائياً' : 'Delete parameter & auto-save'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={editableFields.ptt || ''}
                                onChange={(e) => handleFieldChange('ptt', e.target.value)}
                                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg p-1.5 text-xs text-white font-mono font-bold text-center"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detailed Extracted Parameters with Delete Buttons */}
                  {scannedResult.items && scannedResult.items.length > 0 && (
                    <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                      <div className="text-[11px] font-bold text-slate-400 mb-2 flex items-center justify-between">
                        <span>{lang === 'ar' ? 'سجل البنود المقروءة تفصيلياً (مع زر الحذف السريع):' : 'All Extracted Line Items (with Quick Delete):'}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {scannedResult.items.length} {lang === 'ar' ? 'بند' : 'parameters'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {scannedResult.items.map((item, idx) => (
                          <div key={idx} className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-[11px] flex items-center justify-between group hover:border-slate-700 transition-colors">
                            <span className="font-bold text-slate-300 truncate max-w-[120px]">{item.testName}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono font-bold text-teal-300">{item.value}</span>
                              <span className="text-[10px] text-slate-400">{item.unit}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteDetailedItem(idx)}
                                className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/40 transition-colors cursor-pointer ml-1"
                                title={lang === 'ar' ? 'حذف البند وحفظ الباقي تلقائياً' : 'Delete item & auto-save remaining'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              {lang === 'ar' ? 'إغلاق' : 'Cancel'}
            </button>

            {scannedResult && onApplyToForm && (
              <button
                type="button"
                onClick={handleApplyToOpenForm}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-600 transition-all cursor-pointer"
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
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span className="text-white">{lang === 'ar' ? 'تم الحفظ في مسار التحاليل بنجاح!' : 'Saved to Flowsheet!'}</span>
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
