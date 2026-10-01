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

  const [expectedModality, setExpectedModality] = useState<string>('ANY');

  // File & Camera input refs
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Clean state when closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedImage(null);
      setScannedResult(null);
      setAnalysisError(null);
      setIsAnalyzing(false);
      setSaveSuccess(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }, [isOpen]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-4xl bg-white dark:bg-[#080e1e] border border-slate-200 dark:border-teal-500/30 rounded-2xl shadow-2xl shadow-teal-500/10 flex flex-col max-h-[92vh] overflow-hidden text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{lang === 'ar' ? 'المسح الضوئي الذكي للأشعة والتقارير' : 'AI Smart Radiology & Investigation Scanner'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-100 text-teal-900 border border-teal-300 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40 font-bold">
                    Gemini Vision OCR
                  </span>
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'ar' 
                  ? `التعرف الفوري على تقارير أشعة الصدر، CT، السونار، وتخطيط القلب للسرير ${bedNumber}` 
                  : `Automated recognition for CXR, CT, ultrasound, and ECG reports for Bed ${bedNumber}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* TWO DIRECT OPTIONS ONLY: MOBILE CAMERA & CHOOSE IMAGE FROM DEVICE */}
          {!selectedImage && !isAnalyzing && (
            <div className="space-y-4 py-1 animate-in fade-in duration-200">
              {/* Hidden Inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />

              {/* Two Prominent Action Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Mobile Camera (Opens Native Camera) */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="group relative p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-teal-500/5 hover:from-emerald-500/25 hover:to-teal-500/20 border-2 border-emerald-500/40 hover:border-emerald-400 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer shadow-lg shadow-teal-950/20 active:scale-[0.98]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md group-hover:scale-105 transition-transform">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <span className="block text-base font-black text-slate-900 dark:text-white">
                      {lang === 'ar' ? 'فتح كاميرا الموبايل' : 'Open Mobile Camera'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {lang === 'ar' ? 'التقاط صورة التقرير أو الأشعة مباشرة بكاميرا الهاتف' : 'Take a photo of report / film now'}
                    </span>
                  </div>
                </button>

                {/* 2. Choose Image / File from Device */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative p-6 sm:p-7 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900/60 dark:hover:bg-slate-800/80 border-2 border-slate-300 dark:border-slate-700 hover:border-teal-500/60 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer shadow-md active:scale-[0.98]"
                >
                  <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 group-hover:text-teal-400 group-hover:scale-105 transition-all">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <span className="block text-base font-bold text-slate-900 dark:text-white">
                      {lang === 'ar' ? 'اختيار صورة أو ملف' : 'Choose Photo or File'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {lang === 'ar' ? 'رفع صورة أو PDF من الاستوديو أو ملفات الجهاز' : 'Select image or PDF from device'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Desktop Drag and Drop Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="p-3 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400"
              >
                {lang === 'ar' ? 'أو اسحب وأفلت صورة التقرير أو الأشعة هنا مباشرة' : 'Or drag and drop radiology file here'}
              </div>
            </div>
          )}

          {/* Selected Image Thumbnail & Re-Scan Controls */}
          {selectedImage && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={selectedImage}
                  alt="Scanned Report"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-black shrink-0"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>{lang === 'ar' ? 'تم تجهيز الصورة للتحليل' : 'Image ready for analysis'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {selectedImageMime}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => processImageWithAI(selectedImage, selectedImageMime)}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-500/20 hover:bg-teal-100 dark:hover:bg-teal-500/30 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
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
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                  title={lang === 'ar' ? 'مسح واختيار صورة أخرى' : 'Clear image'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Loading Animation */}
          {isAnalyzing && (
            <div className="p-8 text-center rounded-2xl bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-500/30 space-y-3 animate-pulse">
              <Sparkles className="w-8 h-8 text-teal-600 dark:text-teal-400 mx-auto animate-spin" />
              <p className="text-sm font-bold text-teal-800 dark:text-teal-300">
                {lang === 'ar' ? 'جارِ قراءة التقرير وفحص النتائج بالذكاء الاصطناعي...' : 'Analyzing diagnostic report and findings with Gemini AI...'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' ? 'استخراج نوع الفحص، النتائج السريرية، الانطباع الطبي والعلامات الحرجة' : 'Extracting modality, findings, acute impression, and clinical flags'}
              </p>
            </div>
          )}

          {/* Error Banner */}
          {analysisError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
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
                <div className="p-3.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-500 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-950/20 dark:shadow-rose-950/50 animate-pulse">
                  <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-rose-900 dark:text-rose-300 text-sm block">
                      {lang === 'ar' ? '⚠️ تنبيه سريري حرج تم رصده في التقرير:' : '⚠️ Critical Finding Detected in Report:'}
                    </strong>
                    <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-100 font-medium">
                      {scannedResult.criticalFindingText || scannedResult.summaryAr}
                    </p>
                  </div>
                </div>
              )}

              {/* Clinical AI Summary Box */}
              <div className="p-4 rounded-xl bg-teal-50/80 dark:bg-gradient-to-r dark:from-teal-950/40 dark:via-slate-900/60 dark:to-slate-900/60 border border-teal-200 dark:border-teal-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-800 dark:text-teal-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'الملخص السريري الذكي (AI Clinical Summary):' : 'AI Clinical Summary:'}</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30 font-bold">
                    Confidence: {Math.round(scannedResult.confidence * 100)}%
                  </span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 font-sans leading-relaxed">
                  {lang === 'ar' ? scannedResult.summaryAr : scannedResult.summaryEn}
                </p>
              </div>

              {/* Editable Form for Verified Recording */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    <span>{lang === 'ar' ? 'مراجعة وتأكيد بيانات التقرير قبل الحفظ:' : 'Review & Confirm Extracted Findings:'}</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                    {lang === 'ar' ? 'يمكنك تعديل أي حقل مباشرة' : 'All fields are editable'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Modality & Abbreviation */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'ar' ? 'مختصر ونوع الأشعة (Modality & Code)' : 'Modality & Abbreviation'}
                    </label>
                    <select
                      value={editModality}
                      onChange={(e) => setEditModality(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 cursor-pointer font-medium"
                    >
                      <option value="Chest X-Ray">[CXR] Chest X-Ray (أشعة الصدر)</option>
                      <option value="CT">[CT] CT Scan (الأشعة المقطعية)</option>
                      <option value="MRI">[MRI] MRI Scan (الرنين المغناطيسي)</option>
                      <option value="Ultrasound">[US/POCUS] Ultrasound (الموجات الصوتية / سونار)</option>
                      <option value="ECG">[ECG] 12-Lead ECG (تخطيط القلب)</option>
                      <option value="Echo">[ECHO] Echocardiography (السونار القلبي)</option>
                      <option value="Other">[OTHER] Other Diagnostic Study (فحوصات أخرى)</option>
                    </select>
                  </div>

                  {/* Test Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'ar' ? 'اسم الأشعة والفحص (Radiology Study Name)' : 'Radiology Study Name'}
                    </label>
                    <input
                      type="text"
                      value={editTestName}
                      onChange={(e) => setEditTestName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 font-semibold"
                      required
                    />
                  </div>
                </div>

                {/* Live Preview Strip for Mobile & Desktop */}
                <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] flex items-center justify-between gap-2 text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1 text-teal-700 dark:text-teal-300 font-mono font-bold shrink-0">
                    <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>
                      {editModality === 'Chest X-Ray' ? '[CXR]' :
                       editModality === 'CT' ? '[CT]' :
                       editModality === 'MRI' ? '[MRI]' :
                       editModality === 'Ultrasound' ? '[US/POCUS]' :
                       editModality === 'ECG' ? '[ECG]' :
                       editModality === 'Echo' ? '[ECHO]' : '[RAD]'}
                    </span>
                  </span>
                  <span className="truncate font-semibold text-slate-900 dark:text-white">
                    {editTestName || (lang === 'ar' ? 'اسم الأشعة غير محدد' : 'Study name not set')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'ar' ? 'حالة التقرير' : 'Status'}
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="REPORTED">{lang === 'ar' ? 'تقرير معتمد (Reported)' : 'Reported'}</option>
                      <option value="RESULTED">{lang === 'ar' ? 'نتيجة أولية (Resulted)' : 'Resulted'}</option>
                      <option value="ORDERED">{lang === 'ar' ? 'طلب معلق (Ordered)' : 'Ordered'}</option>
                    </select>
                  </div>

                  {/* Timestamp */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {lang === 'ar' ? 'تاريخ ووقت الفحص' : 'Exam Date & Time'}
                    </label>
                    <input
                      type="datetime-local"
                      value={editTimestamp}
                      onChange={(e) => setEditTimestamp(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                </div>

                {/* Report Findings & Impression */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'نص التقرير والنتائج الطبية (Findings & Impression)' : 'Report Findings & Clinical Impression'}
                  </label>
                  <textarea
                    value={editReport}
                    onChange={(e) => setEditReport(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-500 font-sans leading-relaxed whitespace-pre-wrap"
                    placeholder="Enter full findings and radiological impression..."
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'ar' ? 'ملاحظات وتوجيهات سريرية' : 'Clinical Notes'}
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: تم إبلاغ طبيب العناية، فحص متنقل للسرير...' : 'e.g. Bedside study, ICU team alerted...'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500 text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <strong className="font-bold text-emerald-900 dark:text-emerald-300 block text-sm">
                  {lang === 'ar' ? 'تم حفظ التقرير في ملف المريض بنجاح!' : 'Investigation successfully recorded into patient record!'}
                </strong>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-100 mt-0.5">
                  {lang === 'ar' ? 'تم توثيق النتائج وتحديث بطاقة الفحوصات والأشعة.' : 'Documented and synced to investigations flowsheet.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء' : 'Close'}
          </button>

          {scannedResult && (
            <div className="flex items-center gap-2">
              {onApplyToForm && (
                <button
                  type="button"
                  onClick={handleApplyToForm}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-300 border border-slate-300 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer active:scale-95"
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
e-wrap bQ8
