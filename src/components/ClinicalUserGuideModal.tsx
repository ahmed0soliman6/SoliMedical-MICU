import React, { useState, useRef } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  Printer, 
  Layers, 
  UserPlus, 
  Activity, 
  Wind, 
  Syringe, 
  Droplet, 
  FlaskConical, 
  ShieldAlert, 
  Stethoscope, 
  ArrowRightLeft, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Sparkles,
  Loader2
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface ClinicalUserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClinicalUserGuideModal: React.FC<ClinicalUserGuideModalProps> = ({ isOpen, onClose }) => {
  const { lang, isRTL } = useTranslation();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('all');
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current) return;
    setIsGeneratingPdf(true);
    try {
      // Create PDF using html2canvas & jsPDF for high-resolution visual layout
      const element = printAreaRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#0f172a'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      const renderedImgHeight = pdfWidth / ratio;

      let heightLeft = renderedImgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, renderedImgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - renderedImgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, renderedImgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Soli_MICU_Clinical_User_Manual_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      // Fallback: browser print dialog
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    {
      id: 'admission',
      titleAr: '1. تسجيل وتسكين المريض على السرير (Patient Admission)',
      titleEn: '1. Patient Admission & Bed Allocation',
      icon: UserPlus,
      color: 'teal',
      overviewAr: 'البوابة الأولى لدخول الحالة إلى وحدة العناية المركزة MICU وربط المريض بالسرير الفعلي وتحديد تدابير العزل وحساب القياسات الفسيولوجية.',
      overviewEn: 'Initial entry point to admit critical patients into the MICU, link to physical bed, configure isolation, and compute baseline physiology.',
      stepsAr: [
        'انقر على السرير الشاغر في الشاشة الرئيسية (Bed Matrix) أو زر "تسجيل مريض جديد" في الشريط الجانبي.',
        'أدخل اسم المريض ثلاثياً على الأقل، وآخر 4 أرقام من بطاقة الهوية الوطنية/الإقامة، ورقم الملف الطبي (MRN).',
        'حدد العمر والنوع والوزن الفعلي (Actual Weight) والطول (Height) ليقوم النظام بحساب الوزن المثالي (IBW) تلقائياً لمعايرة أجهزة التنفس.',
        'اختر مسار الإدخال (الطوارئ ER، العمليات OR، الأقسام الداخلية Ward) والتشخيص السريري المبدئي.',
        'حدد تدابير العزل (Airborne, Contact, Droplet) ودرجة الخطورة (Critical Stat, High Acuity).',
        'انقر على "تأكيد إدخال المريض للسرير" لتوليد السجل الطبي وتسكينه فورياً ومزامنة السحابة.'
      ],
      stepsEn: [
        'Click any Vacant Bed on the Central Matrix or "Admit Patient" in the navigation bar.',
        'Enter at least 3 parts of patient name, last 4 digits of National ID/Iqama, and optional MRN.',
        'Input Age, Gender, Actual Weight, and Height; IBW is calculated automatically for lung mechanics.',
        'Select Intake Pathway (ER, OR, Ward) and Primary Admission Diagnosis.',
        'Flag Isolation Precautions (Airborne, Contact, Droplet) and Acuity Level.',
        'Click "Complete Patient Admission" to allocate bed and sync across cloud and local storage.'
      ]
    },
    {
      id: 'dossier',
      titleAr: '2. ملف المريض والتشخيصات والحساسية (Clinical Dossier)',
      titleEn: '2. Clinical Dossier, Diagnoses & Allergies',
      icon: FileText,
      color: 'blue',
      overviewAr: 'إدارة السجل الطبي الشامل للمريض، كود الإنعاش (Code Status DNR/Full Code)، سجل الحساسية الدوائية المعتمد، والتاريخ المرضي.',
      overviewEn: 'Comprehensive patient dossier management, resuscitation code status, verified allergy registry, and chronic medical history.',
      stepsAr: [
        'الدخول على صفحة السرير المخصص للاطلاع على الشريط التعريفي بالأعلى (MRN، العمر، الوزن المثالي، الطبيب والممرض المسؤول).',
        'تعديل كود الإنعاش (Full Code / DNR) بضغطة زر مع توثيق اسم الاستشاري والسبب.',
        'إضافة الحساسية الدوائية مع تحديد رد الفعل (Reaction) ودرجة الخطورة، وتُقفل برقم الطبيب المعتمد لمنع التضارب الدوائي.',
        'استعراض تاريخ الزيارات السابقة والميكروبيولوجي من الأرشيف التاريخي التلقائي.'
      ],
      stepsEn: [
        'Open the dedicated Bed View to access the patient header (MRN, Age, IBW, Attending Physician).',
        'Update Resuscitation Code Status (Full Code / DNR) with consultant confirmation.',
        'Record drug allergies with reaction type and severity; locked cryptographically.',
        'Review past hospitalizations and microbiology isolates from historical archive.'
      ]
    },
    {
      id: 'vitals',
      titleAr: '3. بطاقة العلامات الحيوية والضغط الشرياني (Vital Signs & MAP)',
      titleEn: '3. Telemetry Vitals & Hemodynamic Monitoring',
      icon: Activity,
      color: 'emerald',
      overviewAr: 'مراقبة النبض، ضغط الدم، تشبع الأكسجين SpO2، وحساب الضغط الشرياني الوسطي MAP تلقائياً مع تنبيهات هيموديناميكية فورية.',
      overviewEn: 'Continuous hemodynamic monitoring, automatic Mean Arterial Pressure (MAP) computation, and immediate shock threshold alerts.',
      stepsAr: [
        'في صفحة السرير، انقر على زر "تسجيل قراءة حيوية جديدة (+)" في بطاقة العلامات الحيوية.',
        'أدخل معدل النبض (HR)، وضغط الدم الانقباضي والانبساطي (SBP/DBP). يقوم النظام بحساب MAP تلقائياً (MAP = DBP + [SBP - DBP]/3).',
        'إذا كان MAP < 65 mmHg، يتحول لون المؤشر إلى الأحمر التحذيري مع تنبيه سريري فوري لنقص التروية.',
        'أدخل نسبة تشبع الأكسجين SpO2، ونسبة الأكسجين المضاف FiO2، ودرجة الحرارة، ومقياس غلاسكو للوعي (GCS).',
        'انقر "حفظ القياس" لتحديث المخطط الزمني والرسم البياني.'
      ],
      stepsEn: [
        'In Bed View, click "Add Vitals (+)" on the Vital Signs Telemetry card.',
        'Enter Heart Rate and Blood Pressure (SBP/DBP); MAP is auto-computed instantaneously.',
        'If MAP < 65 mmHg, indicator pulses red for critical hypoperfusion warning.',
        'Enter SpO2, supplied FiO2%, Core Temperature, and GCS neurological score.',
        'Click "Save Vitals" to update flowsheet timeline and hemodynamic sparklines.'
      ]
    },
    {
      id: 'ventilator',
      titleAr: '4. بطاقة جهاز التنفس الصناعي (Mechanical Ventilation)',
      titleEn: '4. Mechanical Ventilation & Airway Management',
      icon: Wind,
      color: 'cyan',
      overviewAr: 'متابعة أنماط التنفس الميكانيكي (SIMV, PRVC, PSV, CPAP)، وحجم الهواء (Tidal Volume) بالنسبة للوزن المثالي، وضغط PEEP.',
      overviewEn: 'Monitor invasive/non-invasive ventilation modes, lung-protective tidal volumes based on IBW, PEEP, and airway pressures.',
      stepsAr: [
        'انقر على "تحديث إعدادات التنفس" في بطاقة جهاز التنفس الصناعي.',
        'اختر نمط التهوية (مثل: PRVC / SIMV / PSV / NIV) ونوع مجرى الهواء (ETT / Tracheostomy).',
        'أدخل الحجم المدي (Tidal Volume) وسيقوم النظام بمقارنته مع الوزن المثالي (IBW) لضمان حماية الرئة (6-8 ml/kg).',
        'سجل ضغط نهاية الزفير الإيجابي (PEEP)، وضغط الذروة (Peak Pressure)، ونسبة FiO2.',
        'احفظ الإعدادات لمزامنتها مع أخصائي العلاج التنفسي (RT) والأطباء.'
      ],
      stepsEn: [
        'Click "Update Ventilator" on the Mechanical Ventilation card.',
        'Select Ventilation Mode (PRVC, SIMV, PSV, BiPAP) and Airway Device (ETT / Trach).',
        'Enter Set/Exhaled Tidal Volume; system validates lung-protective target against IBW (6-8 mL/kg).',
        'Record PEEP, Peak Airway Pressure, and FiO2 concentration.',
        'Save parameters to sync with Respiratory Therapists and clinical staff.'
      ]
    },
    {
      id: 'infusions',
      titleAr: '5. بطاقة مضخات التسريب الوريدي (Continuous Infusion Pumps)',
      titleEn: '5. Continuous IV Infusion Pumps & Vasoactive Drugs',
      icon: Syringe,
      color: 'amber',
      overviewAr: 'إدارة أدوية الإنعاش والضغط الوريدية (Norepinephrine, Epinephrine, Vasopressin) والمهدئات مع حساب الجرعة المبرمجة بالمل/ساعة.',
      overviewEn: 'Manage vasoactive inotropes, vasopressors, and sedation titrations with real-time rate (mL/h) and weight-based concentration.',
      stepsAr: [
        'انقر على "إضافة مضخة تسريب (+)" في بطاقة مضخات التسريب.',
        'اختر الدواء السريري (مثل: Norepinephrine 4mg/50ml D5W أو Propofol أو Fentanyl).',
        'أدخل معدل الضخ الحالي بالمل/ساعة (mL/hr) والجرعة السريرية (mcg/kg/min أو mcg/min).',
        'حدد موقع القسطرة الوريدية (Central Line CVC أو Peripheral Line).',
        'يمكن تعديل الجرعة (Titration) أو إيقاف المضخة فورياً بضغطة زر واحدة.'
      ],
      stepsEn: [
        'Click "Add Infusion Pump (+)" on the Continuous Infusion card.',
        'Select medication standard line (e.g., Norepinephrine 4mg/50mL, Propofol, Insulin).',
        'Enter current Infusion Rate (mL/hr) and target Dose (mcg/kg/min or units/hr).',
        'Specify IV Line Access (CVC Central Line vs Peripheral).',
        'Titrate or stop infusion at any time with one click.'
      ]
    },
    {
      id: 'fluid_balance',
      titleAr: '6. بطاقات ميزان السوائل 12 ساعة و 24 ساعة (Fluid Balance)',
      titleEn: '6. 12-Hour & 24-Hour Fluid Balance (I/O Balance)',
      icon: Droplet,
      color: 'sky',
      overviewAr: 'حساب دقيق لجميع المدخلات (مغذيات وريدية، أدوية، تغذية أنبوبية) والمخرجات (بول Foley، نزح جراحي Drains، ترجيع) والمحصلة الصافية (Net Balance).',
      overviewEn: 'Strict cumulative intake/output balance tracking for IV fluids, feeds, urine output, and surgical drains with automatic Net Balance.',
      stepsAr: [
        'في بطاقة ميزان السوائل، انقر على "تسجيل سوائل الورديّة".',
        'أدخل كمية السوائل الوريدية المعطاة (IV Fluids/Parenteral) والتغذية الأنبوبية (Enteral Feeding).',
        'أدخل كمية البول (Urine Output via Foley Catheter) وأي مخرجات أخرى (Chest Drains, NG Tube).',
        'يقوم النظام بحساب المحصلة الصافية تلقائياً: (Net Balance = Total Intake - Total Output).',
        'تظهر المحصلة الإيجابية (+) بلون أزرق، والمحصلة السلبية (-) بلون كهرماني لمراقبة احتباس السوائل أو الجفاف.'
      ],
      stepsEn: [
        'On Fluid Balance card, click "Log Intake/Output".',
        'Record IV infusions, flushes, blood products, and enteral tube feeding (Intake).',
        'Record Foley urine volume and surgical drain output (Output).',
        'Net Balance is calculated in real time: Total Intake - Total Output.',
        'Displays positive (+) balance in blue and negative (-) balance in amber for fluid overload detection.'
      ]
    },
    {
      id: 'labs',
      titleAr: '7. بطاقة التحاليل الطبية العاجلة وغازات الدم (Stat Labs & ABG)',
      titleEn: '7. Stat Labs, Chemistry & Arterial Blood Gases (ABG)',
      icon: FlaskConical,
      color: 'purple',
      overviewAr: 'توثيق نتائج غازات الدم الشرياني (pH, PaCO2, PaO2, HCO3, Lactate)، كيمياء الدم، وظائف الكلى، وصورة الدم الكاملة مع تنبيهات القيم الحرجة.',
      overviewEn: 'Document serial ABGs, serum electrolytes, lactate, renal profile, and CBC with automated critical panic value highlighting.',
      stepsAr: [
        'انقر على "إضافة تحليل جديد" في بطاقة التحاليل (Stat Labs / ABG).',
        'أدخل نتائج غازات الدم: pH و PaCO2 و PaO2 و HCO3 واللاكتات (Lactate) ومستوى السكر.',
        'يقوم النظام تلقائياً بتحديد نوع الاضطراب الحمضي-القاعدي (مثل: Metabolic Acidosis / Respiratory Alkalosis).',
        'يتم إبراز القيم الحرجة (Panic Values) باللون الأحمر الفاقع لتنبيه الفريق الطبي.',
        'سجل نتائج تحاليل الكلى (Creatinine, Urea) وصورة الدم (Hb, Platelets, WBC).'
      ],
      stepsEn: [
        'Click "Add Lab Result (+)" on the Stat Labs / ABG card.',
        'Input blood gas values: pH, PaCO2, PaO2, HCO3, Base Excess, and Lactate.',
        'System flags acid-base disturbance and hypoxemic index automatically.',
        'Critical laboratory panic values are highlighted in bold red with timestamp.',
        'Record Serum Creatinine, Potassium, Hemoglobin, and Platelet count.'
      ]
    },
    {
      id: 'notes',
      titleAr: '8. بطاقة الملاحظات السريرية والتوقيع المشفر (Clinical Notes & SHA-256)',
      titleEn: '8. Clinical Notes & Cryptographic Signatures (SHA-256)',
      icon: Stethoscope,
      color: 'indigo',
      overviewAr: 'كتابة الملاحظات الطبية اليومية واستشارات العناية المركزة مع توليد توقيع إلكتروني وتشفير SHA-256 غير قابل للتعديل طبقاً لمعايير JCI و HIPAA.',
      overviewEn: 'Document daily progress notes and ICU consults with immutable SHA-256 cryptographic hashing and auditable addendums.',
      stepsAr: [
        'انقر على "كتابة ملاحظة سريرية جديدة" في بطاقة الملاحظات الطبية.',
        'اختر نوع الملاحظة: (Progress Note / ICU Consult / Procedure Note / MD Multidisciplinary Note).',
        'اكتب المحتوى السريري بالتفصيل (SOAP Format: Subjective, Objective, Assessment, Plan).',
        'عند الحفظ، يقوم النظام بتوليد رمز تشفير فريد (SHA-256 Hash) مع تثبيت اسم الطبيب ورقمه الوظيفي والوقت بالثانية.',
        'لحماية السجل الطبي، لا يمكن حذف الملاحظة أو تعديل أصلها، بل يمكن إضافة ملحق معتمد (Signed Addendum).'
      ],
      stepsEn: [
        'Click "New Clinical Note (+)" on the Clinical Notes card.',
        'Select Note Type (Daily Progress Note, ICU Consult, Procedure Note).',
        'Draft clinical text following SOAP structure.',
        'Upon signing, system generates an immutable SHA-256 digital signature token with exact timestamp.',
        'Original notes are locked; updates are appended as signed clinical addendums.'
      ]
    },
    {
      id: 'sbar',
      titleAr: '9. بطاقة تسليم المناوبات المتقدم واستلام الوردية (SBAR Handover)',
      titleEn: '9. SBAR Shift Handover & Doctor Shift Acknowledgment',
      icon: ArrowRightLeft,
      color: 'rose',
      overviewAr: 'المنظومة القياسية المعتمدة عالمياً لتسليم المناوبات الطبية بين الأطباء والتمريض (Situation - Background - Assessment - Recommendation) مع استلام وتوقيع فوري.',
      overviewEn: 'Standardized clinical handover protocol between shifts (SBAR) with real-time receiving physician acknowledgment.',
      stepsAr: [
        'في نهاية المناوبة، يفتح الطبيب المسلّم بطاقة SBAR على السرير.',
        'يقوم النظام بتعبئة البيانات الحيوية والتشخيصية تلقائياً لتوفير الوقت.',
        'يكتب الطبيب التقييم السريري (Assessment) والتوصيات والخطة العلاجية للمناوبة القادمة (Recommendation & Contingency Plan).',
        'ينقر على "اعتماد وإرسال تقرير التسليم SBAR".',
        'يفتح الطبيب المستلم حسابه ويراجع التقرير، ثم ينقر على زر "استلام المناوبة (Receive Shift)".',
        'فور النقر على الاستلام، يتم اعتماد النقل واختفاء الزر وتحديث اسم الطبيب المسؤول تلقائياً على شاشة السرير والكونسول المركزي.'
      ],
      stepsEn: [
        'At end of shift, outgoing physician opens the SBAR Handover card.',
        'System auto-populates current vitals, ventilator settings, and active infusions.',
        'Doctor writes Assessment and specific overnight Recommendations/Orders.',
        'Click "Submit SBAR Handover" to broadcast the report to incoming team.',
        'Incoming doctor reviews clinical status and clicks "Receive Shift".',
        'Upon receiving, bed header and central console immediately reflect incoming physician name.'
      ]
    },
    {
      id: 'discharge',
      titleAr: '10. بطاقة خروج المريض أو النقل والأرشفة السحابية (Discharge & Archive)',
      titleEn: '10. Patient Discharge, Transfer & Cloud Archiving',
      icon: LogOut,
      color: 'slate',
      overviewAr: 'إخلاء السرير السريري ونقل المريض للأقسام الداخلية أو خروجه النهائي، مع حفظ وأرشفة كامل بيانات الإقامة الطبية في السحابة للبحث المستقبلي.',
      overviewEn: 'Vacate ICU bed upon discharge or ward step-down, automatically archiving all telemetry and records to cloud storage.',
      stepsAr: [
        'انقر على زر "إجراءات خروج / نقل المريض" في أعلى صفحة السرير.',
        'اختر نوع الخروج: (نقل إلى الجناح Ward Step-down / خروج للمنزل Home / نقل لمستشفى آخر / وفاة).',
        'أدخل ملخص الخروج وتوصيات المتابعة والطبيب المعالج.',
        'انقر على "تأكيد الخروج والأرشفة".',
        'يتحول السرير فوراً إلى حالة "شاغر (Vacant)" ليصبح جاهزاً لاستقبال مريض جديد.',
        'يتم حفظ كامل التاريخ الطبي تلقائياً في "الأرشيف السحابي (Cloud Archive)" للبحث عنه لاحقاً برقم الهوية أو الـ MRN.'
      ],
      stepsEn: [
        'Click "Discharge / Transfer Patient" in Bed Management header.',
        'Select Disposition (Ward Transfer, Home Discharge, Hospital Transfer, Expired).',
        'Enter discharge summary and instructions.',
        'Click "Confirm Discharge & Archive".',
        'Bed status instantly updates to "Vacant" across all monitors.',
        'Complete medical stay is securely preserved in Cold Cloud Storage for future retrieval.'
      ]
    }
  ];

  const filteredSections = activeSection === 'all' 
    ? sections 
    : sections.filter(s => s.id === activeSection);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="bg-[#0b1329] border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        
        {/* Modal Top Header & Actions */}
        <div className="px-5 py-3.5 bg-[#0f1b38] border-b border-slate-700/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'دليل الاستخدام السريري المصور لجميع البطاقات' : 'Illustrated Clinical Cards User Manual'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono border border-teal-500/40">
                  MICU SOP v4.3
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'شرح تفصيلي لكيفية إدخال وإدارة البيانات في جميع وحدات النظام' : 'Comprehensive step-by-step clinical workflow & documentation guide'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              title={lang === 'ar' ? 'تحميل الدليل بصيغة PDF كامل' : 'Download Complete PDF Manual'}
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'ar' ? 'جارٍ إنشاء PDF...' : 'Generating PDF...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تحميل ملف PDF جاهز' : 'Download PDF Manual'}</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-600/80 transition-all cursor-pointer"
              title={lang === 'ar' ? 'طباعة الدليل مباشرة' : 'Print User Guide'}
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'طباعة' : 'Print'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section Filter Pills */}
        <div className="px-5 py-2.5 bg-[#090f20] border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0 text-xs">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-3 py-1.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
              activeSection === 'all'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }`}
          >
            {lang === 'ar' ? 'جميع البطاقات (10)' : 'All Cards (10)'}
          </button>
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`px-2.5 py-1.5 rounded-lg shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSection === sec.id
                  ? 'bg-teal-600 text-white font-bold shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              <sec.icon className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? sec.titleAr.split('.')[1]?.split('(')[0] || sec.titleAr : sec.titleEn.split('.')[1]?.split('&')[0] || sec.titleEn}</span>
            </button>
          ))}
        </div>

        {/* Printable & Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" id="clinical-manual-content" ref={printAreaRef}>
          
          {/* Header Banner inside printable document */}
          <div className="bg-gradient-to-r from-teal-950/80 via-slate-900 to-blue-950/80 border border-teal-500/40 rounded-2xl p-5 text-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono text-[11px] font-bold border border-teal-500/30">
                  Soli Medical MICU System
                </span>
                <span className="text-xs text-slate-400">• Standard Operating Procedures (SOP)</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {lang === 'ar' ? 'الدليل التشغيلي السريري لإدارة أسِرّة وبطاقات العناية المركزة' : 'ICU Clinical Cards & Bedside Flowsheet Operational Manual'}
              </h1>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                {lang === 'ar'
                  ? 'دليل عملي شامل يوضح بالتفصيل خطوات تسجيل المرضى، رصد القياسات الحيوية، ضبط أجهزة التنفس، حساب ميزان السوائل، تسليم SBAR، والإجراءات الطبية المعتمدة.'
                  : 'Standardized operational guide covering admission, hemodynamics, mechanical ventilation, fluid balance, SBAR handover, and clinical workflows.'}
              </p>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 text-right font-mono text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
              <div><strong>CBAHI & JCI Compliant</strong></div>
              <div>Security: <strong>SHA-256 Verified</strong></div>
              <div>Sync: <strong>Online + Dexie Offline</strong></div>
            </div>
          </div>

          {/* Cards & Sections Rendering */}
          <div className="grid grid-cols-1 gap-6">
            {filteredSections.map((sec, idx) => {
              const IconComp = sec.icon;
              return (
                <div 
                  key={sec.id}
                  className="bg-[#0e172e] border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-4 hover:border-teal-500/50 transition-colors"
                >
                  {/* Card Title & Icon Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30 shrink-0">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                          {lang === 'ar' ? sec.titleAr : sec.titleEn}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {lang === 'ar' ? sec.overviewAr : sec.overviewEn}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                      Step {idx + 1}
                    </span>
                  </div>

                  {/* Step-by-Step Instructions & Workflow */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      <span>{lang === 'ar' ? 'خطوات إدخال البيانات والتشغيل السريري:' : 'Operational Steps & Data Entry Guide:'}</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {(lang === 'ar' ? sec.stepsAr : sec.stepsEn).map((step, sIdx) => (
                        <div 
                          key={sIdx}
                          className="bg-[#070d1e] border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-200 hover:border-slate-700 transition-colors"
                        >
                          <span className="w-5 h-5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-500/30 font-mono font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                            {sIdx + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clinical Tips & Quality Standard Footer */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>
                        {lang === 'ar' 
                          ? 'يتم الحفظ والمزامنة السحابية اللحظية فوراً مع وجود حماية كاملة في وضع عدم الاتصال (Offline Dexie).'
                          : 'Realtime cloud persistence with seamless offline-first local fallback (Dexie).'}
                      </span>
                    </div>
                    <span className="font-mono text-teal-400 font-semibold shrink-0">✓ Realtime Sync</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Summary Reference Card */}
          <div className="bg-[#091124] border border-slate-800 rounded-2xl p-5 text-xs space-y-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-teal-400" />
              <span>{lang === 'ar' ? 'إرشادات الأمان والدعم السريري السريع (Quick Help)' : 'Clinical Support & Safety Protocols'}</span>
            </h3>
            <p className="text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'في حال حدوث أي انقطاع لشبكة الإنترنت، تستمر جميع البطاقات بالعمل محلياً عبر قاعدة البيانات الداخلية الآمنة، ويتم رفع البيانات تلقائياً بمجرد عودة الاتصال دون أي فقدان للسجلات.'
                : 'In case of network disconnection, all bedside cards continue operating smoothly offline in local Dexie database, auto-syncing to cloud upon reconnection.'}
            </p>
          </div>
        </div>

        {/* Modal Bottom Sticky Footer */}
        <div className="px-5 py-3 bg-[#0f1b38] border-t border-slate-700/80 flex items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-400">
            {lang === 'ar' ? 'جاهز للطباعة والتحميل بتنسيق A4 للوحدة' : 'Ready for A4 Hospital Ward Printing & Distribution'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تحميل كملف PDF' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
