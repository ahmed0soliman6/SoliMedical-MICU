import { DEFAULT_SBAR_FIELDS } from "../types/settings.ts";
import { useSystemSettings } from "../services/SettingsContext.tsx";
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Activity, 
  ShieldCheck, 
  Sparkles, 
  Copy, 
  History, 
  Clock, 
  Calendar,
  User, 
  Heart, 
  Wind, 
  Droplet, 
  Brain, 
  Bug, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Check,
  Stethoscope,
  FileCheck2,
  Lock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { 
  BedNumber, 
  StaffRole, 
  CodeStatus, 
  PatientDossier, 
  TelemetryVitals, 
  VentilatorParameters, 
  InfusionPumpLine, 
  FluidBalance24H, 
  StatLabPanel, 
  SbarHandoverReport,
  IcuUser
} from '../types/schema.ts';
import { signSbarHandover, acknowledgeSbarHandover } from '../services/dataModel.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { db } from '../db/icuSyncDb.ts';

interface SbarSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: BedNumber;
  patientId: string;
  patientName?: string;
  primaryDiagnosis?: string;
  codeStatus?: CodeStatus;
  patient?: PatientDossier | null;
  currentVitals?: TelemetryVitals | null;
  currentVentilator?: VentilatorParameters | null;
  currentPumps?: InfusionPumpLine[];
  currentFluidBalance?: FluidBalance24H | null;
  currentLabs?: StatLabPanel[];
  previousHandovers?: SbarHandoverReport[];
  templateSbar?: SbarHandoverReport | null;
  onHandoverSigned: () => void;
}

