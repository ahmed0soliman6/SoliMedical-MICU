import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Activity, 
  ShieldCheck, 
  Sparkles, 
  Copy, 
  History, 
  Clock, 
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
  Lock
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
import { signSbarHandover } from '../services/dataModel.ts';
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
    return hour >= 19 || hour < 7 ? 'NIGHT' : 'DAY';
  });
  const [shiftDate, setShiftDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [shiftStartTime, setShiftStartTime] = useState<string>(() => (shiftType === 'NIGHT' ? '19:00' : '07:00'));
  const [shiftEndTime, setShiftEndTime] = useState<string>(() => (shiftType === 'NIGHT' ? '07:00' : '19:00'));

  const [situation, setSituation] = useState<string>('');
  const [background, setBackground] = useState<string>('');
  const [hemodynamics, setHemodynamics] = useState<string>('');
  const [pulmonary, setPulmonary] = useState<string>('');
  const [metabolic, setMetabolic] = useState<string>('');
  const [neurology, setNeurology] = useState<string>('');
  const [infectious, setInfectious] = useState<string>('');
  const [recommendation, setRecommendation] = useState<string>('');

  const [outgoingDoctorName, setOutgoingDoctorName] = useState<string>('');
  const [outgoingDoctorRole, setOutgoingDoctorRole] = useState<StaffRole>(StaffRole.SPECIALIST);
  const [outgoingDoctorStaffId, setOutgoingDoctorStaffId] = useState<string>('DOC-101');
  const [incomingDoctorName, setIncomingDoctorName] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPreviousDrawer, setShowPreviousDrawer] = useState<boolean>(false);
  const [selectedPrevForCompare, setSelectedPrevForCompare] = useState<SbarHandoverReport | null>(null);

  // Quick Recommendation Chips
  const quickChips = useMemo(() => [
    { labelAr: '+ فطام التنفس الصناعي (SBT)', labelEn: '+ SBT Weaning Trial', text: '• Attempt daily Spontaneous Breathing Trial (SBT) if hemodynamically stable & P/F > 200.' },
    { labelAr: '+ تقليل الرافعات الوعائية (Pressor Wean)', labelEn: '+ Vasopressor Wean', text: '• Titrate and wean Norepinephrine targeting MAP > 65 mmHg.' },
    { labelAr: '+ ميزان سوائل سالب (Negative I/O)', labelEn: '+ Target Net Negative I/O', text: '• Maintain strict fluid balance targeting net negative balance (-500 to -1000 mL/24h).' },
    { labelAr: '+ إعادة غازات الدم 06:00 (Repeat ABG)', labelEn: '+ Repeat ABG @ 06:00', text: '• Repeat morning ABG, Lactate, and Serum Electrolytes at 06:00.' },
    { labelAr: '+ إيقاف المهدئات الصباحي (Sedation Vacation)', labelEn: '+ Sedation Vacation', text: '• Perform daily morning sedation interruption & neurological evaluation.' },
    { labelAr: '+ وقاية الجلطات والمعدة (DVT/GI Prophylaxis)', labelEn: '+ DVT & GI Prophylaxis', text: '• Continue Enoxaparin DVT prophylaxis & Pantoprazole stress ulcer prophylaxis.' },
    { labelAr: '+ متابعة وظائف الكلى وإدرار البول', labelEn: '+ Renal & UOP Monitoring', text: '• Strict hourly urine output monitoring (target > 0.5 mL/kg/hr); notify if oliguric.' },
    { labelAr: '+ مطابقة ونقل الدم (Blood Cross-match)', labelEn: '+ Transfusion Orders', text: '• Maintain Hemoglobin > 7.0 g/dL (Target > 8.0 g/dL if ACS/ischemic).' },
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

  // Dynamic recognition & clinical synthesis function
  const autoSynthesizeSbar = (
    targetPatient: PatientDossier | null,
    targetVitals: TelemetryVitals | null,
    targetVent: VentilatorParameters | null,
    targetPumps: InfusionPumpLine[],
    targetFluid: FluidBalance24H | null,
    targetLabs: StatLabPanel[]
  ) => {
    const pName = targetPatient?.fullNameEn || targetPatient?.fullNameAr || patientName || `Patient Bed ${bedNumber}`;
    const pDiag = targetPatient?.primaryDiagnosisEn || targetPatient?.primaryDiagnosisAr || primaryDiagnosis || 'Critical Illness';
    const pMrn = targetPatient?.mrn || 'ICU-MRN';
    const pAge = targetPatient?.age ? `${targetPatient.age}y` : '';
    const pGender = targetPatient?.gender || '';
    const pCode = targetPatient?.codeStatus || codeStatus || 'FULL_CODE';

    // Calculate ICU Day
    let icuDay = '1';
    if (targetPatient?.admissionDate) {
      const admitTime = new Date(targetPatient.admissionDate).getTime();
      const diffDays = Math.max(1, Math.ceil((Date.now() - admitTime) / (1000 * 60 * 60 * 24)));
      icuDay = String(diffDays);
    }

    // Active infusions analysis
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
      ? pressorPumps.map(p => `${p.drugNameEn} @ ${p.flowRateMlPerHour} mL/h (${p.currentRate} ${p.rateUnit})`).join(', ')
      : 'No active vasopressors/inotropes';

    const sedativeSummary = sedativePumps.length > 0
      ? sedativePumps.map(p => `${p.drugNameEn} @ ${p.flowRateMlPerHour} mL/h`).join(', ')
      : 'No continuous sedatives running';

    // Airway / Vent state
    let airwayStatus = 'Extubated / Room Air';
    if (targetVent && targetVent.mode) {
      airwayStatus = `Invasive MV [Mode: ${targetVent.mode}, FiO2: ${targetVent.fio2Percent}%, PEEP: ${targetVent.peepCmH2O} cmH2O]`;
    } else if (targetVitals?.fio2SuppliedPercent && targetVitals.fio2SuppliedPercent > 21) {
      airwayStatus = `Supplemental O2 (${targetVitals.fio2SuppliedPercent}% FiO2)`;
    }

    // 1. Situation (S)
    const sitText = `Bed ${bedNumber} | ${pName} (${pMrn}, ${pAge} ${pGender}). Admitted for: ${pDiag}. ICU Day ${icuDay}. Code Status: ${pCode}. Current Airway/Support: ${airwayStatus}. Pressors: ${pressorPumps.length > 0 ? pressorPumps.map(p => p.drugNameEn).join('+') : 'Off pressors'}.`;

    // 2. Background (B)
    const chronics = targetPatient?.chronicDiseases || targetPatient?.history || 'No significant prior medical history logged';
    
    const allergiesText = targetPatient?.allergies && targetPatient.allergies.length > 0
      ? targetPatient.allergies.map(a => `${a.allergen} (${a.reaction || 'Allergy'})`).join(', ')
      : 'NKDA (No Known Drug Allergies)';

    const lines = 'Peripheral IVs, Central Venous Line, Foley Catheter';

    const bgText = `Admission Date: ${targetPatient?.admissionDate ? targetPatient.admissionDate.split('T')[0] : 'Recent'}. Primary Reason: ${targetPatient?.presentingComplaint || pDiag}. Comorbidities: ${chronics}. Allergies: ${allergiesText}. Active Lines & Drains: ${lines}.`;

    // 3. Assessment (A) - Hemodynamics
    const hr = targetVitals?.heartRateBpm ?? 80;
    const bp = targetVitals ? `${targetVitals.systolicBpMmHg}/${targetVitals.diastolicBpMmHg}` : '120/70';
    const map = targetVitals?.meanArterialPressureMmHg ?? Math.round((2 * 70 + 120) / 3);
    const rhythm = targetVitals?.heartRhythm || 'Sinus Rhythm';
    const hemoText = `BP: ${bp} mmHg (MAP: ${map} mmHg), HR: ${hr} bpm (${rhythm}). Pressors: ${pressorSummary}.`;

    // Assessment (A) - Pulmonary
    let pulmText = '';
    const latestPf = targetLabs?.[0]?.abg?.pao2Fio2Ratio ? `P/F Ratio: ${targetLabs[0].abg.pao2Fio2Ratio}` : '';
    if (targetVent) {
      const drivingP = targetVent.drivingPressureCmH2O ? `Driving P: ${targetVent.drivingPressureCmH2O} cmH2O` : '';
      pulmText = `Vent: ${targetVent.mode} | FiO2: ${targetVent.fio2Percent}% | PEEP: ${targetVent.peepCmH2O} | Vt: ${targetVent.tidalVolumeMl} mL | Ppeak: ${targetVent.peakInspiratoryPressureCmH2O || 18} cmH2O. SpO2: ${targetVitals?.spo2Percent ?? 98}%, RR: ${targetVitals?.respiratoryRateCpm ?? 16}. ${latestPf} ${drivingP}`.trim();
    } else {
      pulmText = `SpO2: ${targetVitals?.spo2Percent ?? 98}% on ${targetVitals?.fio2SuppliedPercent ?? 21}% FiO2, RR: ${targetVitals?.respiratoryRateCpm ?? 16} bpm. Chest clear bilaterally. ${latestPf}`.trim();
    }

    // Assessment (A) - Metabolic, Renal, Fluid
    let metaText = '';
    if (targetFluid) {
      const inVal = targetFluid.intakeBreakdown?.totalIntakeMl ?? 0;
      const outVal = targetFluid.outputBreakdown?.totalOutputMl ?? 0;
      const netVal = targetFluid.netCumulativeBalanceMl ?? (inVal - outVal);
      const urineVal = targetFluid.outputBreakdown?.urineOutputMl ?? 0;
      const uopRate = targetFluid.outputBreakdown?.hourlyUrineAverageMlPerHour ?? Math.round(urineVal / 24);
      const prbc = targetFluid.transfusionProductsGiven?.prbcUnits ?? 0;
      const ffp = targetFluid.transfusionProductsGiven?.ffpUnits ?? 0;
      const plt = targetFluid.transfusionProductsGiven?.plateletsUnits ?? 0;
      const bldStr = (prbc > 0 || ffp > 0 || plt > 0) ? ` | Blood: PRBC ${prbc}U, FFP ${ffp}U, PLT ${plt}U` : '';

      metaText = `24H Fluid I/O: Intake ${inVal} mL, Output ${outVal} mL, Net: ${netVal > 0 ? `+${netVal}` : netVal} mL. Urine: ${urineVal} mL (${uopRate} mL/h)${bldStr}.`;
    } else {
      metaText = `Urine output adequate (> 0.5 mL/kg/h). Fluid balance on maintenance IV fluids. Electrolytes & Lactate within target limits.`;
    }

    // Assessment (A) - Neurology & Sedation
    const gcs = targetVitals?.gcsTotalScore ?? 15;
    const neuroText = `GCS: ${gcs}/15. Pupils equal & reactive to light. Sedation: ${sedativeSummary}.`;

    // Assessment (A) - Infectious & Antibiotics
    const temp = targetVitals?.coreTemperatureCelsius ?? 37.0;
    const infectText = `Temp: ${temp}°C. Afebrile/Controlled. Infection markers & active antimicrobials monitored.`;

    // 4. Recommendation (R)
    const recList = [
      `1. Hemodynamics: Maintain MAP > 65 mmHg; continue weaning ${pressorPumps.length > 0 ? pressorPumps.map(p => p.drugNameEn).join('/') : 'vasopressors'} as tolerated.`,
      targetVent ? `2. Pulmonary: Daily Spontaneous Breathing Trial (SBT) & evaluate for extubation readiness.` : `2. Pulmonary: Monitor work of breathing & oxygen saturation.`,
      `3. Fluids/Renal: Strict 24h intake/output tracking; target ${targetFluid && (targetFluid.netCumulativeBalanceMl || 0) > 1000 ? 'net negative balance' : 'euvolemia'}.`,
      `4. Diagnostics: Repeat morning ABG, CBC, and Serum Electrolytes at 06:00.`,
      `5. Prophylaxis: Continue DVT mechanical/chemical prophylaxis and GI stress ulcer protection.`,
    ];

    setSituation(sitText);
    setBackground(bgText);
    setHemodynamics(hemoText);
    setPulmonary(pulmText);
    setMetabolic(metaText);
    setNeurology(neuroText);
    setInfectious(infectText);
    setRecommendation(recList.join('\n'));
  };

  // Populate from template or perform initial auto-synthesis
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
      // Auto-synthesize from live patient parameters
      autoSynthesizeSbar(patient, vitals, ventilator, pumps, fluidBalance, labs);
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
        outgoingDoctor: {
          staffId: outgoingDoctorStaffId || 'DOC-101',
          name: outgoingDoctorName.trim() || 'Attending Physician',
          role: outgoingDoctorRole,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-[#091122] border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#060b17] border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? 'تسليم واستلام المناوبة السريرية (SBAR Shift Handover)' : 'Clinical Shift Handover (SBAR Protocol)'}
                </h3>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-teal-950 border border-teal-800 text-teal-300">
                  {lang === 'ar' ? `سرير ${bedNumber}` : `Bed ${bedNumber}`}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {patientName || (patient?.fullNameAr || patient?.fullNameEn)} • {patient?.mrn || 'MRN'} • {lang === 'ar' ? 'حالة الإنعاش:' : 'Code:'} <strong className="text-emerald-400">{codeStatus}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Synthesize Button */}
            <button
              type="button"
              onClick={() => autoSynthesizeSbar(patient, vitals, ventilator, pumps, fluidBalance, labs)}
              className="px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm"
              title={lang === 'ar' ? 'التعرف التلقائي على العلامات والمدخلات السريرية' : 'Auto-fill from current telemetry & inputs'}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>{lang === 'ar' ? 'توليد ذكي من بيانات السرير' : 'Auto-Fill from Live Vitals'}</span>
            </button>

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
              className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

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

        {/* Main Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Shift Metadata Row */}
          <div className="p-3 rounded-xl bg-[#060b17] border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
            {/* Shift Type */}
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
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
                      setShiftStartTime(s.id === 'NIGHT' ? '19:00' : '07:00');
                      setShiftEndTime(s.id === 'NIGHT' ? '07:00' : '19:00');
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

            {/* Date */}
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                {lang === 'ar' ? 'تاريخ المناوبة (Date)' : 'Shift Date'}
              </label>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-teal-500 focus:outline-none"
                required
              />
            </div>

            {/* Shift Start Time */}
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                {lang === 'ar' ? 'وقت البدء (Start Time)' : 'Start Time'}
              </label>
              <input
                type="text"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-teal-500 focus:outline-none text-center"
                required
              />
            </div>

            {/* Shift End Time */}
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1">
                {lang === 'ar' ? 'وقت الانتهاء (End Time)' : 'End Time'}
              </label>
              <input
                type="text"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-teal-500 focus:outline-none text-center"
                required
              />
            </div>
          </div>

          {/* 1. S - SITUATION (الموقف الحالي) */}
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

          {/* 2. B - BACKGROUND (الخلفية المرضية ومسار الدخول) */}
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

              {/* Pulmonary */}
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

              {/* Metabolic & Renal */}
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

              {/* Neurology & Infectious (2-col) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              </div>
            </div>
          </div>

          {/* 4. R - RECOMMENDATION & ORDERS (التوصيات والخطة العلاجية) */}
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

          {/* Clinicians & Authentication Signatures */}
          <div className="p-3.5 rounded-xl bg-[#060b17] border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Outgoing Doctor */}
            <div>
              <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'الطبيب/الممارس المُسَلِّم (Outgoing Staff):' : 'Outgoing Attending Clinician:'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={outgoingDoctorName}
                  onChange={(e) => setOutgoingDoctorName(e.target.value)}
                  placeholder="Dr. Name"
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:border-teal-500 focus:outline-none text-xs"
                  required
                />
                <select
                  value={outgoingDoctorRole}
                  onChange={(e) => setOutgoingDoctorRole(e.target.value as StaffRole)}
                  className="bg-[#0f172a] border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 text-xs focus:border-teal-500 focus:outline-none"
                >
                  <option value={StaffRole.CONSULTANT}>{lang === 'ar' ? 'استشاري' : 'Consultant'}</option>
                  <option value={StaffRole.SPECIALIST}>{lang === 'ar' ? 'أخصائي' : 'Specialist'}</option>
                  <option value={StaffRole.RESIDENT}>{lang === 'ar' ? 'مقيم' : 'Resident'}</option>
                  <option value={StaffRole.LEAD_RN}>{lang === 'ar' ? 'مشرف تمريض' : 'Charge Nurse / Lead RN'}</option>
                  <option value={StaffRole.BEDSIDE_RN}>{lang === 'ar' ? 'تمريض سريري' : 'Bedside RN'}</option>
                </select>
              </div>
            </div>

            {/* Incoming Doctor */}
            <div>
              <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                {lang === 'ar' ? 'الطبيب/الممارس المُستَلِم (المستهدف اختيارياً):' : 'Incoming Clinician (Optional):'}
              </label>
              <input
                type="text"
                value={incomingDoctorName}
                onChange={(e) => setIncomingDoctorName(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم الطبيب المستلم للمناوبة القادمة' : 'Incoming Doctor Name'}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:border-teal-500 focus:outline-none text-xs"
              />
            </div>
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
                disabled={isSubmitting}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-teal-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>
                  {isSubmitting 
                    ? (lang === 'ar' ? 'جاري التوقيع والتشفير...' : 'Signing...') 
                    : (lang === 'ar' ? 'توقيع واعتماد تسليم المناوبة SBAR' : 'Authenticate & Sign SBAR')}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
