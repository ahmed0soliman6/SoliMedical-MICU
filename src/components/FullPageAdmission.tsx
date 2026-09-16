import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import { 
  BedNumber, 
  BedStatus, 
  CodeStatus, 
  AcuityLevel, 
  Gender, 
  IntakePathway, 
  StaffRole, 
  AllergySeverity,
  BedRecord,
  PatientDossier
} from '../types/schema.ts';
import { admitPatient, calculateIdealBodyWeight } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';
import { db } from '../db/icuSyncDb.ts';
import { toEnglishDigits, parseEnglishFloat, parseEnglishInt } from '../services/numberUtils.ts';

interface FullPageAdmissionProps {
  bedNumber: BedNumber;
  allBeds?: BedRecord[];
  allPatients?: PatientDossier[];
  onCancel: () => void;
  onAdmissionSuccess: () => void;
}

export const FullPageAdmission: React.FC<FullPageAdmissionProps> = ({
  bedNumber,
  allBeds,
  allPatients,
  onCancel,
  onAdmissionSuccess,
}) => {
  const { lang, isRTL } = useTranslation();

  const [bedsList, setBedsList] = useState<BedRecord[]>(allBeds || []);
  const [patientsList, setPatientsList] = useState<PatientDossier[]>(allPatients || []);
  const [targetBed, setTargetBed] = useState<BedNumber>(bedNumber);
  const [admissionError, setAdmissionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!allBeds || allBeds.length === 0) {
        const b = await db.beds.toArray();
        setBedsList(b);
      } else {
        setBedsList(allBeds);
      }
      if (!allPatients || allPatients.length === 0) {
        const p = await db.patients.toArray();
        setPatientsList(p);
      } else {
        setPatientsList(allPatients);
      }
    }
    loadData();
  }, [allBeds, allPatients]);

  // If initial bedNumber is occupied, automatically switch to first vacant bed
  useEffect(() => {
    if (bedsList.length > 0) {
      const currentBedRec = bedsList.find(b => b.bedNumber === targetBed);
      if (currentBedRec && (currentBedRec.status === BedStatus.OCCUPIED || currentBedRec.currentPatientId)) {
        const firstVacant = bedsList.find(b => b.status === BedStatus.VACANT && !b.currentPatientId);
        if (firstVacant) {
          setTargetBed(firstVacant.bedNumber as BedNumber);
        }
      }
    }
  }, [bedsList]);

  const targetBedRecord = bedsList.find(b => b.bedNumber === targetBed);
  const isTargetOccupied = !!targetBedRecord && (targetBedRecord.status === BedStatus.OCCUPIED || !!targetBedRecord.currentPatientId);
  const occupyingPatient = isTargetOccupied && targetBedRecord?.currentPatientId
    ? patientsList.find(p => p.id === targetBedRecord.currentPatientId)
    : null;

  const [mrn, setMrn] = useState<string>('');
  const [fullNameAr, setFullNameAr] = useState<string>('');
  const [age, setAge] = useState<number>(65);
  const [gender, setGender] = useState<Gender>(Gender.UNSPECIFIED);
  const [bloodType, setBloodType] = useState<string>('');
  const [heightCm, setHeightCm] = useState<number>(170);
  const [weightKg, setWeightKg] = useState<number>(78);
  const [codeStatus, setCodeStatus] = useState<CodeStatus>(CodeStatus.FULL_CODE);
  const [acuityLevel, setAcuityLevel] = useState<AcuityLevel>(AcuityLevel.CRITICAL_STAT);
  const [intakePathway, setIntakePathway] = useState<IntakePathway>(IntakePathway.STAT_CRITICAL);
  const [primaryDiagnosisAr, setPrimaryDiagnosisAr] = useState<string>('فشل تنفسي حاد مع التهاب رئوي حاد');
  const [primaryDiagnosisEn, setPrimaryDiagnosisEn] = useState<string>('Acute Respiratory Failure secondary to Severe Community-Acquired Pneumonia');
  const [allergiesInput, setAllergiesInput] = useState<string>('None Known');
  const [isolation, setIsolation] = useState<string>('Standard Precautions');
  const [recalledArchiveNotice, setRecalledArchiveNotice] = useState<string | null>(null);
  
  // Baselines
  const [initialMap, setInitialMap] = useState<number>(65);
  const [initialHr, setInitialHr] = useState<number>(110);
  const [initialSpo2, setInitialSpo2] = useState<number>(90);
  const [initialFio2, setInitialFio2] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-search archive/patients when entering last 4 digits of Card ID or MRN
  useEffect(() => {
    async function searchArchive() {
      const cleanInput = mrn.trim();
      if (!cleanInput || cleanInput.length < 3) {
        setRecalledArchiveNotice(null);
        return;
      }
      try {
        const allRecords = await db.patients.toArray();
        const match = allRecords.find(p => 
          p.mrn.endsWith(cleanInput) || 
          p.mrn.includes(cleanInput) ||
          (p.nationalId && p.nationalId.endsWith(cleanInput))
        );
        if (match) {
          if (match.fullNameAr) setFullNameAr(match.fullNameAr);
          if (match.age) setAge(match.age);
          if (match.gender) setGender(match.gender as Gender);
          if (match.bloodType) setBloodType(match.bloodType);
          if (match.heightCm) setHeightCm(match.heightCm);
          if (match.weightKg) setWeightKg(match.weightKg);
          if (match.primaryDiagnosisAr) setPrimaryDiagnosisAr(match.primaryDiagnosisAr);
          if (match.allergies && match.allergies.length > 0) {
            setAllergiesInput(match.allergies.map(a => a.allergen).join(', '));
          }
          if (match.isolationPrecautions && match.isolationPrecautions.length > 0) {
            setIsolation(match.isolationPrecautions[0]);
          }
          setRecalledArchiveNotice(match.fullNameAr || match.fullNameEn || match.mrn);
        } else {
          setRecalledArchiveNotice(null);
        }
      } catch (e) {
        console.error('Error searching patient archive:', e);
      }
    }
    searchArchive();
  }, [mrn]);

  const calculatedIbw = calculateIdealBodyWeight(heightCm, gender);

  const regenerateMrn = () => {
    setMrn(`${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmissionError(null);

    if (isTargetOccupied) {
      setAdmissionError(
        lang === 'ar'
          ? `السرير ${targetBed} مشغول حالياً. يرجى اختيار سرير شاغر آخر لإتمام الدخول.`
          : `Bed ${targetBed} is already occupied. Please select an available vacant bed.`
      );
      return;
    }

    if (!fullNameAr.trim()) {
      setAdmissionError(lang === 'ar' ? 'يرجى إدخال اسم المريض بالكامل.' : 'Please enter patient full name.');
      return;
    }
    setIsSubmitting(true);
    try {
      const allergiesList = allergiesInput.trim() && allergiesInput !== 'None Known'
        ? [{
            allergen: allergiesInput.trim(),
            reaction: 'Clinical Sensitivity / Vigilance Required',
            severity: AllergySeverity.MODERATE,
          }]
        : [];

      // Detect current logged in physician / user in background
      let docName = 'د. هشام طلعت (الاستشاري المسجل)';
      let nurseName = 'ممرض السرير المسؤول (RN)';
      try {
        const storedUser = localStorage.getItem('icu_current_user') || localStorage.getItem('soli_logged_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed.nameAr || parsed.nameEn || parsed.name) {
            docName = parsed.nameAr || parsed.nameEn || parsed.name;
          }
        }
      } catch (e) {}

      await admitPatient({
        targetBed,
        mrn: toEnglishDigits(mrn.trim() || `CARD-${Math.floor(1000 + Math.random() * 9000)}`),
        fullNameAr: fullNameAr.trim(),
        fullNameEn: fullNameAr.trim(), // Automatically mirrored for system compatibility
        age: parseEnglishInt(age) || 65,
        gender: gender || Gender.UNSPECIFIED,
        bloodType: bloodType || undefined,
        heightCm: parseEnglishFloat(heightCm) || 170,
        weightKg: parseEnglishFloat(weightKg) || 75,
        codeStatus,
        acuityLevel,
        intakePathway,
        primaryDiagnosisAr: primaryDiagnosisAr.trim(),
        primaryDiagnosisEn: primaryDiagnosisEn.trim() || primaryDiagnosisAr.trim(),
        attendingDoctor: {
          staffId: 'DOC-ACTIVE',
          name: docName,
          role: StaffRole.CONSULTANT,
        },
        assignedNurse: {
          staffId: 'NUR-ACTIVE',
          name: nurseName,
          role: StaffRole.LEAD_RN,
        },
        allergies: allergiesList,
        isolationPrecautions: isolation ? [isolation] : [],
        initialVitals: {
          heartRateBpm: parseEnglishInt(initialHr) || 110,
          systolicBpMmHg: Math.round((parseEnglishFloat(initialMap) || 65) + 25),
          diastolicBpMmHg: Math.round((parseEnglishFloat(initialMap) || 65) - 15),
          isArterialLine: true,
          spo2Percent: parseEnglishInt(initialSpo2) || 90,
          fio2SuppliedPercent: parseEnglishInt(initialFio2) || 50,
          respiratoryRateCpm: 22,
          coreTemperatureCelsius: 38.2,
          gcsTotalScore: 12,
        },
        initialAdmissionNote: `Direct admission completed for Bed ${targetBed}. Recorded by logged user: ${docName}.`,
      });

      onAdmissionSuccess();
    } catch (err: any) {
      console.error(err);
      setAdmissionError(err?.message || (lang === 'ar' ? 'حدث خطأ أثناء إجراء إدخال المريض للسرير.' : 'Error performing patient admission.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Error / Conflict Alert */}
      {admissionError && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-3 text-red-300">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="block text-xs font-bold text-red-200 mb-0.5">
              {lang === 'ar' ? 'تعذر إتمام الدخول إلى السرير' : 'Admission Could Not Be Completed'}
            </strong>
            <p className="text-xs text-red-300">{admissionError}</p>
          </div>
        </div>
      )}

      {/* Main Full-Page Admission Form */}
      <form onSubmit={handleSubmit} className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-6 text-xs">
        {/* Bed Status Warning (Only if target bed is occupied) */}
        {isTargetOccupied && (
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300 block text-xs">
                {lang === 'ar' ? `السرير ${targetBed} مشغول حالياً` : `Bed ${targetBed} is Currently Occupied`}
              </strong>
              <p className="text-slate-300 mt-0.5 text-[11px]">
                {lang === 'ar'
                  ? `السرير ${targetBed} مخصص حالياً للمريض ${occupyingPatient?.fullNameAr || occupyingPatient?.fullNameEn || ''} (${occupyingPatient?.mrn || ''}). يرجى اختيار سرير شاغر آخر من القائمة في الأعلى أو نقل الحالة الحالية أولاً.`
                  : `Bed ${targetBed} is occupied by ${occupyingPatient?.fullNameAr || occupyingPatient?.fullNameEn || 'patient'} (${occupyingPatient?.mrn || ''}). Please switch to a vacant bed from the selector above or transfer/discharge the current patient first.`}
              </p>
            </div>
          </div>
        )}

        {/* Section 1: Demographics & Identifiers */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>1. {lang === 'ar' ? 'البيانات الشخصية والتعريفية للمريض' : 'Patient Identifiers & Demographics'}</span>
            {recalledArchiveNotice && (
              <span className="text-[11px] font-normal text-teal-300 bg-teal-950/80 border border-teal-500/50 px-2.5 py-1 rounded-lg animate-pulse">
                {lang === 'ar' 
                  ? `✨ تم استرجاع الملف الطبي السابق من الأرشيف تلقائياً (${recalledArchiveNotice})`
                  : `✨ Archived record auto-recalled (${recalledArchiveNotice})`}
              </span>
            )}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'رقم بطاقة المريض (آخر 4 أرقام)' : 'Patient Card / Medical ID (Last 4 Digits)'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value)}
                  placeholder="مثال: 5044 أو 350440"
                  className="w-full bg-[#070c18] border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={regenerateMrn}
                  className="absolute left-2.5 top-2.5 text-slate-500 hover:text-teal-400 transition-colors"
                  title={lang === 'ar' ? 'توليد رقم عشوائي' : 'Regenerate Code'}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'الاسم بالكامل (عربي)' : 'Patient Full Name (Arabic)'}
              </label>
              <input
                type="text"
                value={fullNameAr}
                onChange={(e) => setFullNameAr(e.target.value)}
                placeholder="مثال: يحيى ممدوح السيد"
                className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none text-xs font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-[#070c18] p-4 rounded-xl border border-slate-800/60">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{lang === 'ar' ? 'العمر (بالسنوات)' : 'Age (Years)'}</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{lang === 'ar' ? 'الجنس (Gender)' : 'Gender'}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:border-teal-500 focus:outline-none"
              >
                <option value={Gender.UNSPECIFIED}>{lang === 'ar' ? 'غير محدد' : 'Unspecified'}</option>
                <option value={Gender.MALE}>{lang === 'ar' ? 'ذكر (Male)' : 'Male'}</option>
                <option value={Gender.FEMALE}>{lang === 'ar' ? 'أنثى (Female)' : 'Female'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{lang === 'ar' ? 'فصيلة الدم (Blood Group)' : 'Blood Type'}</label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:border-teal-500 focus:outline-none font-bold text-teal-300"
              >
                <option value="">{lang === 'ar' ? 'غير محدد' : 'Unspecified'}</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{lang === 'ar' ? 'الطول (بالسم)' : 'Height (cm)'}</label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{lang === 'ar' ? 'الوزن (كجم)' : 'Actual Weight (kg)'}</label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:border-teal-500 focus:outline-none"
                required
              />
              <div className="text-[10px] text-teal-400 font-mono mt-1 font-semibold truncate">
                {lang === 'ar' ? `الوزن المثالي: ${calculatedIbw} كجم` : `IBW: ${calculatedIbw} kg`}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Clinical Priorities & Diagnosis */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
            2. {lang === 'ar' ? 'التشخيص الطبي والمسار السريري للحالة' : 'Clinical Diagnosis & Intake Pathway'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'حالة الإنعاش الطبي (Code Status)' : 'Code Status (Clinical Directive)'}
              </label>
              <select
                value={codeStatus}
                onChange={(e) => setCodeStatus(e.target.value as CodeStatus)}
                className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-teal-500 focus:outline-none"
              >
                <option value={CodeStatus.FULL_CODE}>{lang === 'ar' ? 'FULL CODE (إنعاش قلبي رئوي كامل)' : 'FULL CODE (CPR / Defib / Intubate)'}</option>
                <option value={CodeStatus.DNR}>{lang === 'ar' ? 'DNR (عدم إجراء إنعاش قلبي رئوي)' : 'DNR (Do Not Resuscitate)'}</option>
                <option value={CodeStatus.DNI_ONLY}>{lang === 'ar' ? 'DNI ONLY (عدم التنبيب الرئوي)' : 'DNI ONLY (Do Not Intubate)'}</option>
                <option value={CodeStatus.PALLIATIVE_COMFORT}>{lang === 'ar' ? 'PALLIATIVE COMFORT (تلطيفي مريح)' : 'PALLIATIVE COMFORT'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'مستوى الخطورة ونسبة الرعاية (Acuity Level)' : 'Acuity Level & Staffing Ratio'}
              </label>
              <select
                value={acuityLevel}
                onChange={(e) => setAcuityLevel(e.target.value as AcuityLevel)}
                className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-teal-500 focus:outline-none"
              >
                <option value={AcuityLevel.CRITICAL_STAT}>{lang === 'ar' ? 'CRITICAL STAT (حرج جداً 1:1)' : 'CRITICAL STAT (1:1 Ratio)'}</option>
                <option value={AcuityLevel.GUARDED_STABLE}>{lang === 'ar' ? 'GUARDED STABLE (مستقر بحذر)' : 'GUARDED STABLE'}</option>
                <option value={AcuityLevel.STEP_DOWN}>{lang === 'ar' ? 'STEP DOWN (جاهز للنقل)' : 'STEP DOWN (Transfer Ready)'}</option>
                <option value={AcuityLevel.HIGH_VIGILANCE}>{lang === 'ar' ? 'HIGH VIGILANCE (مراقبة عالية)' : 'HIGH VIGILANCE'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'مسار الدخول للقسم (Intake Pathway)' : 'Intake / Referral Pathway'}
              </label>
              <select
                value={intakePathway}
                onChange={(e) => setIntakePathway(e.target.value as IntakePathway)}
                className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
              >
                <option value={IntakePathway.STAT_CRITICAL}>{lang === 'ar' ? 'طوارئ الطبية STAT (ED Referral)' : 'Emergency Dept STAT Referral'}</option>
                <option value={IntakePathway.ELECTIVE_POST_OP}>{lang === 'ar' ? 'عمليات بعد الجراحة (Post-Op)' : 'OR Post-Operative'}</option>
                <option value={IntakePathway.FLOOR_TRANSFER}>{lang === 'ar' ? 'تدهور حالة بالجناح الداخلي' : 'Inpatient Ward Floor Transfer'}</option>
                <option value={IntakePathway.ER_REFERRAL}>{lang === 'ar' ? 'تحويل خارجي من مستشفى آخر' : 'Inter-Hospital External Transfer'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-300 font-semibold block mb-1">
              {lang === 'ar' ? 'التشخيص الطبي الأساسي (Primary Diagnosis ICD-10)' : 'Primary Admitting Diagnosis (ICD-10)'}
            </label>
            <input
              type="text"
              value={primaryDiagnosisEn}
              onChange={(e) => {
                setPrimaryDiagnosisEn(e.target.value);
                setPrimaryDiagnosisAr(e.target.value);
              }}
              placeholder={lang === 'ar' ? 'مثال: فشل تنفسي حاد - Acute Respiratory Failure' : 'e.g. Acute Respiratory Failure'}
              className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none text-xs font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'الحساسية الدوائية والغذائية المعروفة' : 'Allergies & Severe Sensitivities'}
              </label>
              <input
                type="text"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'احتياطات العزل الطبي الوقائي' : 'Isolation & Infection Control Precautions'}
              </label>
              <input
                type="text"
                value={isolation}
                onChange={(e) => setIsolation(e.target.value)}
                className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Initial Telemetry Baseline */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
            3. {lang === 'ar' ? 'العلامات الحيوية الأولية لتشغيل المونيتور' : 'Initial Telemetry Monitor Baseline'}
          </h3>

          <div className="bg-[#070c18] p-4 rounded-xl border border-slate-800/60 space-y-2">
            <span className="text-[11px] text-teal-300 block font-semibold">
              {lang === 'ar' ? 'تجهيز قراءات شاشة المراقبة بجانب السرير (Bedside Telemetry Init)' : 'Initial Admission Baseline Vitals'}
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">MAP (mmHg)</label>
                <input
                  type="number"
                  value={initialMap}
                  onChange={(e) => setInitialMap(Number(e.target.value))}
                  className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">HR (bpm)</label>
                <input
                  type="number"
                  value={initialHr}
                  onChange={(e) => setInitialHr(Number(e.target.value))}
                  className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">SpO₂ (%)</label>
                <input
                  type="number"
                  value={initialSpo2}
                  onChange={(e) => setInitialSpo2(Number(e.target.value))}
                  className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">FiO₂ (%)</label>
                <input
                  type="number"
                  value={initialFio2}
                  onChange={(e) => setInitialFio2(Number(e.target.value))}
                  className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء وتراجع' : 'Cancel Admission'}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isTargetOccupied}
            className={`px-7 py-3 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all ${
              isTargetOccupied
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 shadow-teal-500/25 active:scale-95 cursor-pointer'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting 
                ? (lang === 'ar' ? 'جاري حجز السرير وإدخال الحالة...' : 'Registering Admission...') 
                : isTargetOccupied
                ? (lang === 'ar' ? 'السرير المحدد مشغول (اختر سريراً شاغراً)' : 'Target Bed is Occupied (Select Vacant Bed)')
                : (lang === 'ar' ? 'تأكيد دخول المريض وتنشيط السرير' : 'Confirm & Active ICU Bed')}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