export const SbarSignModal: React.FC<SbarSignModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patientId,
  patientName = '',
  primaryDiagnosis = '',
  codeStatus = CodeStatus.FULL_CODE,
  patient: initialPatient,
  currentVitals: initialVitals,
  currentVentilator: initialVentilator,
  currentPumps: initialPumps,
  currentFluidBalance: initialFluidBalance,
  currentLabs: initialLabs,
  previousHandovers: initialPreviousHandovers,
  templateSbar,
  onHandoverSigned,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser, allUsers } = useAuth();
  const { settings } = useSystemSettings();

  // Internal fetched states if not supplied via props
  const [patient, setPatient] = useState<PatientDossier | null>(initialPatient || null);
  const [vitals, setVitals] = useState<TelemetryVitals | null>(initialVitals || null);
  const [ventilator, setVentilator] = useState<VentilatorParameters | null>(initialVentilator || null);
  const [pumps, setPumps] = useState<InfusionPumpLine[]>(initialPumps || []);
  const [fluidBalance, setFluidBalance] = useState<FluidBalance24H | null>(initialFluidBalance || null);
  const [labs, setLabs] = useState<StatLabPanel[]>(initialLabs || []);
  const [previousHandovers, setPreviousHandovers] = useState<SbarHandoverReport[]>(initialPreviousHandovers || []);

  // Form states
  const [shiftType, setShiftType] = useState<'NIGHT' | 'DAY'>(() => {
    const hour = new Date().getHours();
    return hour >= 20 || hour < 8 ? 'NIGHT' : 'DAY';
  });
  const [shiftDate, setShiftDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [shiftStartTime, setShiftStartTime] = useState<string>(() => (shiftType === 'NIGHT' ? '20:00' : '08:00'));
  const [shiftEndTime, setShiftEndTime] = useState<string>(() => (shiftType === 'NIGHT' ? '08:00' : '20:00'));

  const [situation, setSituation] = useState<string>('');
  const [background, setBackground] = useState<string>('');
  const [hemodynamics, setHemodynamics] = useState<string>('');
  const [pulmonary, setPulmonary] = useState<string>('');
  const [metabolic, setMetabolic] = useState<string>('');
  const [neurology, setNeurology] = useState<string>('');
  const [infectious, setInfectious] = useState<string>('');
  const [recommendation, setRecommendation] = useState<string>('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  const [outgoingDoctorName, setOutgoingDoctorName] = useState<string>('');
  const [outgoingDoctorRole, setOutgoingDoctorRole] = useState<StaffRole>(StaffRole.SPECIALIST);
  const [outgoingDoctorStaffId, setOutgoingDoctorStaffId] = useState<string>('DOC-101');
  const [incomingDoctorName, setIncomingDoctorName] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAcking, setIsAcking] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'RECEIVE' | 'NEW'>('NEW');
  const [showPreviousDrawer, setShowPreviousDrawer] = useState<boolean>(false);
  const [selectedPrevForCompare, setSelectedPrevForCompare] = useState<SbarHandoverReport | null>(null);

  const configuredFields = settings.sbarFields && settings.sbarFields.length > 0 ? settings.sbarFields : DEFAULT_SBAR_FIELDS;
  const hasField = (id: string) => configuredFields.some(f => f.id === id);
  const standardIds = ['situation', 'background', 'hemodynamics', 'pulmonary', 'metabolic', 'neurology', 'infectious', 'recommendation'];
  const customFieldsConfig = configuredFields.filter(f => !standardIds.includes(f.id));

  // Compute pending unacknowledged handover from previous colleague
  const pendingHandover = useMemo(() => {
    return previousHandovers.find(h => !h.incomingDoctor?.signedAt);
  }, [previousHandovers]);

  // Set modal tab to RECEIVE if there is a pending handover when opening
  useEffect(() => {
    if (isOpen) {
      if (pendingHandover) {
        setModalTab('RECEIVE');
      }
    }
  }, [isOpen, pendingHandover]);

  // Handle shift acknowledgment by incoming doctor
  const handleAcknowledgeShift = async () => {
    if (!pendingHandover) return;
    setIsAcking(true);
    try {
      const docInfo = {
        staffId: currentUser?.badgeId || currentUser?.uid || outgoingDoctorStaffId || 'DOC-INC',
        name: currentUser?.nameAr || currentUser?.nameEn || outgoingDoctorName || (lang === 'ar' ? 'د. الطبيب المستلم' : 'Incoming Physician'),
        role: currentUser?.role || outgoingDoctorRole || StaffRole.SPECIALIST,
      };
      const updated = await acknowledgeSbarHandover(pendingHandover.id, docInfo);
      if (updated) {
        setPreviousHandovers(prev => prev.map(h => h.id === updated.id ? updated : h));
        onHandoverSigned();
        setModalTab('NEW');
      }
    } catch (err) {
      console.error('Error acknowledging SBAR handover:', err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء تأكيد استلام المناوبة.' : 'Error acknowledging shift handover.');
    } finally {
      setIsAcking(false);
    }
  };

  // Quick Recommendation Chips - Limited to max 2 items
  const quickChips = useMemo(() => [
    { labelAr: '+ فطام التنفس الصناعي (SBT)', labelEn: '+ SBT Weaning Trial', text: '• Attempt daily Spontaneous Breathing Trial (SBT) if hemodynamically stable.' },
    { labelAr: '+ تقليل الرافعات الوعائية (Pressor Wean)', labelEn: '+ Vasopressor Wean', text: '• Titrate and wean Norepinephrine targeting MAP > 65 mmHg.' },
  ], []);

  // Fetch full clinical data if missing
  useEffect(() => {
    if (!isOpen) return;

    const fetchLiveClinicalData = async () => {
      try {
        let p = initialPatient;
        if (!p && patientId) {
          p = await db.patients.get(patientId) || null;
          setPatient(p);
        }

        if (!initialVitals && patientId) {
          const v = await db.vitals.where('patientId').equals(patientId).reverse().first();
          if (v) setVitals(v);
        }

        if (!initialVentilator && bedNumber) {
          const vent = await db.ventilators.where('bedNumber').equals(bedNumber).first();
          if (vent) setVentilator(vent);
        }

        if ((!initialPumps || initialPumps.length === 0) && patientId) {
          const pList = await db.infusionPumps.where('patientId').equals(patientId).toArray();
          setPumps(pList.filter(item => item.status === 'RUNNING' || item.status === 'STANDBY'));
        }

        if (!initialFluidBalance && patientId) {
          const fb = await db.fluidBalances.where('patientId').equals(patientId).reverse().first();
          if (fb) setFluidBalance(fb);
        }

        if ((!initialLabs || initialLabs.length === 0) && patientId) {
          const lList = await db.statLabs.where('patientId').equals(patientId).toArray();
          setLabs(lList);
        }

        if ((!initialPreviousHandovers || initialPreviousHandovers.length === 0) && patientId) {
          const sList = await db.sbarHandovers.where('patientId').equals(patientId).reverse().sortBy('shiftDate');
          setPreviousHandovers(sList);
          if (sList.length > 0) {
            setSelectedPrevForCompare(sList[0]);
          }
        } else if (initialPreviousHandovers && initialPreviousHandovers.length > 0) {
          setSelectedPrevForCompare(initialPreviousHandovers[0]);
        }
      } catch (err) {
        console.warn('Could not query auxiliary clinical data for SBAR:', err);
      }
    };

    fetchLiveClinicalData();
  }, [isOpen, patientId, bedNumber, initialPatient, initialVitals, initialVentilator, initialPumps, initialFluidBalance, initialLabs, initialPreviousHandovers]);

  // Set outgoing doctor default from logged-in user
  useEffect(() => {
    if (currentUser) {
      setOutgoingDoctorName(currentUser.nameEn || currentUser.nameAr || 'Dr. On Duty');
      setOutgoingDoctorRole(currentUser.role || StaffRole.SPECIALIST);
      setOutgoingDoctorStaffId(currentUser.badgeId || currentUser.uid || 'DOC-101');
    } else {
      setOutgoingDoctorName('Dr. On Duty');
      setOutgoingDoctorRole(StaffRole.SPECIALIST);
      setOutgoingDoctorStaffId('DOC-101');
    }
  }, [currentUser]);

  // Dynamic recognition & clinical synthesis function (strictly from real session inputs)
  const autoSynthesizeSbar = (
    targetPatient: PatientDossier | null,
    targetVitals: TelemetryVitals | null,
    targetVent: VentilatorParameters | null,
    targetPumps: InfusionPumpLine[],
    targetFluid: FluidBalance24H | null,
    targetLabs: StatLabPanel[]
  ) => {
    const pName = targetPatient?.fullNameAr || targetPatient?.fullNameEn || patientName || (lang === 'ar' ? `مريض سرير ${bedNumber}` : `Patient Bed ${bedNumber}`);
    const pDiag = targetPatient?.primaryDiagnosisAr || targetPatient?.primaryDiagnosisEn || primaryDiagnosis || '';
    const pMrn = targetPatient?.mrn || '';
    const pAge = targetPatient?.age ? `${targetPatient.age} ${lang === 'ar' ? 'سنة' : 'y'}` : '';
    const pCode = targetPatient?.codeStatus || codeStatus || 'FULL_CODE';

    // Calculate ICU Day
    let icuDay = '1';
    if (targetPatient?.admissionDate) {
      const admitTime = new Date(targetPatient.admissionDate).getTime();
      const diffDays = Math.max(1, Math.ceil((Date.now() - admitTime) / (1000 * 60 * 60 * 24)));
      icuDay = String(diffDays);
    }

    // Active infusions from current session
    const pressorPumps = (targetPumps || []).filter(p => {
      const dName = (p?.drugNameEn || p?.drugNameAr || '').toLowerCase();
      return (
        dName.includes('norepinephrine') ||
        dName.includes('norad') ||
        dName.includes('vasopressin') ||
        dName.includes('epinephrine') ||
        dName.includes('dobutamine') ||
        dName.includes('dopamine')
      );
    });
    const sedativePumps = (targetPumps || []).filter(p => {
      const dName = (p?.drugNameEn || p?.drugNameAr || '').toLowerCase();
      return (
        dName.includes('propofol') ||
        dName.includes('fentanyl') ||
        dName.includes('midazolam') ||
        dName.includes('dexmedetomidine') ||
        dName.includes('precedex') ||
        dName.includes('remifentanil')
      );
    });

    const pressorSummary = pressorPumps.length > 0 
      ? pressorPumps.map(p => `${p.drugNameAr || p.drugNameEn} @ ${p.flowRateMlPerHour} mL/h`).join(', ')
      : (lang === 'ar' ? 'بدون رافعات ضغط مستمرة' : 'No continuous vasopressors');

    const sedativeSummary = sedativePumps.length > 0
      ? sedativePumps.map(p => `${p.drugNameAr || p.drugNameEn} @ ${p.flowRateMlPerHour} mL/h`).join(', ')
      : (lang === 'ar' ? 'بدون مهدئات مستمرة' : 'No continuous sedatives');

    // Airway / Vent state
    let airwayStatus = lang === 'ar' ? 'تنفس طبيعي' : 'Room Air';
    if (targetVent && targetVent.mode) {
      airwayStatus = `${lang === 'ar' ? 'جهاز تنفس صناعي' : 'Mechanical Vent'} [${targetVent.mode}, FiO2: ${targetVent.fio2Percent}%, PEEP: ${targetVent.peepCmH2O}]`;
    } else if (targetVitals?.fio2SuppliedPercent && targetVitals.fio2SuppliedPercent > 21) {
      airwayStatus = `${lang === 'ar' ? 'أكسجين إضافي' : 'Oxygen'} (${targetVitals.fio2SuppliedPercent}% FiO2)`;
    }

    // 1. Situation (S)
    const sitText = `${lang === 'ar' ? `سرير ${bedNumber}` : `Bed ${bedNumber}`} | ${pName} ${pMrn ? `(${pMrn})` : ''} ${pAge ? `| ${pAge}` : ''}. ${pDiag ? `${lang === 'ar' ? 'التشخيص:' : 'Diag:'} ${pDiag}.` : ''} ${lang === 'ar' ? 'يوم العناية:' : 'ICU Day:'} ${icuDay}. ${lang === 'ar' ? 'حالة الإنعاش:' : 'Code:'} ${pCode}. ${lang === 'ar' ? 'التنفس:' : 'Airway:'} ${airwayStatus}.`.trim();

    // 2. Background (B)
    const chronics = targetPatient?.chronicDiseases || targetPatient?.history || '';
    const allergiesText = targetPatient?.allergies && targetPatient.allergies.length > 0
      ? targetPatient.allergies.map(a => a.allergen).join(', ')
      : '';

    const bgText = `${lang === 'ar' ? 'تاريخ الدخول:' : 'Admit:'} ${targetPatient?.admissionDate ? targetPatient.admissionDate.split('T')[0] : (lang === 'ar' ? 'الجلسة الحالية' : 'Current Session')}. ${pDiag ? `${lang === 'ar' ? 'سبب الدخول:' : 'Reason:'} ${pDiag}.` : ''} ${chronics ? `${lang === 'ar' ? 'الأمراض المزمنة:' : 'History:'} ${chronics}.` : ''} ${allergiesText ? `${lang === 'ar' ? 'الحساسية:' : 'Allergies:'} ${allergiesText}.` : ''}`.trim();

    // 3. Assessment (A) - Hemodynamics
    let hemoText = '';
    if (targetVitals) {
      const bp = (targetVitals.systolicBpMmHg && targetVitals.diastolicBpMmHg) ? `${targetVitals.systolicBpMmHg}/${targetVitals.diastolicBpMmHg}` : '';
      const map = targetVitals.meanArterialPressureMmHg ? `MAP: ${targetVitals.meanArterialPressureMmHg} mmHg` : '';
      const hr = targetVitals.heartRateBpm ? `HR: ${targetVitals.heartRateBpm} bpm` : '';
      hemoText = `${bp ? `${lang === 'ar' ? 'الضغط:' : 'BP:'} ${bp}` : ''} ${map ? `(${map})` : ''} ${hr ? `| ${hr}` : ''}. ${lang === 'ar' ? 'المضخات:' : 'Pumps:'} ${pressorSummary}.`.trim();
    } else {
      hemoText = `${lang === 'ar' ? 'المضخات الحالية:' : 'Pumps:'} ${pressorSummary}.`;
    }

    // Assessment (A) - Pulmonary
    let pulmText = '';
    const latestAbg = targetLabs?.[0]?.abg;
    const pfStr = latestAbg?.pao2Fio2Ratio ? `P/F: ${latestAbg.pao2Fio2Ratio}` : '';
    if (targetVent) {
      pulmText = `${targetVent.mode} | FiO2: ${targetVent.fio2Percent}% | PEEP: ${targetVent.peepCmH2O} cmH2O | Vt: ${targetVent.tidalVolumeMl} mL. ${targetVitals?.spo2Percent ? `SpO2: ${targetVitals.spo2Percent}%` : ''} ${pfStr}`.trim();
    } else if (targetVitals) {
      pulmText = `SpO2: ${targetVitals.spo2Percent ?? '--'}% ${targetVitals.fio2SuppliedPercent ? `(${targetVitals.fio2SuppliedPercent}% FiO2)` : ''}. ${pfStr}`.trim();
    } else {
      pulmText = lang === 'ar' ? 'متابعة وظائف التنفس حسب الخطة.' : 'Pulmonary function as per protocol.';
    }

    // Assessment (A) - Metabolic, Renal, Fluid
    let metaText = '';
    if (targetFluid) {
      const inVal = targetFluid.intakeBreakdown?.totalIntakeMl ?? 0;
      const outVal = targetFluid.outputBreakdown?.totalOutputMl ?? 0;
      const netVal = targetFluid.netCumulativeBalanceMl ?? (inVal - outVal);
      const urineVal = targetFluid.outputBreakdown?.urineOutputMl ?? 0;
      metaText = `${lang === 'ar' ? 'توازن السوائل:' : 'Fluid I/O:'} ${lang === 'ar' ? 'مدخلات' : 'In'} ${inVal}mL, ${lang === 'ar' ? 'مخرجات' : 'Out'} ${outVal}mL (${lang === 'ar' ? 'الصافي' : 'Net'}: ${netVal > 0 ? `+${netVal}` : netVal}mL). ${lang === 'ar' ? 'البول:' : 'Urine:'} ${urineVal}mL.`.trim();
    } else {
      metaText = lang === 'ar' ? 'متابعة وظائف الكلى وإدرار البول.' : 'Renal output monitored.';
    }

    // Assessment (A) - Neurology & Sedation
    const gcs = targetVitals?.gcsTotalScore ? `GCS: ${targetVitals.gcsTotalScore}/15` : 'GCS: --';
    const neuroText = `${gcs}. ${lang === 'ar' ? 'المهدئات:' : 'Sedation:'} ${sedativeSummary}.`;

    // Assessment (A) - Infectious & Antibiotics
    const temp = targetVitals?.coreTemperatureCelsius ? `${lang === 'ar' ? 'الحرارة:' : 'Temp:'} ${targetVitals.coreTemperatureCelsius}°C` : '';
    const infectText = `${temp} ${lang === 'ar' ? 'متابعة العلامات الالتهابية والمضادات الحيوية.' : 'Antimicrobial coverage monitored.'}`.trim();

    // 4. Recommendation (R) - Maximum 2 recommendations strictly!
    const rec1 = pressorPumps.length > 0 
      ? (lang === 'ar' 
          ? `1. الدورة الدموية: استمرار تقليل الرافعات الوعائية (${pressorPumps.map(p => p.drugNameAr || p.drugNameEn).join('/')}) مع الحفاظ على MAP > 65 mmHg.` 
          : `1. Hemodynamics: Wean ${pressorPumps.map(p => p.drugNameEn).join('/')} targeting MAP > 65 mmHg.`)
      : (lang === 'ar'
          ? `1. الدورة الدموية: استقرار العلامات الحيوية والحفاظ على الضغط الشرياني الوسطي MAP > 65 mmHg.`
          : `1. Hemodynamics: Maintain hemodynamics targeting MAP > 65 mmHg.`);

    const rec2 = targetVent 
      ? (lang === 'ar'
          ? `2. التنفس: إجراء تجربة فطام التنفس الصناعي (SBT) وتقييم الجاهزية لنزع الأنبوب الرغامي.`
          : `2. Pulmonary: Daily Spontaneous Breathing Trial (SBT) & evaluate weaning readiness.`)
      : (lang === 'ar'
          ? `2. المتابعة: إعادة الفحوصات وغازات الدم الشريانية ABG عند الساعة 06:00.`
          : `2. Diagnostics: Repeat morning ABG and serum electrolytes at 06:00.`);

    const recList = [rec1, rec2]; // Strict max 2 recommendations

    setSituation(sitText);
    setBackground(bgText);
    setHemodynamics(hemoText);
    setPulmonary(pulmText);
    setMetabolic(metaText);
    setNeurology(neuroText);
    setInfectious(infectText);
    setRecommendation(recList.join('\n'));
  };

  // Populate from template if provided, or leave boxes EMPTY by default
  useEffect(() => {
    if (!isOpen) return;

    if (templateSbar) {
      setShiftType(templateSbar.shiftType === 'NIGHT' ? 'DAY' : 'NIGHT'); // Advance to next shift
      setSituation(templateSbar.situation || '');
      setBackground(templateSbar.background || '');
      setHemodynamics(templateSbar.assessment?.hemodynamics || '');
      setPulmonary(templateSbar.assessment?.pulmonaryAndAirway || '');
      setMetabolic(templateSbar.assessment?.metabolicAndRenal || '');
      setNeurology(templateSbar.assessment?.neurologyAndSedation || '');
      setInfectious(templateSbar.assessment?.infectiousDiseaseAndAntibiotics || '');
      setRecommendation(templateSbar.recommendationAndOrders?.join('\n') || '');
    } else {
      // Leave boxes EMPTY initially as requested
      setSituation('');
      setBackground('');
      setHemodynamics('');
      setPulmonary('');
      setMetabolic('');
      setNeurology('');
      setInfectious('');
      setRecommendation('');
    }
  }, [isOpen, templateSbar]);

  if (!isOpen) return null;

  const handleCopyFromPrevious = (prev: SbarHandoverReport) => {
    setSituation(prev.situation || '');
    setBackground(prev.background || '');
    setHemodynamics(prev.assessment?.hemodynamics || '');
    setPulmonary(prev.assessment?.pulmonaryAndAirway || '');
    setMetabolic(prev.assessment?.metabolicAndRenal || '');
    setNeurology(prev.assessment?.neurologyAndSedation || '');
    setInfectious(prev.assessment?.infectiousDiseaseAndAntibiotics || '');
    setRecommendation(prev.recommendationAndOrders?.join('\n') || '');
    setShowPreviousDrawer(false);
  };

  const handleAddQuickChip = (chipText: string) => {
    setRecommendation((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return chipText;
      if (trimmed.includes(chipText)) return trimmed;
      return `${trimmed}\n${chipText}`;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signSbarHandover({
        bedId: bedNumber,
        patientId,
        shiftType,
        shiftDate,
        shiftStartTime,
        shiftEndTime,
        situation: situation.trim(),
        background: background.trim(),
        assessment: {
          hemodynamics: hemodynamics.trim(),
          pulmonaryAndAirway: pulmonary.trim(),
          metabolicAndRenal: metabolic.trim(),
          neurologyAndSedation: neurology.trim() || 'GCS 15/15, Pupils equal and reactive',
          infectiousDiseaseAndAntibiotics: infectious.trim() || 'Afebrile, antimicrobials as prescribed',
        },
        recommendationAndOrders: recommendation
          .split('\n')
          .map(r => r.trim())
          .filter(r => r.length > 0),
        customFields: customFieldValues,
        outgoingDoctor: {
          staffId: currentUser?.badgeId || currentUser?.uid || outgoingDoctorStaffId || 'DOC-101',
          name: currentUser?.nameAr || currentUser?.nameEn || outgoingDoctorName.trim() || (lang === 'ar' ? 'د. الطبيب المعالج' : 'Attending Physician'),
          role: currentUser?.role || outgoingDoctorRole || StaffRole.SPECIALIST,
        },
        incomingDoctor: incomingDoctorName.trim() ? {
          staffId: 'DOC-INCOMING',
          name: incomingDoctorName.trim(),
          role: StaffRole.RESIDENT,
        } : undefined,
      });

      onHandoverSigned();
      onClose();
    } catch (err) {
      console.error(err);
      alert(lang === 'ar' ? 'حدث خطأ أثناء اعتماد وتسجيل تسليم المناوبة.' : 'Error signing SBAR handover.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#091122] w-screen h-screen overflow-hidden animate-in fade-in duration-200" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full h-full bg-[#091122] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-[#060b17] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? 'استلام مناوبة SBAR' : 'SBAR Shift Handover'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-300 font-mono w-full truncate">
              {patientName || (patient?.fullNameAr || patient?.fullNameEn)} • {lang === 'ar' ? `سرير ${bedNumber}` : `Bed ${bedNumber}`}
            </p>

            {modalTab !== 'RECEIVE' && (
              <button
                type="button"
                onClick={() => autoSynthesizeSbar(patient, vitals, ventilator, pumps, fluidBalance, labs)}
                className="w-full mt-1.5 px-3 py-1 rounded-md bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer hover:bg-teal-500/20"
                title={lang === 'ar' ? 'التعرف التلقائي' : 'Auto-fill'}
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>{lang === 'ar' ? 'توليد ذكي من بيانات السرير' : 'Auto-Fill from Live Vitals'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Copy from Previous Handover Button */}
            {previousHandovers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPreviousDrawer(!showPreviousDrawer)}
                className="px-3 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 border border-blue-800 text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {lang === 'ar' 
                    ? `مقارنة / نسخ من السابق (${previousHandovers.length})` 
                    : `Previous Handovers (${previousHandovers.length})`}
                </span>
                {showPreviousDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-750"
              title={lang === 'ar' ? 'إغلاق التسليم' : 'Close Handover'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Switch Tabs - Only show when NOT in RECEIVE mode */}
        {modalTab !== 'RECEIVE' && (
          <div className="bg-[#050b18] px-5 py-2.5 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setModalTab('RECEIVE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                modalTab === 'RECEIVE'
                  ? 'bg-amber-500 text-slate-950 shadow-lg font-black shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {lang === 'ar' 
                  ? `استلام ومراجعة المناوبة ${pendingHandover ? `(${pendingHandover.shiftType === 'NIGHT' ? 'الليلية' : 'الصباحية'})` : ''}` 
                  : `Review & Receive Shift ${pendingHandover ? `(${pendingHandover.shiftType})` : ''}`}
              </span>
              {pendingHandover ? (
                <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 text-[10px] font-black font-mono shadow border border-amber-400/40 animate-pulse">
                  {lang === 'ar' ? 'غير مَستَلَم' : 'Pending'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold font-mono border border-emerald-800">
                  {lang === 'ar' ? 'تم الاستلام' : 'Received'}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setModalTab('NEW')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                modalTab === 'NEW'
                  ? 'bg-teal-500 text-slate-950 shadow-lg font-black shadow-teal-500/20'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'توثيق وتسليم مناوبة جديدة' : 'Create New Shift Handover'}</span>
              {pendingHandover && (
                <Lock className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>
          </div>
        )}

        {/* Previous Handover Reference Drawer */}
        {showPreviousDrawer && previousHandovers.length > 0 && (
          <div className="bg-[#050b18] border-b border-blue-900/60 p-3.5 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-300">
                <History className="w-4 h-4 text-blue-400" />
                <span>{lang === 'ar' ? 'سجلات التسليم السابقة لهذا المريض:' : 'Historical Handovers for this Patient:'}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {previousHandovers.map((prev, idx) => (
                  <button
                    key={prev.id || idx}
                    type="button"
                    onClick={() => setSelectedPrevForCompare(prev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      selectedPrevForCompare?.id === prev.id
                        ? 'bg-blue-600 text-white font-bold shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {prev.shiftDate} ({prev.shiftType}) - {prev.outgoingDoctor.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedPrevForCompare && (
              <div className="bg-[#091122] border border-blue-950 p-3 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="font-bold text-teal-400 font-mono">{selectedPrevForCompare.shiftType} SHIFT</span>
                    <span>•</span>
                    <span className="text-slate-400 font-mono">{selectedPrevForCompare.shiftDate} ({selectedPrevForCompare.shiftStartTime} - {selectedPrevForCompare.shiftEndTime})</span>
                    <span>•</span>
                    <span className="text-slate-200">{lang === 'ar' ? 'المُسلّم:' : 'By:'} <strong>{selectedPrevForCompare.outgoingDoctor.name}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyFromPrevious(selectedPrevForCompare)}
                    className="px-3 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95 shadow"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'نسخ هذا التقرير وتطبيقه في الحقول' : 'Copy and Populate into Form'}</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="bg-[#050b18] p-2 rounded border border-slate-800">
                    <strong className="text-teal-400">S: </strong>{selectedPrevForCompare.situation}
                  </div>
                  <div className="bg-[#050b18] p-2 rounded border border-slate-800">
                    <strong className="text-cyan-400">B: </strong>{selectedPrevForCompare.background}
                  </div>
                  <div className="bg-[#050b18] p-2 rounded border border-slate-800">
                    <strong className="text-amber-400">A: </strong>{selectedPrevForCompare.assessment?.hemodynamics} | {selectedPrevForCompare.assessment?.pulmonaryAndAirway}
                  </div>
                  <div className="bg-[#050b18] p-2 rounded border border-slate-800">
                    <strong className="text-emerald-400">R: </strong>{selectedPrevForCompare.recommendationAndOrders?.join(' • ')}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Body Content based on active tab */}
        {modalTab === 'RECEIVE' ? (
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
            {pendingHandover ? (
              <div className="space-y-4">
                {/* Banner */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/90 via-amber-900/40 to-[#070c18] border border-amber-500/50 shadow-md">
                  <div className="flex items-start gap-2.5">
                    <span className="w-7 h-7 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    </span>
                    <div className="flex flex-col gap-1 w-full">
                      {/* Row 1: Shift type & Doctor */}
                      <h4 className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-2 flex-wrap">
                        <span>
                          {lang === 'ar' 
                            ? (pendingHandover.shiftType === 'NIGHT' ? 'تسليم مسائي' : 'تسليم صباحي') 
                            : `${pendingHandover.shiftType === 'NIGHT' ? 'Night' : 'Day'} Shift`}
                        </span>
                        <span className="text-amber-500/50">|</span>
                        <span className="text-amber-100/90 text-xs sm:text-sm">
                          {lang === 'ar' ? `د. ${pendingHandover.outgoingDoctor.name}` : `Dr. ${pendingHandover.outgoingDoctor.name}`}
                        </span>
                      </h4>
                      {/* Row 2: Date & Time (Foldable) */}
                      <details className="text-xs font-mono text-amber-200/80 cursor-pointer">
                        <summary className="outline-none">
                          {lang === 'ar' ? 'عرض تفاصيل المناوبة' : 'Show shift details'}
                        </summary>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3.5 h-3.5 opacity-70" />
                          <span>{pendingHandover.shiftDate}</span>
                          <span className="text-amber-500/50 mx-1">|</span>
                          <Clock className="w-3.5 h-3.5 opacity-70" />
                          <span>{pendingHandover.shiftStartTime} - {pendingHandover.shiftEndTime}</span>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>

                {/* Structured SBAR Card Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Situation */}
                  <div className="bg-[#060c1a] border border-teal-500/30 p-4 rounded-xl space-y-1.5 shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-extrabold text-teal-300 text-xs flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-teal-500/20 text-teal-300 flex items-center justify-center font-mono text-[10px]">S</span>
                        <span>{lang === 'ar' ? 'الوضع السريري الحالي (Situation)' : 'Current Situation'}</span>
                      </span>
                    </div>
                    <p className="text-slate-200 leading-relaxed text-xs pt-1 whitespace-pre-wrap">
                      {pendingHandover.situation}
                    </p>
                  </div>

                  {/* Background */}
                  <div className="bg-[#060c1a] border border-cyan-500/30 p-4 rounded-xl space-y-1.5 shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-extrabold text-cyan-300 text-xs flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-mono text-[10px]">B</span>
                        <span>{lang === 'ar' ? 'الخلفية المرضية والتاريخ (Background)' : 'Medical Background'}</span>
                      </span>
                    </div>
                    <p className="text-slate-200 leading-relaxed text-xs pt-1 whitespace-pre-wrap">
                      {pendingHandover.background}
                    </p>
                  </div>

                  {/* Assessment */}
                  <div className="bg-[#060c1a] border border-amber-500/30 p-4 rounded-xl space-y-2.5 shadow-md md:col-span-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-extrabold text-amber-300 text-xs flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center font-mono text-[10px]">A</span>
                        <span>{lang === 'ar' ? 'التقييم الشامل للأجهزة الحيوية (Assessment)' : 'Clinical Assessment'}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-[#040813] p-3 rounded-lg border border-slate-800">
                        <span className="font-bold text-teal-400 block mb-0.5">{lang === 'ar' ? 'الدورة الدموية والضغط:' : 'Hemodynamics:'}</span>
                        <span className="text-slate-200">{pendingHandover.assessment?.hemodynamics || '—'}</span>
                      </div>
                      <div className="bg-[#040813] p-3 rounded-lg border border-slate-800">
                        <span className="font-bold text-cyan-400 block mb-0.5">{lang === 'ar' ? 'التنفس والأنبوب والرئة:' : 'Pulmonary & Airway:'}</span>
                        <span className="text-slate-200">{pendingHandover.assessment?.pulmonaryAndAirway || '—'}</span>
                      </div>
                      <div className="bg-[#040813] p-3 rounded-lg border border-slate-800">
                        <span className="font-bold text-amber-400 block mb-0.5">{lang === 'ar' ? 'الكلى والميزان والتمريض:' : 'Metabolic & Renal:'}</span>
                        <span className="text-slate-200">{pendingHandover.assessment?.metabolicAndRenal || '—'}</span>
                      </div>
                      <div className="bg-[#040813] p-3 rounded-lg border border-slate-800">
                        <span className="font-bold text-indigo-400 block mb-0.5">{lang === 'ar' ? 'الأعصاب والمهدئات (Neurology):' : 'Neurology & Sedation:'}</span>
                        <span className="text-slate-200">{pendingHandover.assessment?.neurologyAndSedation || '—'}</span>
                      </div>
                      <div className="bg-[#040813] p-3 rounded-lg border border-slate-800 sm:col-span-2">
                        <span className="font-bold text-rose-400 block mb-0.5">{lang === 'ar' ? 'المضادات الحيوية والعدوى:' : 'Infectious & Antibiotics:'}</span>
                        <span className="text-slate-200">{pendingHandover.assessment?.infectiousDiseaseAndAntibiotics || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-[#060c1a] border border-emerald-500/30 p-4 rounded-xl space-y-2 shadow-md md:col-span-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-extrabold text-emerald-300 text-xs flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-mono text-[10px]">R</span>
                        <span>{lang === 'ar' ? 'التوصيات والأوامر الطبيّة (Recommendations & Orders)' : 'Recommendations'}</span>
                      </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-slate-200 pt-1">
                      {(pendingHandover.recommendationAndOrders || []).map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Accept / Acknowledge Shift Button */}
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleAcknowledgeShift}
                    disabled={isAcking}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-teal-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-2xl shadow-amber-500/20 transition-all cursor-pointer active:scale-98 border-2 border-amber-300"
                  >
                    <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                    <span>
                      {isAcking 
                        ? (lang === 'ar' ? 'جاري توثيق الاستلام...' : 'Acknowledging...') 
                        : (lang === 'ar' ? 'تم استلام المناوبة وتأكيد المراجعة السريرية' : 'Acknowledge & Confirm Shift Handover')}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* If no pending handover, show all clear notice */
              <div className="py-12 text-center text-slate-400 space-y-3 bg-[#060c1a] rounded-2xl border border-slate-800 p-8 my-auto">
                <FileCheck2 className="w-14 h-14 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'تم استلام جميع تسليمات المناوبات لهَذا المريض.' : 'All Shift Handovers Are Acknowledged'}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {lang === 'ar' 
                    ? 'لا يوجد تسليم معلق بحاجة لاستلام حالياً. يمكنك الآن التبديل لتبويب توثيق مناوبة جديدة لتسليم المريض لزميلك التالي.'
                    : 'No pending handovers require receipt. You can proceed to create a new shift handover.'}
                </p>
                <button
                  type="button"
                  onClick={() => setModalTab('NEW')}
                  className="mt-3 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs cursor-pointer shadow-md inline-flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 text-slate-950" />
                  <span>{lang === 'ar' ? 'الانتقال لتوثيق تسليم مناوبة جديدة' : 'Go to Create New Handover'}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Main Form Body for New Handover */
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* Warning Banner if pending handover exists */}
            {pendingHandover && (
              <div className="p-3.5 rounded-xl bg-amber-950/90 border border-amber-600/80 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <strong className="block font-bold text-amber-300">
                      {lang === 'ar' ? 'يوجد تقرير تسليم مناوبة سابق غير مَستَلَم' : 'Pending Unacknowledged Handover'}
                    </strong>
                    <p className="text-[11px] text-amber-200/90 mt-0.5">
                      {lang === 'ar' 
                        ? 'يلزمك أولاً الانتقال لتبويب "استلام ومراجعة المناوبة" والضغط على زر "تم استلام المناوبة" لمراجعة بيانات زميلك السابق قبل أن تتمكن من توثيق وتسليم مناوبة جديدة.'
                        : 'You must first switch to "Review & Receive Shift" tab and click "Acknowledge Shift" before submitting a new handover.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalTab('RECEIVE')}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shrink-0 cursor-pointer hover:bg-amber-400 transition-all shadow"
                >
                  {lang === 'ar' ? 'انتقال للاستلام' : 'Go to Receive'}
                </button>
              </div>
            )}

            {/* Shift Metadata Row */}
          <div className="p-3.5 rounded-xl bg-[#060b17] border border-slate-800 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              {/* Shift Type */}
              <div>
                <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                  {lang === 'ar' ? 'نوع المناوبة (Shift Type)' : 'Shift Type'}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'NIGHT', label: lang === 'ar' ? 'ليلية (Night)' : 'Night' },
                    { id: 'DAY', label: lang === 'ar' ? 'صباحية (Day)' : 'Day' },
                  ].map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setShiftType(s.id as any);
                        setShiftStartTime(s.id === 'NIGHT' ? '20:00' : '08:00');
                        setShiftEndTime(s.id === 'NIGHT' ? '08:00' : '20:00');
                      }}
                      className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        shiftType === s.id
                          ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date with Calendar picker */}
              <div>
                <label className="block text-[11px] text-slate-300 font-semibold mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <span>{lang === 'ar' ? 'تاريخ المناوبة' : 'Shift Date'}</span>
                  </span>
                  {shiftDate === new Date().toISOString().split('T')[0] && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-950 text-teal-300 border border-teal-800 font-bold">
                      {lang === 'ar' ? 'اليوم الحالي' : 'Today'}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  onClick={(e) => (e.target as any).showPicker?.()}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-teal-500 focus:outline-none cursor-pointer"
                  required
                />
              </div>

              {/* Shift Times Group (Start & End in one row) */}
              <div className="grid grid-cols-2 gap-2">
                {/* Shift Start Time with Clock picker */}
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{lang === 'ar' ? 'بداية المناوبة' : 'Start Time'}</span>
                  </label>
                  <input
                    type="time"
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-teal-500 focus:outline-none text-center cursor-pointer"
                    required
                  />
                </div>

                {/* Shift End Time with Clock picker */}
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'ar' ? 'نهاية المناوبة' : 'End Time'}</span>
                  </label>
                  <input
                    type="time"
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    onClick={(e) => (e.target as any).showPicker?.()}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-teal-500 focus:outline-none text-center cursor-pointer"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {hasField("situation") && ( 
            <div className="bg-[#060b17] p-3.5 rounded-xl border border-teal-900/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-teal-400 font-bold font-mono text-xs">
                  <span className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-xs font-black">S</span>
                  <span>{lang === 'ar' ? 'Situation (الموقف الحالي، السرير والتشخيص والمسار)' : 'S - Situation (Patient, Bed, Diagnosis & Active State)'}</span>
                </div>
                <span className="text-[10px] text-teal-400/80 font-mono">
                  {lang === 'ar' ? 'تم التوليد التلقائي' : 'Auto-recognized'}
                </span>
              </div>
              <textarea
                rows={2}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                className="w-full bg-[#0b1428] border border-slate-700/80 rounded-lg p-2.5 text-white text-xs leading-relaxed focus:border-teal-400 focus:outline-none font-sans"
                required
              />
            </div>
          )}

          {/* 2. B - BACKGROUND (الخلفية المرضية ومسار الدخول) */}
          {hasField("background") && (
            <div className="bg-[#060b17] p-3.5 rounded-xl border border-cyan-900/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold font-mono text-xs">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-xs font-black">B</span>
                  <span>{lang === 'ar' ? 'Background (الخلفية المرضية، الأمراض المزمنة، الحساسية والقساطر)' : 'B - Background (History, Allergies, Lines & Clinical Timeline)'}</span>
                </div>
                <span className="text-[10px] text-cyan-400/80 font-mono">
                  {lang === 'ar' ? 'تم التعرف التلقائي' : 'Auto-recognized'}
                </span>
              </div>
              <textarea
                rows={2}
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                className="w-full bg-[#0b1428] border border-slate-700/80 rounded-lg p-2.5 text-white text-xs leading-relaxed focus:border-cyan-400 focus:outline-none font-sans"
                required
              />
            </div>
          )}

          {/* 3. A - ASSESSMENT (التقييم السريري الشامل للأجهزة الحيوية) */}
          <div className="bg-[#060b17] p-3.5 rounded-xl border border-amber-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold font-mono text-xs">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xs font-black">A</span>
                <span>{lang === 'ar' ? 'Assessment (التقييم السريري للأجهزة، المونيتور، التنفس، وسوائل 24 ساعة)' : 'A - Assessment (Hemodynamics, Ventilation, Metabolic, Renal & I/O)'}</span>
              </div>
              <span className="text-[10px] text-amber-400/80 font-mono">
                {lang === 'ar' ? 'تم استخراج كافة القراءات والمضخات' : 'Extracted from telemetry & pumps'}
              </span>
            </div>

            <div className="space-y-2">
              {/* Hemodynamics */}
              {hasField("hemodynamics") && (
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-red-300 mb-1">
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    <span>{lang === 'ar' ? 'الدورة الدموية، الضغط والمضخات (Hemodynamics & Pressors):' : 'Hemodynamics & Inotropes:'}</span>
                  </label>
                  <input
                    type="text"
                    value={hemodynamics}
                    onChange={(e) => setHemodynamics(e.target.value)}
                    className="w-full bg-[#0b1428] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:border-red-400 focus:outline-none"
                    required
                  />
                </div>
              )}

              {/* Pulmonary */}
              {hasField("pulmonary") && (
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300 mb-1">
                    <Wind className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{lang === 'ar' ? 'التنفس، جهاز التنفس الصناعي والغازات (Pulmonary, Vent & Mechanics):' : 'Pulmonary & Ventilation:'}</span>
                  </label>
                  <input
                    type="text"
                    value={pulmonary}
                    onChange={(e) => setPulmonary(e.target.value)}
                    className="w-full bg-[#0b1428] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:border-cyan-400 focus:outline-none"
                    required
                  />
                </div>
              )}

              {/* Metabolic & Renal */}
              {hasField("metabolic") && (
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 mb-1">
                    <Droplet className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'ar' ? 'الكلى، ميزان السوائل 24 ساعة ونقل الدم (Renal, 24H Fluid Balance & MTP):' : 'Renal, Fluid Balance & Transfusion:'}</span>
                  </label>
                  <input
                    type="text"
                    value={metabolic}
                    onChange={(e) => setMetabolic(e.target.value)}
                    className="w-full bg-[#0b1428] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:border-amber-400 focus:outline-none"
                    required
                  />
                </div>
              )}

              {/* Neurology & Infectious (2-col) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hasField("neurology") && (
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 mb-1">
                      <Brain className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{lang === 'ar' ? 'الجهاز العصبي والمهدئات (Neurology/Sedation):' : 'Neurology & Sedation:'}</span>
                    </label>
                    <input
                      type="text"
                      value={neurology}
                      onChange={(e) => setNeurology(e.target.value)}
                      className="w-full bg-[#0b1428] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:border-indigo-400 focus:outline-none"
                    />
                  </div>
                )}

                {hasField("infectious") && (
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 mb-1">
                      <Bug className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{lang === 'ar' ? 'الحرارة والمضادات الحيوية (Infectious/Antibiotics):' : 'Infection & Antimicrobials:'}</span>
                    </label>
                    <input
                      type="text"
                      value={infectious}
                      onChange={(e) => setInfectious(e.target.value)}
                      className="w-full bg-[#0b1428] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:border-emerald-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. R - RECOMMENDATION & ORDERS (التوصيات والخطة العلاجية) */}
          {hasField("recommendation") && (
          <div className="bg-[#060b17] p-3.5 rounded-xl border border-emerald-900/60 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold font-mono text-xs">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs font-black">R</span>
                <span>{lang === 'ar' ? 'Recommendation (الخطة العلاجية، الفطام، الأوامر والتوجيهات)' : 'R - Recommendation (Orders, Weaning Plan, Contingencies)'}</span>
              </div>
            </div>

            {/* Quick Add Suggestion Chips */}
            <div className="p-2 rounded-lg bg-[#0a1224] border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-semibold">
                {lang === 'ar' ? 'إضافة سريعة للتوصيات السريرية (اضغط للإدراج المباشر):' : 'Quick ICU Directives (Click to append):'}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddQuickChip(chip.text)}
                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-700 active:scale-95 transition-all cursor-pointer"
                  >
                    {lang === 'ar' ? chip.labelAr : chip.labelEn}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={3}
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="w-full bg-[#0b1428] border border-slate-700/80 rounded-lg p-2.5 text-white text-xs leading-relaxed focus:border-emerald-400 focus:outline-none font-sans"
              required
            />
          </div>
          )}

          {/* Custom Configured Fields */}
          {customFieldsConfig.length > 0 && (
            <div className="bg-[#060b17] p-3.5 rounded-xl border border-slate-700/60 space-y-3">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold font-mono text-xs">
                <span className="w-5 h-5 rounded-full bg-slate-500/20 border border-slate-500/40 flex items-center justify-center text-xs font-black">+</span>
                <span>{lang === 'ar' ? 'معلومات مخصصة إضافية' : 'Additional Custom Fields'}</span>
              </div>
              <div className="space-y-2">
                {customFieldsConfig.map(field => (
                  <div key={field.id}>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1">
                      <span>{lang === 'ar' ? field.labelAr : field.labelEn}</span>
                      {field.isRequired && <span className="text-red-400">*</span>}
                    </label>
                    <textarea
                      rows={2}
                      value={customFieldValues[field.id] || ''}
                      onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.id]: e.target.value })}
                      className="w-full bg-[#0b1428] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:border-slate-400 focus:outline-none"
                      required={field.isRequired}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Clinician */}
          <div className="p-2 rounded-xl bg-[#060b17] border border-teal-500/20 text-xs font-mono text-teal-400">
            {lang === 'ar' ? 'الطبيب المُسَلِّم / ' : 'Outgoing Clinician / '}
            <strong className="text-white">
              {currentUser?.nameAr || currentUser?.nameEn || (lang === 'ar' ? 'د. الطبيب الحالي' : 'Dr. Current User')}
            </strong>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'ar' ? 'التوثيق يخضع للتشفير SHA-256 وغير قابل للتعديل بعد التوقيع' : 'SHA-256 cryptographically immutable record'}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !!pendingHandover}
                className={`px-6 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                  pendingHandover 
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60' 
                    : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 shadow-teal-500/25 active:scale-95'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {pendingHandover 
                    ? (lang === 'ar' ? 'يلزم استلام المناوبة السابقة أولاً' : 'Must Acknowledge Previous Shift First')
                    : (isSubmitting 
                        ? (lang === 'ar' ? 'جاري التوقيع والتشفير...' : 'Signing...') 
                        : (lang === 'ar' ? 'توقيع واعتماد تسليم المناوبة SBAR' : 'Authenticate & Sign SBAR'))}
                </span>
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
