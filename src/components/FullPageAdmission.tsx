import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, CheckCircle2, AlertTriangle, Wrench, Power } from 'lucide-react';
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
import { admitPatient, calculateIdealBodyWeight, toggleBedOperationalStatus } from '../services/dataModel.ts';
import { searchExistingPatients, PatientCandidateMatch } from '../services/operations.ts';
import { useTranslation } from '../services/i18n.ts';
import { db } from '../db/icuSyncDb.ts';
import { toEnglishDigits, parseEnglishFloat, parseEnglishInt } from '../services/numberUtils.ts';
import { useAppNotifications } from '../services/NotificationContext.tsx';

import { doc } from 'firebase/firestore';
import { firestore, setDoc } from '../services/firebase.ts';

interface FullPageAdmissionProps {
  bedNumber: BedNumber;
  allBeds?: BedRecord[];
  allPatients?: PatientDossier[];
  initialPatient?: PatientDossier | null;
  onCancel: () => void;
  onAdmissionSuccess: () => void;
}

export const FullPageAdmission: React.FC<FullPageAdmissionProps> = ({
  bedNumber,
  allBeds,
  allPatients,
  initialPatient,
  onCancel,
  onAdmissionSuccess,
}) => {
  const { lang, isRTL } = useTranslation();
  const { triggerNotification } = useAppNotifications();

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

  // If initial bedNumber is occupied, automatically switch to first vacant bed (only when not editing)
  useEffect(() => {
    if (!initialPatient && bedsList.length > 0) {
      const currentBedRec = bedsList.find(b => b.bedNumber === targetBed);
      if (currentBedRec && (currentBedRec.status === BedStatus.OCCUPIED || currentBedRec.currentPatientId)) {
        const firstVacant = bedsList.find(b => b.status === BedStatus.VACANT && !b.currentPatientId);
        if (firstVacant) {
          setTargetBed(firstVacant.bedNumber as BedNumber);
        }
      }
    }
  }, [bedsList, initialPatient]);

  const targetBedRecord = bedsList.find(b => b.bedNumber === targetBed);
  const isTargetOccupied = !initialPatient && !!targetBedRecord && (targetBedRecord.status === BedStatus.OCCUPIED || !!targetBedRecord.currentPatientId);
  const isTargetUnavailable = !initialPatient && !!targetBedRecord && targetBedRecord.status === BedStatus.UNAVAILABLE;
  const occupyingPatient = isTargetOccupied && targetBedRecord?.currentPatientId
    ? patientsList.find(p => p.id === targetBedRecord.currentPatientId)
    : null;

  const [fullNameAr, setFullNameAr] = useState<string>('');
  const [nationalId, setNationalId] = useState<string>('');
  const [mrn, setMrn] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<Gender>(Gender.UNSPECIFIED);
  const [bloodType, setBloodType] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [codeStatus, setCodeStatus] = useState<CodeStatus>(CodeStatus.FULL_CODE);
  const [acuityLevel, setAcuityLevel] = useState<AcuityLevel>(AcuityLevel.CRITICAL_STAT);
  const [intakePathway, setIntakePathway] = useState<IntakePathway>(IntakePathway.STAT_CRITICAL);
  const [primaryDiagnosisAr, setPrimaryDiagnosisAr] = useState<string>('');
  const [primaryDiagnosisEn, setPrimaryDiagnosisEn] = useState<string>('');
  const [allergiesInput, setAllergiesInput] = useState<string>('None Known');
  const [isolation, setIsolation] = useState<string>('');
  const [candidateMatches, setCandidateMatches] = useState<PatientCandidateMatch[]>([]);
  const [selectedExistingPatient, setSelectedExistingPatient] = useState<PatientCandidateMatch | null>(null);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState<boolean>(false);
  
  // Baselines - initialized empty so users don't have to clear zeroes
  const [initialMap, setInitialMap] = useState<string>('');
  const [initialHr, setInitialHr] = useState<string>('');
  const [initialSpo2, setInitialSpo2] = useState<string>('');
  const [initialFio2, setInitialFio2] = useState<string>('');
  const [admissionNoteInput, setAdmissionNoteInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Populate form if editing an existing patient - runs only when patient ID changes (mount or switching patients)
  useEffect(() => {
    if (initialPatient) {
      setFullNameAr(initialPatient.fullNameAr || initialPatient.fullNameEn || '');
      setNationalId(initialPatient.nationalId || '');
      setMrn(initialPatient.mrn || '');
      setAge(initialPatient.age ? String(initialPatient.age) : '');
      setGender(initialPatient.gender || Gender.UNSPECIFIED);
      setBloodType(initialPatient.bloodType || '');
      setHeightCm(initialPatient.heightCm ? String(initialPatient.heightCm) : '');
      setWeightKg(initialPatient.weightKg ? String(initialPatient.weightKg) : '');
      setCodeStatus(initialPatient.codeStatus || CodeStatus.FULL_CODE);
      setAcuityLevel(initialPatient.acuityLevel || AcuityLevel.CRITICAL_STAT);
      setIntakePathway(initialPatient.intakePathway || IntakePathway.STAT_CRITICAL);
      setPrimaryDiagnosisAr(initialPatient.primaryDiagnosisAr || '');
      setPrimaryDiagnosisEn(initialPatient.primaryDiagnosisEn || '');
      if (initialPatient.allergies && initialPatient.allergies.length > 0) {
        setAllergiesInput(initialPatient.allergies.map(a => a.allergen).join(', '));
      } else {
        setAllergiesInput('None Known');
      }
      if (initialPatient.isolationPrecautions && initialPatient.isolationPrecautions.length > 0) {
        const first = initialPatient.isolationPrecautions[0];
        if (first && !first.toLowerCase().includes('standard') && first !== 'None') {
          setIsolation(first);
        } else {
          setIsolation('');
        }
      } else {
        setIsolation('');
      }
    }
  }, [initialPatient?.id]);

  // Deterministic Candidate Search (Normalized Name + National ID Last 4 + MRN) with User Confirmation
  useEffect(() => {
    if (initialPatient || selectedExistingPatient) return;
    const cleanNationalId = nationalId.trim();
    const cleanMrn = mrn.trim();
    const cleanName = fullNameAr.trim();

    if (!cleanNationalId && !cleanMrn && cleanName.length < 3) {
      setCandidateMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearchingCandidates(true);
        const matches = await searchExistingPatients(cleanName, cleanNationalId, cleanMrn);
        setCandidateMatches(matches);
      } catch (e) {
        console.error('Error searching patient candidates:', e);
      } finally {
        setIsSearchingCandidates(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [nationalId, mrn, fullNameAr, initialPatient, selectedExistingPatient]);

  const handleSelectCandidate = (candidate: PatientCandidateMatch) => {
    setSelectedExistingPatient(candidate);
    setCandidateMatches([]);
    if (candidate.fullNameAr) setFullNameAr(candidate.fullNameAr);
    if (candidate.mrn) setMrn(candidate.mrn);
    if (candidate.gender) setGender(candidate.gender as Gender);
    if (candidate.bloodType) setBloodType(candidate.bloodType);
    if (candidate.allergies && candidate.allergies.length > 0) {
      setAllergiesInput(candidate.allergies.join(', '));
    }
  };

  const handleRejectCandidate = () => {
    setCandidateMatches([]);
  };

  const handleClearSelectedExisting = () => {
    setSelectedExistingPatient(null);
  };

  const numHeight = parseEnglishFloat(heightCm) || 170;
  const calculatedIbw = calculateIdealBodyWeight(numHeight, gender);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdmissionError(null);

    if (!initialPatient && isTargetOccupied) {
      setAdmissionError(
        lang === 'ar'
          ? `السرير ${targetBed} مشغول حالياً. يرجى اختيار سرير شاغر آخر لإتمام الدخول.`
          : `Bed ${targetBed} is already occupied. Please select an available vacant bed.`
      );
      return;
    }

    // Rule 1: Validate full name is provided (at least 2 or 3 parts)
    const nameParts = fullNameAr.trim().split(/\s+/).filter(Boolean);
    if (nameParts.length < 2) {
      setAdmissionError(
        lang === 'ar'
          ? 'يرجى كتابة اسم المريض (الاسم الأول واسم العائلة على الأقل).'
          : 'Please enter at least first name and last name.'
      );
      return;
    }

    // Rule 2: Validate National ID / Card ID is strictly 4 numeric digits
    const cleanNatId = toEnglishDigits(nationalId.trim());
    if (!/^\d{4}$/.test(cleanNatId)) {
      setAdmissionError(
        lang === 'ar'
          ? 'يرجى إدخال آخر 4 أرقام من بطاقة الهوية / الرقم القومي (تتكون من 4 أرقام فقط).'
          : 'Please enter the last 4 digits of Card ID (strictly 4 digits).'
      );
      return;
    }

    // Rule 3: Validate Primary Diagnosis is provided
    if (!primaryDiagnosisAr.trim()) {
      setAdmissionError(
        lang === 'ar'
          ? 'يرجى كتابة التشخيص الطبي الأولي للمريض (إجباري).'
          : 'Please enter the primary medical diagnosis (mandatory).'
      );
      return;
    }

    // Optional fields (Age, Height, Weight)
    const parsedAge = age.trim() ? parseEnglishInt(age) : undefined;
    const parsedHeight = heightCm.trim() ? parseEnglishFloat(heightCm) : undefined;
    const parsedWeight = weightKg.trim() ? parseEnglishFloat(weightKg) : undefined;

    // Rule 4: Fresh check for bed occupancy
    if (!initialPatient) {
      const freshBed = await db.beds.get(targetBed);
      if (freshBed && (freshBed.status === BedStatus.OCCUPIED || freshBed.currentPatientId)) {
        setAdmissionError(
          lang === 'ar'
            ? `السرير رقم ${targetBed} تم إشغاله حالياً بواسطة مريض آخر. يرجى اختيار سرير شاغر آخر.`
            : `Bed ${targetBed} was just occupied by another patient. Please select a vacant bed.`
        );
        return;
      }
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

      // EDIT MODE
      if (initialPatient) {
        const updatedHeight = parsedHeight;
        const updatedWeight = parsedWeight;
        const updatedIbw = calculateIdealBodyWeight(updatedHeight, gender);

        const updatedPatient: PatientDossier = {
          ...initialPatient,
          fullNameAr: fullNameAr.trim(),
          fullNameEn: fullNameAr.trim(),
          nationalId: cleanNatId,
          mrn: toEnglishDigits(mrn.trim() || initialPatient.mrn),
          age: parsedAge,
          gender: gender || Gender.UNSPECIFIED,
          bloodType: bloodType || initialPatient.bloodType,
          heightCm: updatedHeight,
          weightKg: updatedWeight,
          idealBodyWeightKg: updatedIbw,
          codeStatus,
          acuityLevel,
          intakePathway,
          primaryDiagnosisAr: primaryDiagnosisAr.trim(),
          primaryDiagnosisEn: primaryDiagnosisEn.trim() || primaryDiagnosisAr.trim(),
          allergies: allergiesList,
          isolationPrecautions: isolation && isolation.trim() !== '' && !isolation.toLowerCase().includes('standard') ? [isolation.trim()] : [],
          updatedAt: new Date().toISOString(),
        };

        // Save locally to Dexie
        await db.patients.put(updatedPatient);

        // Sync to cloud Firestore before reporting success.
        const patientRef = doc(firestore, 'patients', updatedPatient.id);
        await setDoc(patientRef, updatedPatient, { merge: true });

        onAdmissionSuccess();
        return;
      }

      // Detect current logged in physician / user in background
      let docName = '';
      let nurseName = '';
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
        existingPatientId: selectedExistingPatient?.patientId,
        mrn: toEnglishDigits(mrn.trim() || `MRN-${Math.floor(10000 + Math.random() * 90000)}`),
        nationalId: cleanNatId,
        fullNameAr: fullNameAr.trim(),
        fullNameEn: fullNameAr.trim(),
        age: parsedAge,
        gender: gender || Gender.UNSPECIFIED,
        bloodType: bloodType || undefined,
        heightCm: parsedHeight,
        weightKg: parsedWeight,
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
        isolationPrecautions: isolation && isolation.trim() !== '' && !isolation.toLowerCase().includes('standard') ? [isolation.trim()] : [],
        initialVitals: (initialHr || initialMap || initialSpo2 || initialFio2) ? {
          heartRateBpm: initialHr ? parseEnglishInt(initialHr) : 80,
          systolicBpMmHg: initialMap ? Math.round(parseEnglishFloat(initialMap) + 25) : 120,
          diastolicBpMmHg: initialMap ? Math.round(parseEnglishFloat(initialMap) - 15) : 80,
          isArterialLine: !!initialMap,
          spo2Percent: initialSpo2 ? parseEnglishInt(initialSpo2) : 98,
          fio2SuppliedPercent: initialFio2 ? parseEnglishInt(initialFio2) : 21,
          respiratoryRateCpm: 16,
          coreTemperatureCelsius: 37.0,
          gcsTotalScore: 15,
        } : undefined,
        initialAdmissionNote: admissionNoteInput.trim() || undefined,
      });

      // Trigger Smart Admission Notification
      triggerNotification({
        type: 'ADMISSION',
        titleEn: `New ICU Admission - Bed ${targetBed}`,
        titleAr: `دخول حالة جديدة - سرير ${targetBed}`,
        messageEn: `Patient ${fullNameAr.trim()} successfully admitted to Bed ${targetBed}.`,
        messageAr: `تم تسجيل دخول المريض ${fullNameAr.trim()} بالسرير رقم ${targetBed}.`,
        target: {
          action: 'OPEN_BED',
          bedNumber: targetBed,
          patientName: fullNameAr.trim(),
        }
      });

      // Trigger Isolation Notification ONLY if a real active isolation precaution was chosen
      const hasActiveIsolation = isolation && isolation.trim() !== '' && !isolation.toLowerCase().includes('standard') && isolation !== 'NONE' && isolation !== 'لا يوجد عزل';
      if (hasActiveIsolation) {
        triggerNotification({
          type: 'ISOLATION_CHANGE',
          titleEn: `Isolation Precautions - Bed ${targetBed}`,
          titleAr: `تدابير العزل السريري - سرير ${targetBed}`,
          messageEn: `Bed ${targetBed} flagged with isolation precautions (${isolation}).`,
          messageAr: `تم تفعيل إجراءات العزل بالسرير رقم ${targetBed} (${isolation}).`,
          target: {
            action: 'OPEN_ISOLATION',
            bedNumber: targetBed,
            patientName: fullNameAr.trim(),
          }
        });
      }

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

        {/* Bed Out of Service Notice (If target bed is UNAVAILABLE) */}
        {isTargetUnavailable && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <Wrench className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-300 block text-xs">
                  {lang === 'ar' ? `السرير ${targetBed} مسجل خارج الخدمة حالياً (صيانة / تعقيم)` : `Bed ${targetBed} is Currently Out of Service`}
                </strong>
                <p className="text-slate-300 mt-0.5 text-[11px]">
                  {lang === 'ar'
                    ? `هذا السرير مسجل حالياً تحت أعمال الصيانة أو التطهير. لتفعيل السرير أو تغيير حالته التشغيلية، يرجى استخدام بطاقة "إدارة تشغيل وصيانة الأسِرّة" في شاشة الإعدادات.`
                    : `This bed is currently marked out of service (maintenance / decontamination). To reactivate it, please use the "Bed Operations & Maintenance" card in Settings.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section 1: Demographics & Identifiers */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center justify-between">
            <span>1. {lang === 'ar' ? 'البيانات الشخصية والتعريفية للمريض' : 'Patient Identifiers & Demographics'}</span>
            {selectedExistingPatient && (
              <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {lang === 'ar' 
                  ? `مرتبط بالملف الدائم: ${selectedExistingPatient.mrn || selectedExistingPatient.patientId}`
                  : `Linked to Dossier: ${selectedExistingPatient.mrn || selectedExistingPatient.patientId}`}
                <button
                  type="button"
                  onClick={handleClearSelectedExisting}
                  className="ms-1 underline text-[10px] text-slate-400 hover:text-white"
                >
                  {lang === 'ar' ? 'فك الارتباط' : 'Detach'}
                </button>
              </span>
            )}
          </h3>

          {/* Candidate Match Alert Card (Requires Explicit User Confirmation) */}
          {candidateMatches.length > 0 && !selectedExistingPatient && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/60 shadow-lg space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-amber-200">
                    {lang === 'ar' 
                      ? 'تم العثور على سجل مريض مطابق في قاعدة البيانات السريرية'
                      : 'Matching Patient Record Found in Clinical Database'}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {lang === 'ar'
                      ? 'تمت مطابقة البيانات مع ملف مريض مسجل مسبقاً. هل تود استعادة السجل الدائم وإعادة التنويم (Readmission) أم إنشاء مريض جديد؟'
                      : 'Demographics match an existing patient dossier. Do you wish to re-admit under this permanent record or create a separate new patient?'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {candidateMatches.map((cand) => (
                  <div key={cand.patientId} className="bg-[#070c18] p-3 rounded-lg border border-slate-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{cand.fullNameAr || cand.fullNameEn}</span>
                        <span className="font-mono text-teal-400 text-[11px]">MRN: {cand.mrn}</span>
                        {cand.nationalIdLast4 && (
                          <span className="text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                            ID: ****{cand.nationalIdLast4}
                          </span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300">
                          {cand.status}
                        </span>
                      </div>
                      {cand.primaryDiagnosis && (
                        <div className="text-[11px] text-slate-400">
                          {lang === 'ar' ? 'التشخيص السابق: ' : 'Previous Dx: '}{cand.primaryDiagnosis}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectCandidate(cand)}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition flex items-center gap-1 shadow"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {lang === 'ar' ? 'تأكيد واستعادة السجل (Readmission)' : 'Confirm & Re-admit'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleRejectCandidate}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  {lang === 'ar' ? 'تجاهل والتسجيل كمريض جديد منفصل' : 'Ignore & Create as New Separate Patient'}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* Box 1: Patient Full Name (At least 3 parts) */}
            <div>
              <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                {lang === 'ar' ? 'اسم المريض بالكامل (ثلاثي أو رباعي) *' : 'Patient Full Name (At least 3 parts) *'}
              </label>
              <input
                type="text"
                value={fullNameAr}
                onChange={(e) => setFullNameAr(e.target.value)}
                placeholder={lang === 'ar' ? 'مثال: يحيى ممدوح السيد' : 'e.g. John David Smith'}
                className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none text-xs font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 2: Card ID (Last 4 Digits) - Mandatory */}
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                  {lang === 'ar' ? 'آخر 4 أرقام من بطاقة الهوية / الرقم القومي *' : 'Last 4 Digits of Card ID *'}
                </label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(toEnglishDigits(e.target.value).slice(0, 4))}
                  placeholder={lang === 'ar' ? 'مثال: 5044' : 'e.g. 5044'}
                  maxLength={4}
                  className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none text-xs"
                  required
                />
              </div>

              {/* Box 3: Medical Record Number (MRN) - Optional, Under Card ID */}
              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1 flex items-center justify-between">
                  <span>{lang === 'ar' ? 'رقم الملف الطبي (MRN)' : 'Medical Record Number (MRN)'}</span>
                  <span className="text-[10px] text-teal-400 font-normal">({lang === 'ar' ? 'اختياري' : 'Optional'})</span>
                </label>
                <input
                  type="text"
                  value={mrn}
                  onChange={(e) => setMrn(toEnglishDigits(e.target.value))}
                  placeholder={lang === 'ar' ? 'مثال: MRN-5044 (اختياري)' : 'e.g. MRN-5044 (Optional)'}
                  className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-teal-500 focus:outline-none text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-[#070c18] p-4 rounded-xl border border-slate-800/60">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{lang === 'ar' ? 'العمر (اختياري)' : 'Age (Optional)'}</label>
              <input
                type="text"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(toEnglishDigits(e.target.value))}
                placeholder="65"
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:border-teal-500 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{lang === 'ar' ? 'الجنس (Gender)' : 'Gender'}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:border-teal-500 focus:outline-none text-xs"
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
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:border-teal-500 focus:outline-none font-bold text-teal-300 text-xs"
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
                type="text"
                inputMode="numeric"
                value={heightCm}
                onChange={(e) => setHeightCm(toEnglishDigits(e.target.value))}
                placeholder="170"
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:border-teal-500 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">{lang === 'ar' ? 'الوزن (كجم)' : 'Actual Weight (kg)'}</label>
              <input
                type="text"
                inputMode="numeric"
                value={weightKg}
                onChange={(e) => setWeightKg(toEnglishDigits(e.target.value))}
                placeholder="78"
                className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:border-teal-500 focus:outline-none text-xs"
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
                {lang === 'ar' ? 'احتياطات العزل الطبي الوقائي (في حال وجود عزل)' : 'Isolation & Infection Control Precautions (If Any)'}
              </label>
              <select
                value={isolation}
                onChange={(e) => setIsolation(e.target.value)}
                className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none text-xs cursor-pointer"
              >
                <option value="">{lang === 'ar' ? 'لا يوجد عزل طبي (احتياطات قياسية عادية)' : 'No Clinical Isolation (Standard Precautions)'}</option>
                <option value="Contact Precautions">{lang === 'ar' ? 'عزل تلامسي (Contact Precautions)' : 'Contact Precautions'}</option>
                <option value="Droplet Precautions">{lang === 'ar' ? 'عزل رذاذي (Droplet Precautions)' : 'Droplet Precautions'}</option>
                <option value="Airborne Precautions">{lang === 'ar' ? 'عزل هوائي سالب الضغط (Airborne Precautions)' : 'Airborne Precautions'}</option>
                <option value="Protective Isolation">{lang === 'ar' ? 'عزل مناعي وقائي (Protective / Reverse Isolation)' : 'Protective Isolation'}</option>
                <option value="Contact + Airborne Precautions">{lang === 'ar' ? 'عزل تلامسي وهوائي مزدوج (Contact + Airborne)' : 'Contact + Airborne Precautions'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-300 font-semibold block mb-1">
              {lang === 'ar' ? 'ملاحظة القبول السريرية الأولية (اختياري - لن تظهر ملاحظة فارغة)' : 'Initial Admission Clinical Note (Optional - empty will not create any note)'}
            </label>
            <textarea
              value={admissionNoteInput}
              onChange={(e) => setAdmissionNoteInput(e.target.value)}
              placeholder={lang === 'ar' ? 'أدخل ملاحظة القبول الطبية الموثقة هنا...' : 'Type authenticated clinical admission notes here...'}
              rows={3}
              className="w-full bg-[#070c18] border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-teal-500 focus:outline-none text-xs"
            />
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
                  type="text"
                  inputMode="numeric"
                  value={initialMap}
                  onChange={(e) => setInitialMap(toEnglishDigits(e.target.value))}
                  placeholder="65"
                  className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">HR (bpm)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={initialHr}
                  onChange={(e) => setInitialHr(toEnglishDigits(e.target.value))}
                  placeholder="110"
                  className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">SpO₂ (%)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={initialSpo2}
                  onChange={(e) => setInitialSpo2(toEnglishDigits(e.target.value))}
                  placeholder="90"
                  className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">FiO₂ (%)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={initialFio2}
                  onChange={(e) => setInitialFio2(toEnglishDigits(e.target.value))}
                  placeholder="50"
                  className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-2 text-white font-bold text-xs"
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
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 shadow-teal-500/25 active:scale-95 cursor-pointer'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {isSubmitting 
                ? (initialPatient 
                    ? (lang === 'ar' ? 'جاري حفظ التعديلات...' : 'Saving Changes...')
                    : (lang === 'ar' ? 'جاري حجز السرير وإدخال الحالة...' : 'Registering Admission...'))
                : isTargetOccupied
                ? (lang === 'ar' ? 'السرير المحدد مشغول (اختر سريراً شاغراً)' : 'Target Bed is Occupied (Select Vacant Bed)')
                : (initialPatient
                    ? (lang === 'ar' ? 'حفظ التعديلات والتزامن' : 'Save Modifications')
                    : (lang === 'ar' ? 'تأكيد دخول المريض وتنشيط السرير' : 'Confirm & Active ICU Bed'))}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
