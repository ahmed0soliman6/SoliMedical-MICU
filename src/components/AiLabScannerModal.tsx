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
import { getCategoryForTest } from './LabFlowsheetSection.tsx';

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
  const [showSourceModal, setShowSourceModal] = useState<boolean>(false);

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
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(lang === 'ar' ? 'الكاميرا غير مدعومة في هذا المتصفح أو بيئة العرض.' : 'Camera not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Video play error:', e));
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        lang === 'ar'
          ? 'تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن أو استخدام خيار رفع الصورة.'
          : 'Could not access camera. Please allow permission or upload an image file.'
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      stopCamera();
      try {
        const { base64, mimeType } = await compressImageForOcr(rawDataUrl);
        setSelectedImage(base64);
        setSelectedImageMime(mimeType || 'image/jpeg');
        processImageWithAI(base64, mimeType || 'image/jpeg');
      } catch {
        setSelectedImage(rawDataUrl);
        setSelectedImageMime('image/jpeg');
        processImageWithAI(rawDataUrl, 'image/jpeg');
      }
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

      // Process and categorize all items
      const processedItems = (result.items || [])
        .filter(item => {
          const lower = (item.testName || '').toLowerCase().trim();
          return !['be', 'base excess', 'thbc', 'cthb', 'thb', 'hct (abg)'].includes(lower);
        })
        .map(item => {
          const resolved = getCategoryForTest(item.testName, [{ testName: item.testName, category: item.category } as any]);
          const categoryName = resolved === 'Chemistry' 
            ? 'Chemistry' 
            : resolved === 'CBC' 
              ? 'CBC' 
              : resolved === 'ABG' 
                ? 'ABG' 
                : resolved === 'INR' 
                  ? 'Coagulation' 
                  : (item.category || 'Other');
          return {
            ...item,
            category: categoryName,
          };
        });

      setScannedResult({
        ...result,
        statFields: rawFields,
        items: processedItems,
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

  // Change value for a detailed item
  const handleItemValueChange = (index: number, newValue: string) => {
    if (!scannedResult || !scannedResult.items) return;
    const updatedItems = [...scannedResult.items];
    const target = updatedItems[index];
    if (!target) return;
    updatedItems[index] = {
      ...target,
      value: newValue,
    };
    setScannedResult({
      ...scannedResult,
      items: updatedItems,
    });

    const key = target.testName.toLowerCase().replace(/[^a-z0-9]/g, '');
    setEditableFields(prev => ({
      ...prev,
      [key]: newValue,
    }));
  };

  // Delete a specific extracted field (IN-MEMORY ONLY, NO AUTOSAVE!)
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
  };

  // Delete an item from the detailed list (IN-MEMORY ONLY, NO AUTOSAVE!)
  const handleDeleteDetailedItem = (index: number) => {
    if (!scannedResult || !scannedResult.items) return;
    const itemToDelete = scannedResult.items[index];
    const updatedItems = scannedResult.items.filter((_, idx) => idx !== index);

    // Clean up from editableFields as well
    const updatedFields = { ...editableFields };
    if (itemToDelete) {
      const keyToDelete = itemToDelete.testName.toLowerCase().replace(/[^a-z0-9]/g, '');
      delete updatedFields[keyToDelete];
      Object.keys(updatedFields).forEach(k => {
        if (k.toLowerCase() === itemToDelete.testName.toLowerCase()) {
          delete updatedFields[k];
        }
      });
    }

    setScannedResult({
      ...scannedResult,
      items: updatedItems
    });
    setEditableFields(updatedFields);
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
        className="bg-white dark:bg-[#0b1224] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 rounded-2xl w-full max-w-5xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto relative max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3.5 sm:pb-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-indigo-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'المسح الضوئي الذكي للتحاليل (AI Lab Scanner)' : 'Intelligent AI Lab Optical Scanner'}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-900 border border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/30">
                  Gemini OCR
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {lang === 'ar' 
                  ? `السرير ${bedNumber} - ${patientName || 'المريض الحالي'}: مسح ذكي للتحاليل وتصنيف تلقائي للقيم المستخرجة`
                  : `Bed ${bedNumber} - ${patientName || 'Active Patient'}: Smart lab OCR and automatic categorization`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-all text-sm font-black cursor-pointer shadow-sm"
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs shadow-sm">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-600 dark:text-slate-400 font-bold px-1 text-xs">
                    {lang === 'ar' ? 'تصنيف التحليل:' : 'Category:'}
                  </span>
                  
                  {/* CBC Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('CBC')}
                    className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-all cursor-pointer text-xs ${
                      selectedPresetType === 'CBC'
                        ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent'
                    }`}
                  >
                    CBC
                  </button>

                  {/* ABG Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('ABG')}
                    className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-all cursor-pointer text-xs ${
                      selectedPresetType === 'ABG'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent'
                    }`}
                  >
                    ABG
                  </button>

                  {/* Chemistry Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('CHEMISTRY')}
                    className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-all cursor-pointer text-xs ${
                      selectedPresetType === 'CHEMISTRY'
                        ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent'
                    }`}
                  >
                    Chemistry
                  </button>

                  {/* INR Button */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('INR')}
                    className={`px-3 py-1.5 rounded-lg font-bold font-mono transition-all cursor-pointer text-xs ${
                      selectedPresetType === 'INR'
                        ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent'
                    }`}
                  >
                    INR
                  </button>

                  {/* ALL / Comprehensive Auto-Detect */}
                  <button
                    type="button"
                    onClick={() => setSelectedPresetType('ALL')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-xs ${
                      selectedPresetType === 'ALL'
                        ? 'bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-md'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-transparent'
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
                    className={`w-full sm:w-auto px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md text-xs ${
                      isCameraActive
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                        : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black'
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

          {/* LIVE CAMERA VIEWFINDER (Identical to Investigations & Radiology Modal) */}
          {isCameraActive && (
            <div className="space-y-3">
              {cameraError ? (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-700 aspect-video max-h-[360px] flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Camera overlay guide */}
                  <div className="absolute inset-4 border-2 border-dashed border-teal-400/40 rounded-xl pointer-events-none flex flex-col items-center justify-between p-3">
                    <span className="text-[11px] bg-black/60 px-2.5 py-1 rounded text-teal-300 font-mono">
                      {lang === 'ar' ? 'وجّه كاميرا الجوال على ورقة التحليل داخل الإطار' : 'Align lab report inside frame'}
                    </span>
                  </div>

                  <div className="absolute bottom-4 flex items-center gap-2.5 z-10">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700 backdrop-blur-sm cursor-pointer transition-all"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={isAnalyzing}
                      className="px-5 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/30 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'التقاط الصورة وتحليلها' : 'Capture & Scan'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {cameraError && !isCameraActive && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300 shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* MERGED SINGLE CAPTURE / UPLOAD BOX (Matching Investigations Box Style) */}
          {!isCameraActive && !selectedImage && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => setShowSourceModal(true)}
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

              {/* Two Direct Option Buttons */}
              <div className="flex items-center justify-center gap-2.5 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startCamera();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-500/20 cursor-pointer active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'فتح كاميرا الموبايل' : 'Open Mobile Camera'}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs border border-slate-700 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <Upload className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'اختيار صورة' : 'Choose Photo'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Selection Modal when clicking on the capture / upload box */}
          {showSourceModal && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
              onClick={() => setShowSourceModal(false)}
            >
              <div 
                className="w-full max-w-sm bg-white dark:bg-[#0c1324] border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Camera className="w-4 h-4 text-teal-500" />
                    <span>{lang === 'ar' ? 'إدخال صورة التحليل' : 'Add Lab Image'}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowSourceModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSourceModal(false);
                      startCamera();
                    }}
                    className="w-full p-3.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/40 text-teal-700 dark:text-teal-300 flex items-center gap-3 transition-all cursor-pointer text-start active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center shrink-0">
                      <Camera className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {lang === 'ar' ? 'فتح كاميرا الموبايل' : 'Open Mobile Camera'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {lang === 'ar' ? 'تشغيل الكاميرا والتقاط صورة مباشرة للتحليل' : 'Take a live photo of lab report'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSourceModal(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full p-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-3 transition-all cursor-pointer text-start active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                      <Upload className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {lang === 'ar' ? 'اختيار صورة' : 'Choose Photo'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {lang === 'ar' ? 'رفع صورة من الاستوديو أو ملفات الجهاز' : 'Upload photo from device gallery / files'}
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSourceModal(false)}
                  className="w-full py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-center"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
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
              
              {/* Recognition Banner: Fixed for Day Mode & Mobile Responsiveness */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-teal-50 dark:bg-slate-900/90 border border-teal-200 dark:border-teal-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-teal-600 text-white dark:bg-teal-500/20 dark:text-teal-300 flex items-center justify-center font-bold shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5 text-white dark:text-teal-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {lang === 'ar' ? 'نوع التحليل المكتشف:' : 'Detected Test Type:'}
                      </span>
                      <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-teal-600 text-white dark:bg-teal-500/20 dark:text-teal-300 font-mono shadow-sm">
                        {scannedResult.detectedType === 'CHEMISTRY_ELECTROLYTES' || scannedResult.detectedType === 'CHEMISTRY' || (scannedResult.detectedType as any) === 'CARDIAC'
                          ? (lang === 'ar' ? 'كيمياء ووظائف كبد وكلى وقلب وأملاح' : 'Chemistry, Renal, Liver, Cardiac & Electrolytes')
                          : scannedResult.detectedType === 'COAGULATION' || (scannedResult.detectedType as any) === 'INR'
                            ? (lang === 'ar' ? 'تخثر وسيولة (INR & Coagulation)' : 'INR & Coagulation')
                            : scannedResult.detectedType}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {Math.round((scannedResult.confidence || 0.95) * 100)}% Confidence
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                      {lang === 'ar' ? scannedResult.summaryAr : scannedResult.summaryEn}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setScannedResult(null);
                      setEditableFields({});
                    }}
                    className="w-full sm:w-auto justify-center px-3 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>{lang === 'ar' ? 'تصوير تحليل آخر' : 'Scan Another'}</span>
                  </button>
                </div>
              </div>

              {/* Split View: Photo Thumbnail + Extracted Field Matrix with 4 Collapsible Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Photo Preview (Col 4) */}
                <div className="lg:col-span-4 bg-slate-50 dark:bg-[#070c18] p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-start space-y-2.5 shadow-sm">
                  <div className="w-full flex items-center justify-between text-xs text-slate-700 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span>{lang === 'ar' ? 'الصورة الملتقطة' : 'Captured Image'}</span>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono font-bold bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">Verified OCR</span>
                  </div>
                  {selectedImage && (
                    <div className="w-full max-h-[360px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 flex items-center justify-center p-1.5 shadow-inner">
                      <img 
                        src={selectedImage} 
                        alt="Lab Slip Preview" 
                        className="max-h-[340px] object-contain rounded"
                      />
                    </div>
                  )}

                  {/* Sample extraction datetime */}
                  <div className="w-full pt-1.5">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-400 block mb-1">
                      {lang === 'ar' ? 'تاريخ ووقت سحب العينة:' : 'Sample Extraction Timestamp:'}
                    </label>
                    <input
                      type="datetime-local"
                      value={sampleDate}
                      onChange={(e) => setSampleDate(e.target.value)}
                      required
                      className="w-full bg-white dark:bg-[#0b1224] border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none shadow-sm"
                    />
                  </div>
                </div>

                {/* Extracted Parameters Review Panel (Col 8) */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-[#070c18] space-y-3.5 shadow-sm">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            {lang === "ar" ? "التحاليل والنتائج المستخرجة" : "Extracted Lab Parameters"}
                          </h4>
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-transparent font-mono font-bold">
                            {(scannedResult.items || []).length} {lang === "ar" ? "تحليل" : "tests"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {lang === "ar" 
                            ? "راجع النتائج أو احذف ما لا تريده بالضغط على أيقونة السلة 🗑️. لن يتم حفظ أي قيمة إلا بعد النقر على زر تأكيد وحفظ فوري بالأسفل." 
                            : "Review values or remove unwanted parameters with 🗑️. Nothing will be saved until you click Confirm & Save Directly below."}
                        </p>
                      </div>
                    </div>

                    {/* Parameters Grid or Empty message */}
                    {(!scannedResult.items || scannedResult.items.length === 0) ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800/80 rounded-xl bg-slate-50 dark:bg-slate-900/30">
                        {lang === "ar" ? "تم حذف كافة البنود أو لم يتم استخراج أي قيم صالحة." : "All items have been removed or no valid values extracted."}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                        {scannedResult.items.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-2 shadow-sm group"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs text-slate-900 dark:text-white truncate max-w-[130px] font-mono">
                                  {item.testName}
                                </span>
                                {item.unit && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                    ({item.unit})
                                  </span>
                                )}
                              </div>
                              {item.category && item.category !== "Other" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-teal-400/80 font-mono mt-0.5 inline-block">
                                  {item.category}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="text"
                                value={item.value}
                                onChange={(e) => handleItemValueChange(idx, e.target.value)}
                                required
                                className="w-20 bg-white dark:bg-[#0b1224] border border-teal-400 dark:border-teal-500/40 rounded-lg px-2 py-1 text-xs text-teal-800 dark:text-teal-300 font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-sm"
                                placeholder="0.0"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteDetailedItem(idx)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title={lang === "ar" ? "حذف هذا التحليل من المسودة" : "Remove parameter from scan draft"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER ACTIONS */}
        <div className="border-t border-slate-200 dark:border-slate-800/80 pt-3.5 sm:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {lang === 'ar' ? 'نظام الذكاء الاصطناعي الطبي المعتمد' : 'Gemini Vision OCR'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer shadow-sm text-center"
            >
              {lang === 'ar' ? 'إغلاق' : 'Cancel'}
            </button>

            {scannedResult && onApplyToForm && (
              <button
                type="button"
                onClick={handleApplyToOpenForm}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-300 dark:border-slate-600 transition-all cursor-pointer shadow-sm"
              >
                <Sliders className="w-4 h-4 text-teal-600 dark:text-cyan-400" />
                <span>{lang === 'ar' ? 'تعبئة الخانات في النموذج المفتوح' : 'Auto-Fill Into Open Form'}</span>
              </button>
            )}

            {scannedResult && onDirectSave && (
              <button
                type="button"
                disabled={isSaving || saveSuccess}
                onClick={handleConfirmAndDirectSave}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 cursor-pointer"
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
