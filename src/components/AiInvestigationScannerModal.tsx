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
  Activity,
  Layers,
  Eye,
  Scan,
  ShieldAlert,
  Clock,
  User,
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { compressImageForOcr } from '../services/imageCompression.ts';
import { 
  scanInvestigationImage, 
  ScannedInvestigationResponse,
  generateSampleCxrReport,
  generateSampleCtBrainReport,
  generateSampleEcgReport,
  generateSampleEchoReport
} from '../services/aiInvestigationService.ts';
import { InvestigationItem } from '../types/schema.ts';

interface AiInvestigationScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName?: string;
  bedNumber: string;
  onApplyToForm?: (data: {
    modality: string;
    testName: string;
    status: 'ORDERED' | 'RESULTED' | 'REPORTED';
    timestamp: string;
    resultReport: string;
    notes?: string;
  }) => void;
  onDirectSave?: (item: Omit<InvestigationItem, 'id'>) => Promise<void>;
  onInvestigationAdded?: () => void;
}

export const AiInvestigationScannerModal: React.FC<AiInvestigationScannerModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  bedNumber,
  onApplyToForm,
  onDirectSave,
  onInvestigationAdded,
}) => {
  const { lang, isRTL } = useTranslation();

  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'camera'>('upload');
  const [expectedModality, setExpectedModality] = useState<string>('ANY');

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
  const [scannedResult, setScannedResult] = useState<ScannedInvestigationResponse | null>(null);

  // Editable fields after scan
  const [editModality, setEditModality] = useState<string>('Chest X-Ray');
  const [editTestName, setEditTestName] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'ORDERED' | 'RESULTED' | 'REPORTED'>('REPORTED');
  const [editTimestamp, setEditTimestamp] = useState<string>('');
  const [editReport, setEditReport] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize camera when camera mode active
  useEffect(() => {
    if (isOpen && activeInputMode === 'camera' && !cameraStream) {
      startCamera();
    } else if (activeInputMode !== 'camera' && cameraStream) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeInputMode]);

  // Clean state when closed
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setSelectedImage(null);
      setScannedResult(null);
      setAnalysisError(null);
      setIsAnalyzing(false);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('الكاميرا غير مدعومة في هذا المتصفح أو بيئة العرض.');
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
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
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
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setAnalysisError(null);
    try {
      const mime = file.type || 'image/jpeg';
      setSelectedImageMime(mime);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawBase64 = e.target?.result as string;
        if (!rawBase64) return;

        let finalImage = rawBase64;
        let finalMime = mime;
        if (!mime.includes('svg')) {
          try {
            const compressed = await compressImageForOcr(rawBase64);
            finalImage = compressed.base64;
            finalMime = compressed.mimeType;
          } catch {
            finalImage = rawBase64;
          }
        }
        setSelectedImage(finalImage);
        setSelectedImageMime(finalMime);
        processImageWithAI(finalImage, finalMime);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setAnalysisError(err.message || 'فشل تحميل الملف');
    }
  };

  const loadSample = (type: 'CXR' | 'CT' | 'ECG' | 'ECHO') => {
    let sampleDataUrl = '';
    let modalityHint = 'Chest X-Ray';
    if (type === 'CXR') {
      sampleDataUrl = generateSampleCxrReport();
      modalityHint = 'Chest X-Ray';
    } else if (type === 'CT') {
      sampleDataUrl = generateSampleCtBrainReport();
      modalityHint = 'CT';
    } else if (type === 'ECG') {
      sampleDataUrl = generateSampleEcgReport();
      modalityHint = 'ECG';
    } else if (type === 'ECHO') {
      sampleDataUrl = generateSampleEchoReport();
      modalityHint = 'Echo';
    }
    setExpectedModality(modalityHint);
    setSelectedImage(sampleDataUrl);
    setSelectedImageMime('image/svg+xml');
    processImageWithAI(sampleDataUrl, 'image/svg+xml', modalityHint);
  };

  const processImageWithAI = async (
    image: string,
    mimeType: string,
    modalityHint: string = expectedModality
  ) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setScannedResult(null);
    setSaveSuccess(false);

    try {
      const result = await scanInvestigationImage(image, mimeType, modalityHint);
      setScannedResult(result);

      // Populate edit states
      setEditModality(result.modality || 'Chest X-Ray');
      setEditTestName(result.testName || 'Diagnostic Report');
      setEditStatus(result.status || 'REPORTED');
      
      // Timestamp
      let localDatetime = new Date().toISOString().slice(0, 16);
      if (result.timestamp) {
        const parsed = new Date(result.timestamp);
        if (!isNaN(parsed.getTime())) {
          localDatetime = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        }
      }
      setEditTimestamp(localDatetime);
      setEditReport(result.resultReport || '');
      setEditNotes(result.notes || '');
    } catch (err: any) {
      console.error('[AI Investigation Scanner Error]:', err);
      setAnalysisError(
        err.message ||
          (lang === 'ar'
            ? 'فشل تحليل الصورة بالذكاء الاصطناعي. يرجى التأكد من وضوح التقرير والمحاولة مجدداً.'
            : 'AI scan failed. Please ensure report is clear and try again.')
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyToForm = () => {
    if (!onApplyToForm) return;
    onApplyToForm({
      modality: editModality,
      testName: editTestName,
      status: editStatus,
      timestamp: editTimestamp ? new Date(editTimestamp).toISOString() : new Date().toISOString(),
      resultReport: editReport,
      notes: editNotes,
    });
    onClose();
  };

  const handleDirectSave = async () => {
    if (!onDirectSave) {
      handleApplyToForm();
      return;
    }
    setIsSaving(true);
    try {
      await onDirectSave({
        patientId,
        bedNumber,
        modality: editModality,
        testName: editTestName.trim() || 'Diagnostic Report',
        timestamp: editTimestamp ? new Date(editTimestamp).toISOString() : new Date().toISOString(),
        status: editStatus,
        resultReport: editReport.trim(),
        notes: editNotes.trim() || undefined,
        recordedByName: 'AI Smart Scanner (Gemini)',
      });

      setSaveSuccess(true);
      if (onInvestigationAdded) {
        onInvestigationAdded();
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Direct save error:', err);
      setAnalysisError(err.message || 'فشل حفظ الفحص في السجل الطبي');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-4xl bg-[#080e1e] border border-teal-500/30 rounded-2xl shadow-2xl shadow-teal-500/10 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{lang === 'ar' ? 'المسح الضوئي الذكي للأشعة والتقارير' : 'AI Smart Radiology & Investigation Scanner'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    Gemini Vision OCR
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' 
                  ? `التعرف الفوري على تقارير أشعة الصدر، CT، السونار، وتخطيط القلب للسرير ${bedNumber}` 
                  : `Automated recognition for CXR, CT, ultrasound, and ECG reports for Bed ${bedNumber}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Top Bar: Mode Selectors & Clinical Sample Quick Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveInputMode('upload');
                  stopCamera();
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeInputMode === 'upload'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'رفع ملف / صورة' : 'Upload Image'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveInputMode('camera');
                  startCamera();
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeInputMode === 'camera'
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تصوير بالكاميرا' : 'Live Camera'}</span>
              </button>
            </div>

            {/* Quick Demo Samples */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-slate-400">
                {lang === 'ar' ? 'نماذج تجريبية سريعة:' : 'Demo Reports:'}
              </span>
              <button
                type="button"
                onClick={() => loadSample('CXR')}
                disabled={isAnalyzing}
                className="px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-600/40 text-sky-300 text-[11px] font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="Chest X-Ray AP Portable Report (ARDS/Infiltrates)"
              >
                CXR (أشعة صدر)
              </button>
              <button
                type="button"
                onClick={() => loadSample('CT')}
                disabled={isAnalyzing}
                className="px-2.5 py-1 rounded-lg bg-teal-950/80 hover:bg-teal-900 border border-teal-600/40 text-teal-300 text-[11px] font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="CT Brain Non-Contrast Report"
              >
                CT Brain (مقطعية)
              </button>
              <button
                type="button"
                onClick={() => loadSample('ECG')}
                disabled={isAnalyzing}
                className="px-2.5 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/40 text-rose-300 text-[11px] font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="12-Lead Diagnostic ECG Printout"
              >
                12-Lead ECG
              </button>
              <button
                type="button"
                onClick={() => loadSample('ECHO')}
                disabled={isAnalyzing}
                className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-600/40 text-purple-300 text-[11px] font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                title="Bedside POCUS & Echocardiography"
              >
                POCUS / Echo
              </button>
            </div>
          </div>

          {/* Camera View */}
          {activeInputMode === 'camera' && (
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
                    <span className="text-[11px] bg-black/60 px-2 py-0.5 rounded text-teal-300 font-mono">
                      {lang === 'ar' ? 'ضع التقرير أو الفيلم داخل الإطار' : 'Align radiology report or film inside frame'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={isAnalyzing}
                    className="absolute bottom-4 px-5 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'التقاط الصورة وتحليلها' : 'Capture & Scan'}</span>
                  </button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Upload Dropzone */}
          {activeInputMode === 'upload' && !selectedImage && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className="p-8 sm:p-12 text-center rounded-2xl border-2 border-dashed border-slate-700 hover:border-teal-500 bg-slate-900/30 hover:bg-slate-900/60 transition-all cursor-pointer space-y-3"
              onClick={() => {
                const input = document.getElementById('ai-inv-file-input');
                if (input) input.click();
              }}
            >
              <input
                id="ai-inv-file-input"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {lang === 'ar' ? 'اسحب وأفلت صورة التقرير الطبي أو الأشعة هنا' : 'Drag and drop radiology report or study image here'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === 'ar' ? 'يدعم صور PNG, JPG, JPEG أو تصوير الكاميرا' : 'Supports PNG, JPG, JPEG or camera captures'}
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-bold border border-slate-700 transition-all"
              >
                {lang === 'ar' ? 'تصفح جهازك' : 'Browse Files'}
              </button>
            </div>
          )}

          {/* Selected Image Thumbnail & Re-Scan Controls */}
          {selectedImage && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={selectedImage}
                  alt="Scanned Report"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-700 bg-black shrink-0"
                />
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-400" />
                    <span>{lang === 'ar' ? 'تم تجهيز الصورة للتحليل' : 'Image ready for analysis'}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {selectedImageMime}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => processImageWithAI(selectedImage, selectedImageMime)}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{lang === 'ar' ? 'إعادة التحليل' : 'Re-scan'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setScannedResult(null);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                  title={lang === 'ar' ? 'مسح واختيار صورة أخرى' : 'Clear image'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Loading Animation */}
          {isAnalyzing && (
            <div className="p-8 text-center rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-3 animate-pulse">
              <Sparkles className="w-8 h-8 text-teal-400 mx-auto animate-spin" />
              <p className="text-sm font-bold text-teal-300">
                {lang === 'ar' ? 'جارِ قراءة التقرير وفحص النتائج بالذكاء الاصطناعي...' : 'Analyzing diagnostic report and findings with Gemini AI...'}
              </p>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'استخراج نوع الفحص، النتائج السريرية، الانطباع الطبي والعلامات الحرجة' : 'Extracting modality, findings, acute impression, and clinical flags'}
              </p>
            </div>
          )}

          {/* Error Banner */}
          {analysisError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{lang === 'ar' ? 'تنبيه أثناء معالجة الصورة:' : 'Scan Processing Notice:'}</span>
              </div>
              <p className="leading-relaxed pl-6">{analysisError}</p>
            </div>
          )}

          {/* Scanned & Extracted Result Card */}
          {scannedResult && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Critical Alert Banner if flagged */}
              {scannedResult.hasCriticalFinding && (
                <div className="p-3.5 rounded-xl bg-rose-950/60 border-2 border-rose-500 text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-950/50 animate-pulse">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-rose-300 text-sm block">
                      {lang === 'ar' ? '⚠️ تنبيه سريري حرج تم رصده في التقرير:' : '⚠️ Critical Finding Detected in Report:'}
                    </strong>
                    <p className="mt-0.5 text-xs text-rose-100 font-medium">
                      {scannedResult.criticalFindingText || scannedResult.summaryAr}
                    </p>
                  </div>
                </div>
              )}

              {/* Clinical AI Summary Box */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-950/40 via-slate-900/60 to-slate-900/60 border border-teal-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'الملخص السريري الذكي (AI Clinical Summary):' : 'AI Clinical Summary:'}</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Confidence: {Math.round(scannedResult.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-200 font-sans leading-relaxed">
                  {lang === 'ar' ? scannedResult.summaryAr : scannedResult.summaryEn}
                </p>
              </div>

              {/* Editable Form for Verified Recording */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    <span>{lang === 'ar' ? 'مراجعة وتأكيد بيانات التقرير قبل الحفظ:' : 'Review & Confirm Extracted Findings:'}</span>
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {lang === 'ar' ? 'يمكنك تعديل أي حقل مباشرة' : 'All fields are editable'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Modality */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {lang === 'ar' ? 'نوع الفحص (Modality)' : 'Modality'}
                    </label>
                    <select
                      value={editModality}
                      onChange={(e) => setEditModality(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="Chest X-Ray">Chest X-Ray (أشعة الصدر)</option>
                      <option value="CT">CT (الأشعة المقطعية)</option>
                      <option value="MRI">MRI (الرنين المغناطيسي)</option>
                      <option value="Ultrasound">Ultrasound / POCUS (الموجات فوق الصوتية)</option>
                      <option value="ECG">ECG (تخطيط القلب)</option>
                      <option value="Echo">Echocardiography (السونار القلبي)</option>
                      <option value="Other">Other Diagnostic Study (فحوصات أخرى)</option>
                    </select>
                  </div>

                  {/* Test Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {lang === 'ar' ? 'اسم الفحص الدقيق' : 'Specific Study Name'}
                    </label>
                    <input
                      type="text"
                      value={editTestName}
                      onChange={(e) => setEditTestName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {lang === 'ar' ? 'حالة التقرير' : 'Status'}
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="REPORTED">{lang === 'ar' ? 'تقرير معتمد (Reported)' : 'Reported'}</option>
                      <option value="RESULTED">{lang === 'ar' ? 'نتيجة أولية (Resulted)' : 'Resulted'}</option>
                      <option value="ORDERED">{lang === 'ar' ? 'طلب معلق (Ordered)' : 'Ordered'}</option>
                    </select>
                  </div>

                  {/* Timestamp */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {lang === 'ar' ? 'تاريخ ووقت الفحص' : 'Exam Date & Time'}
                    </label>
                    <input
                      type="datetime-local"
                      value={editTimestamp}
                      onChange={(e) => setEditTimestamp(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                </div>

                {/* Report Findings & Impression */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'نص التقرير والنتائج الطبية (Findings & Impression)' : 'Report Findings & Clinical Impression'}
                  </label>
                  <textarea
                    value={editReport}
                    onChange={(e) => setEditReport(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-sans leading-relaxed whitespace-pre-wrap"
                    placeholder="Enter full findings and radiological impression..."
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'ملاحظات وتوجيهات سريرية' : 'Clinical Notes'}
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: تم إبلاغ طبيب العناية، فحص متنقل للسرير...' : 'e.g. Bedside study, ICU team alerted...'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="font-bold text-emerald-300 block text-sm">
                  {lang === 'ar' ? 'تم حفظ التقرير في ملف المريض بنجاح!' : 'Investigation successfully recorded into patient record!'}
                </strong>
                <p className="text-[11px] text-emerald-100 mt-0.5">
                  {lang === 'ar' ? 'تم توثيق النتائج وتحديث بطاقة الفحوصات والأشعة.' : 'Documented and synced to investigations flowsheet.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-800 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء' : 'Close'}
          </button>

          {scannedResult && (
            <div className="flex items-center gap-2">
              {onApplyToForm && (
                <button
                  type="button"
                  onClick={handleApplyToForm}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
                >
                  {lang === 'ar' ? 'تعبئة في نموذج الإدخال' : 'Fill Form'}
                </button>
              )}

              <button
                type="button"
                onClick={handleDirectSave}
                disabled={isSaving || saveSuccess || !editTestName.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-teal-400/20 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ar' ? 'جارِ الحفظ والتوثيق...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تسجيل الفحص في الملف الطبي' : 'Save & Record into Patient File'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
