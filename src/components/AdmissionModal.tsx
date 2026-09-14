import React, { useState, useEffect } from 'react';
import { X, UserPlus, CheckCircle2 } from 'lucide-react';
import { 
  BedRecord, 
  BedNumber, 
  BedStatus, 
  CodeStatus, 
  AcuityLevel, 
  Gender, 
  IntakePathway,
  StaffRole,
  AllergySeverity
} from '../types/schema.ts';
import { admitPatient, calculateIdealBodyWeight } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';

interface AdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  beds: BedRecord[];
  targetBedNumber?: BedNumber | null;
  onAdmissionSuccess: () => void;
}

export const AdmissionModal: React.FC<AdmissionModalProps> = ({
  isOpen,
  onClose,
  beds,
  targetBedNumber,
  onAdmissionSuccess,
}) => {
  const { t, lang, isRTL } = useTranslation();
  const availableBeds = beds.filter(b => b.status === BedStatus.VACANT || b.status === BedStatus.TRANSFER_PENDING);

  const [selectedBed, setSelectedBed] = useState<BedNumber>(
    targetBedNumber || (availableBeds[0]?.bedNumber as BedNumber) || BedNumber.BED_01
  );

  useEffect(() => {
    if (isOpen) {
      if (targetBedNumber) {
        setSelectedBed(targetBedNumber);
      } else if (availableBeds.length > 0) {
        setSelectedBed(availableBeds[0].bedNumber as BedNumber);
      }
    }
  }, [isOpen, targetBedNumber, beds]);
  const [mrn, setMrn] = useState<string>(`MRN-${Math.floor(100000 + Math.random() * 900000)}`);
  const [fullNameAr, setFullNameAr] = useState<string>('');
  const [fullNameEn, setFullNameEn] = useState<string>('');
  const [age, setAge] = useState<number>(60);
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [heightCm, setHeightCm] = useState<number>(172);
  const [weightKg, setWeightKg] = useState<number>(75);
  const [codeStatus, setCodeStatus] = useState<CodeStatus>(CodeStatus.FULL_CODE);
  const [acuityLevel, setAcuityLevel] = useState<AcuityLevel>(AcuityLevel.CRITICAL_STAT);
  const [intakePathway, setIntakePathway] = useState<IntakePathway>(IntakePathway.STAT_CRITICAL);
  const [primaryDiagnosisAr, setPrimaryDiagnosisAr] = useState<string>('صدمة إنتانية مع قصور تنفسي حاد');
  const [primaryDiagnosisEn, setPrimaryDiagnosisEn] = useState<string>('Septic Shock secondary to severe community-acquired pneumonia with ARDS');
  const [allergiesInput, setAllergiesInput] = useState<string>('Penicillin');
  const [isolation, setIsolation] = useState<string>('Contact Precautions');
  const [attendingDoctor, setAttendingDoctor] = useState<string>('Dr. Hesham Talaat');
  const [primaryNurse, setPrimaryNurse] = useState<string>('RN Mona Hassan');
  const [initialMap, setInitialMap] = useState<number>(62);
  const [initialHr, setInitialHr] = useState<number>(115);
  const [initialSpo2, setInitialSpo2] = useState<number>(91);
  const [initialFio2, setInitialFio2] = useState<number>(60);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const calculatedIbw = calculateIdealBodyWeight(heightCm, gender);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const allergiesList = allergiesInput.trim() 
        ? [{
            allergen: allergiesInput.trim(),
            reaction: 'Anaphylaxis / Severe Bronchospasm',
            severity: AllergySeverity.SEVERE,
          }]
        : [];

      await admitPatient({
        targetBed: selectedBed,
        mrn: mrn.trim(),
        fullNameAr: fullNameAr.trim() || fullNameEn.trim(),
        fullNameEn: fullNameEn.trim() || fullNameAr.trim(),
        age: Number(age),
        gender,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        codeStatus,
        acuityLevel,
        intakePathway,
        primaryDiagnosisAr,
        primaryDiagnosisEn,
        attendingDoctor: {
          staffId: 'DOC-102',
          name: attendingDoctor,
          role: StaffRole.CONSULTANT,
        },
        assignedNurse: {
          staffId: 'NUR-405',
          name: primaryNurse,
          role: StaffRole.LEAD_RN,
        },
        allergies: allergiesList,
        isolationPrecautions: isolation ? [isolation] : [],
        initialVitals: {
          heartRateBpm: Number(initialHr),
          systolicBpMmHg: Math.round(initialMap + 25),
          diastolicBpMmHg: Math.round(initialMap - 15),
          isArterialLine: true,
          spo2Percent: Number(initialSpo2),
          fio2SuppliedPercent: Number(initialFio2),
          respiratoryRateCpm: 24,
          coreTemperatureCelsius: 38.6,
          gcsTotalScore: 11,
        },
        initialAdmissionNote: `Direct MICU Admission to Bed ${selectedBed}. Patient admitted with ${primaryDiagnosisEn}. Baseline MAP ${initialMap} mmHg on invasive line.`,
      });

      onAdmissionSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء تسجيل الدخول للسرير.' : 'Error during bed admission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0c1426] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#090f1d] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {lang === 'ar' ? 'إدخال مريض جديد للرعاية المركزة (MICU Admission)' : 'Direct MICU Admission Protocol'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? 'تسجيل بيانات الحالة والتشخيص وتجهيز ملف المونيتور والسرير'
                  : 'Register patient profile, clinical diagnosis, and initialize bedside telemetry'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
          {/* Bed Selection & MRN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold">
                {lang === 'ar' ? 'تخصيص السرير المستهدف (Bed Selection)' : 'Target Bed Allocation'}
              </label>
              <select
                value={selectedBed}
                onChange={(e) => setSelectedBed(e.target.value as BedNumber)}
                className="w-full mt-1 bg-[#0f172a] border border-teal-500/40 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-teal-400 focus:outline-none"
                required
              >
                {beds.map((b) => (
                  <option key={b.bedNumber} value={b.bedNumber}>
                    {lang === 'ar' 
                      ? `سرير ${b.bedNumber} - ${b.bayName} (${b.status})`
                      : `Bed ${b.bedNumber} - ${b.bayName} (${b.status})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold">
                {lang === 'ar' ? 'الرقم الطبي (MRN)' : 'Medical Record Number (MRN)'}
              </label>
              <input
                type="text"
                value={mrn}
                onChange={(e) => setMrn(e.target.value)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Patient Names (Arabic & English) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold">
                {lang === 'ar' ? 'الاسم بالكامل (عربي)' : 'Patient Full Name (Arabic)'}
              </label>
              <input
                type="text"
                value={fullNameAr}
                onChange={(e) => setFullNameAr(e.target.value)}
                placeholder="مثال: يحيى ممدوح السيد"
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold">
                {lang === 'ar' ? 'الاسم بالإنجليزية (Full Name EN)' : 'Patient Full Name (English)'}
              </label>
              <input
                type="text"
                value={fullNameEn}
                onChange={(e) => setFullNameEn(e.target.value)}
                placeholder="e.g. Yehia Mamdouh El-Sayed"
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Age, Gender, Height, Weight & IBW Calculation */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#070c18] p-3 rounded-xl border border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'العمر (Age)' : 'Age (yo)'}</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'الجنس (Gender)' : 'Gender'}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-1.5 text-white focus:border-teal-500 focus:outline-none"
              >
                <option value={Gender.MALE}>{lang === 'ar' ? 'ذكر (Male)' : 'Male'}</option>
                <option value={Gender.FEMALE}>{lang === 'ar' ? 'أنثى (Female)' : 'Female'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'الطول (cm)' : 'Height (cm)'}</label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400">{lang === 'ar' ? 'الوزن (kg) / IBW' : 'Weight (kg) / IBW'}</label>
              <input
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-teal-500 focus:outline-none"
                required
              />
              <div className="text-[10px] text-teal-400 font-mono mt-0.5">
                IBW Devine: {calculatedIbw} kg
              </div>
            </div>
          </div>

          {/* Code Status, Acuity, and Intake Pathway */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'حالة الإنعاش (Code Status)' : 'Code Status'}</label>
              <select
                value={codeStatus}
                onChange={(e) => setCodeStatus(e.target.value as CodeStatus)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-teal-500 focus:outline-none"
              >
                <option value={CodeStatus.FULL_CODE}>{lang === 'ar' ? 'FULL CODE (إنعاش قلبي رئوي كامل)' : 'FULL CODE (CPR / Defib / Intubate)'}</option>
                <option value={CodeStatus.DNR}>{lang === 'ar' ? 'DNR (عدم إجراء إنعاش قلبي رئوي)' : 'DNR (Do Not Resuscitate)'}</option>
                <option value={CodeStatus.DNI_ONLY}>{lang === 'ar' ? 'DNI ONLY (Do Not Intubate)' : 'DNI ONLY (Do Not Intubate)'}</option>
                <option value={CodeStatus.PALLIATIVE_COMFORT}>{lang === 'ar' ? 'PALLIATIVE COMFORT' : 'PALLIATIVE COMFORT'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'مستوى الخطورة (Acuity)' : 'Acuity Level'}</label>
              <select
                value={acuityLevel}
                onChange={(e) => setAcuityLevel(e.target.value as AcuityLevel)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold focus:border-teal-500 focus:outline-none"
              >
                <option value={AcuityLevel.CRITICAL_STAT}>{lang === 'ar' ? 'CRITICAL STAT (حرج جداً)' : 'CRITICAL STAT (1:1 Ratio)'}</option>
                <option value={AcuityLevel.GUARDED_STABLE}>{lang === 'ar' ? 'GUARDED STABLE (مستقر بحذر)' : 'GUARDED STABLE'}</option>
                <option value={AcuityLevel.STEP_DOWN}>{lang === 'ar' ? 'STEP DOWN (جاهز للتحويل)' : 'STEP DOWN (Transfer Ready)'}</option>
                <option value={AcuityLevel.HIGH_VIGILANCE}>{lang === 'ar' ? 'HIGH VIGILANCE (مراقبة مشددة)' : 'HIGH VIGILANCE'}</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'مسار الدخول (Pathway)' : 'Intake Pathway'}</label>
              <select
                value={intakePathway}
                onChange={(e) => setIntakePathway(e.target.value as IntakePathway)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
              >
                <option value={IntakePathway.STAT_CRITICAL}>{lang === 'ar' ? 'طوارئ الطبية STAT (ED Referral)' : 'Emergency Dept STAT Referral'}</option>
                <option value={IntakePathway.ELECTIVE_POST_OP}>{lang === 'ar' ? 'عمليات بعد الجراحة (Post-Op)' : 'OR Post-Operative'}</option>
                <option value={IntakePathway.FLOOR_TRANSFER}>{lang === 'ar' ? 'تدهور حالة بالجناح الداخلي (Floor Transfer)' : 'Inpatient Ward Floor Transfer'}</option>
                <option value={IntakePathway.ER_REFERRAL}>{lang === 'ar' ? 'تحويل خارجي من مستشفى آخر' : 'Inter-Hospital External Transfer'}</option>
              </select>
            </div>
          </div>

          {/* Primary Diagnosis */}
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'التشخيص الأساسي (عربي)' : 'Primary Diagnosis (Arabic)'}</label>
              <input
                type="text"
                value={primaryDiagnosisAr}
                onChange={(e) => setPrimaryDiagnosisAr(e.target.value)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'التشخيص بالإنجليزي (Primary Diagnosis ICD-10)' : 'Primary Diagnosis (ICD-10 / Description)'}</label>
              <input
                type="text"
                value={primaryDiagnosisEn}
                onChange={(e) => setPrimaryDiagnosisEn(e.target.value)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Allergies & Isolation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'الحساسية الدوائية (Allergies)' : 'Allergies & Sensitivities'}</label>
              <input
                type="text"
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                placeholder="Penicillin, Sulfa drugs, None known"
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'احتياطات العزل (Isolation)' : 'Isolation Precautions'}</label>
              <input
                type="text"
                value={isolation}
                onChange={(e) => setIsolation(e.target.value)}
                placeholder="Contact, Airborne, Droplet, Standard"
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Care Team */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'استشاري العناية المشرف (Attending)' : 'Attending ICU Consultant'}</label>
              <input
                type="text"
                value={attendingDoctor}
                onChange={(e) => setAttendingDoctor(e.target.value)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-semibold">{lang === 'ar' ? 'ممرض السرير المسؤول (Primary RN)' : 'Primary Bedside RN'}</label>
              <input
                type="text"
                value={primaryNurse}
                onChange={(e) => setPrimaryNurse(e.target.value)}
                className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Initial Vitals Baseline Grid */}
          <div className="bg-[#070c18] p-3 rounded-xl border border-slate-800 space-y-2">
            <span className="font-bold text-teal-300">
              {lang === 'ar' ? 'العلامات الحيوية الأولية عند الوصول (Initial Baseline Vitals)' : 'Initial Admission Telemetry Baseline'}
            </span>
            <div className="grid grid-cols-4 gap-2 font-mono">
              <div>
                <label className="text-[10px] text-slate-400">MAP (mmHg)</label>
                <input
                  type="number"
                  value={initialMap}
                  onChange={(e) => setInitialMap(Number(e.target.value))}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">HR (bpm)</label>
                <input
                  type="number"
                  value={initialHr}
                  onChange={(e) => setInitialHr(Number(e.target.value))}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">SpO₂ (%)</label>
                <input
                  type="number"
                  value={initialSpo2}
                  onChange={(e) => setInitialSpo2(Number(e.target.value))}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">FiO₂ (%)</label>
                <input
                  type="number"
                  value={initialFio2}
                  onChange={(e) => setInitialFio2(Number(e.target.value))}
                  className="w-full mt-1 bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-1.5 text-white font-bold"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-teal-500/25 active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>
                {isSubmitting 
                  ? (lang === 'ar' ? 'جاري التسكين...' : 'Admitting...') 
                  : (lang === 'ar' ? 'تأكيد إدخال المريض للسرير' : 'Confirm Bed Admission')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
