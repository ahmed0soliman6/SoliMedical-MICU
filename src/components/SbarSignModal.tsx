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
import { useAppNotifications } from '../services/NotificationContext.tsx';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { DEFAULT_SBAR_FIELDS } from '../types/settings.ts';

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
  onHandoverSigned?: (handoverId?: string) => void;
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
  const { triggerNotification } = useAppNotifications();

  const [patient, setPatient] = useState<PatientDossier | null>(initialPatient || null);
  const [vitals, setVitals] = useState<TelemetryVitals | null>(initialVitals || null);
  const [ventilator, setVentilator] = useState<VentilatorParameters | null>(initialVentilator || null);
  const [pumps, setPumps] = useState<InfusionPumpLine[]>(initialPumps || []);
  const [fluidBalance, setFluidBalance] = useState<FluidBalance24H | null>(initialFluidBalance || null);
  const [labs, setLabs] = useState<StatLabPanel[]>(initialLabs || []);
  const [previousHandovers, setPreviousHandovers] = useState<SbarHandoverReport[]>(initialPreviousHandovers || []);

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

  const configuredFields = settings.sbarFields && settings.sbarFields.length > 0 ? settings.sbarFields : DEFAULT_SBAR_FIELDS;
  const hasField = (id: string) => configuredFields.some(f => f.id === id);

  const pendingHandover = useMemo(() => {
    if (templateSbar && !templateSbar.incomingDoctor?.signedAt) return templateSbar;
    if (previousHandovers && previousHandovers.length > 0) {
      const latest = previousHandovers[0];
      if (latest && !latest.incomingDoctor?.signedAt) return latest;
    }
    return null;
  }, [previousHandovers, templateSbar]);

  useEffect(() => {
    if (isOpen) {
      if (pendingHandover) {
        setModalTab('RECEIVE');
      } else {
        setModalTab('NEW');
      }
      if (currentUser) {
        setOutgoingDoctorName(currentUser.nameAr || currentUser.nameEn || '');
        setOutgoingDoctorStaffId(currentUser.badgeId || currentUser.uid || 'DOC-101');
        if (currentUser.role) setOutgoingDoctorRole(currentUser.role as StaffRole);
      }
    }
  }, [isOpen, pendingHandover, currentUser]);

  const handleAcknowledgeShift = async () => {
    if (!pendingHandover) return;
    setIsAcking(true);
    try {
      const docInfo = {
        staffId: currentUser?.badgeId || currentUser?.uid || outgoingDoctorStaffId || 'DOC-INC',
        name: currentUser?.nameAr || currentUser?.nameEn || outgoingDoctorName || (lang === 'ar' ? 'د. الطبيب المستلم' : 'Incoming Physician'),
        role: currentUser?.role || outgoingDoctorRole || StaffRole.SPECIALIST,
      };
      await db.sbarHandovers.update(pendingHandover.id, {
        incomingDoctor: {
          ...docInfo,
          signedAt: new Date().toISOString(),
        },
        status: 'SIGNED',
      });
      onHandoverSigned?.(pendingHandover.id);
      onClose();
    } catch (err) {
      console.error('Error acknowledging SBAR:', err);
    } finally {
      setIsAcking(false);
    }
  };

  const handleSignNewHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newReport = await signSbarHandover({
        bedId: bedNumber,
        patientId: patientId,
        shiftType,
        shiftDate,
        shiftStartTime,
        shiftEndTime,
        situation,
        background,
        assessment: {
          hemodynamics,
          pulmonary,
          metabolic,
          neurology,
          infectious,
          customFields: customFieldValues
        },
        recommendation,
        outgoingDoctor: {
          staffId: outgoingDoctorStaffId,
          name: outgoingDoctorName || (lang === 'ar' ? 'طبيب مناوب' : 'Attending Physician'),
          role: outgoingDoctorRole
        }
      });
      onHandoverSigned?.(newReport.id);
      onClose();
    } catch (err) {
      console.error('Error signing SBAR:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#080e1c] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#0d172e] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'تسليم مناوبة SBAR السريري' : 'Clinical SBAR Shift Handover'}</span>
                <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-xs font-mono">
                  {lang === 'ar' ? `سرير ${bedNumber}` : `Bed ${bedNumber}`}
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {patientName ? `${patientName} • ${primaryDiagnosis || ''}` : primaryDiagnosis || ''}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        {pendingHandover && (
          <div className="flex border-b border-slate-800 bg-[#0a1224] px-5 pt-2">
            <button
              onClick={() => setModalTab('RECEIVE')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                modalTab === 'RECEIVE'
                  ? 'border-amber-400 text-amber-300 bg-amber-500/10 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{lang === 'ar' ? 'استلام المناوبة السابقة (معلقة)' : 'Acknowledge Pending Shift'}</span>
            </button>
            <button
              onClick={() => setModalTab('NEW')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                modalTab === 'NEW'
                  ? 'border-teal-500 text-teal-300 bg-teal-500/10 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4 text-teal-400" />
              <span>{lang === 'ar' ? 'تسليم جديد (المناوبة الحالية)' : 'New Handover (Current Shift)'}</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {modalTab === 'RECEIVE' && pendingHandover ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between text-xs text-amber-300">
                  <span className="font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {pendingHandover.shiftType === 'NIGHT' ? (lang === 'ar' ? 'مناوبة ليلية' : 'Night Shift') : (lang === 'ar' ? 'مناوبة نهارية' : 'Day Shift')}
                  </span>
                  <span>{pendingHandover.shiftDate}</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {lang === 'ar' ? 'الطبيب المسلّم:' : 'Outgoing Physician:'} {pendingHandover.outgoingDoctor?.name} ({pendingHandover.outgoingDoctor?.role})
                </div>
                {pendingHandover.situation && (
                  <div>
                    <div className="text-xs text-teal-400 font-bold mb-1">S - Situation:</div>
                    <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">{pendingHandover.situation}</p>
                  </div>
                )}
                {pendingHandover.background && (
                  <div>
                    <div className="text-xs text-teal-400 font-bold mb-1">B - Background:</div>
                    <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">{pendingHandover.background}</p>
                  </div>
                )}
                {pendingHandover.recommendation && (
                  <div>
                    <div className="text-xs text-teal-400 font-bold mb-1">R - Recommendation:</div>
                    <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">{pendingHandover.recommendation}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isAcking}
                  onClick={handleAcknowledgeShift}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isAcking ? (lang === 'ar' ? 'جارٍ التوقيع...' : 'Signing...') : (lang === 'ar' ? 'توقيع واستلام المناوبة' : 'Sign & Acknowledge Handover')}</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignNewHandover} className="space-y-4">
              {/* Shift Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">
                    {lang === 'ar' ? 'نوع المناوبة' : 'Shift Type'}
                  </label>
                  <select 
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value as any)}
                    className="w-full bg-[#0d172e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="DAY">{lang === 'ar' ? 'نهارية (Day)' : 'Day Shift'}</option>
                    <option value="NIGHT">{lang === 'ar' ? 'ليلية (Night)' : 'Night Shift'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">
                    {lang === 'ar' ? 'تاريخ المناوبة' : 'Shift Date'}
                  </label>
                  <input 
                    type="date"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    className="w-full bg-[#0d172e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-semibold mb-1 block">
                    {lang === 'ar' ? 'الطبيب المسلّم' : 'Outgoing Doctor'}
                  </label>
                  <input 
                    type="text"
                    value={outgoingDoctorName}
                    onChange={(e) => setOutgoingDoctorName(e.target.value)}
                    placeholder={lang === 'ar' ? 'اسم الطبيب المسلّم' : 'Outgoing Doctor Name'}
                    className="w-full bg-[#0d172e] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* SBAR Fields */}
              {hasField('situation') && (
                <div>
                  <label className="text-xs text-teal-400 font-bold mb-1 block">
                    S - {lang === 'ar' ? 'الحالة الراهنة (Situation)' : 'Situation'}
                  </label>
                  <textarea 
                    rows={2}
                    value={situation}
                    onChange={(e) => setSituation(e.target.value)}
                    placeholder={lang === 'ar' ? 'وصف الحالة الحالية والسبب الرئيسي للتواجد بالرعاية...' : 'Current status and primary clinical concern...'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>
              )}

              {hasField('background') && (
                <div>
                  <label className="text-xs text-teal-400 font-bold mb-1 block">
                    B - {lang === 'ar' ? 'التاريخ المرضي والخلفية (Background)' : 'Background'}
                  </label>
                  <textarea 
                    rows={2}
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    placeholder={lang === 'ar' ? 'التاريخ المرضي، الإجراءات الجراحية، الحساسية...' : 'Clinical history, surgical history, allergies...'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>
              )}

              {/* Systems Assessment */}
              <div className="space-y-2.5">
                <div className="text-xs text-teal-400 font-bold">
                  A - {lang === 'ar' ? 'التقييم السريري للأجهزة (Assessment by Systems)' : 'Assessment by Systems'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {hasField('hemodynamics') && (
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium mb-1 block">
                        {lang === 'ar' ? 'الدورة الدموية والقلب' : 'Hemodynamics & Cardiovascular'}
                      </span>
                      <input 
                        type="text"
                        value={hemodynamics}
                        onChange={(e) => setHemodynamics(e.target.value)}
                        placeholder="MAP, Inotropes, Rhythm..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  )}
                  {hasField('pulmonary') && (
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium mb-1 block">
                        {lang === 'ar' ? 'الجهاز التنفسي وجهاز التنفس' : 'Respiratory & Ventilator'}
                      </span>
                      <input 
                        type="text"
                        value={pulmonary}
                        onChange={(e) => setPulmonary(e.target.value)}
                        placeholder="FiO2, PEEP, Secretions..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  )}
                  {hasField('metabolic') && (
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium mb-1 block">
                        {lang === 'ar' ? 'الأيض والكلى والسوائل' : 'Renal, Fluid & Metabolic'}
                      </span>
                      <input 
                        type="text"
                        value={metabolic}
                        onChange={(e) => setMetabolic(e.target.value)}
                        placeholder="UOP, Fluid Balance, K/Na..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  )}
                  {hasField('infectious') && (
                    <div>
                      <span className="text-[11px] text-slate-400 font-medium mb-1 block">
                        {lang === 'ar' ? 'العدوى والمضادات الحيوية' : 'Infectious & Antibiotics'}
                      </span>
                      <input 
                        type="text"
                        value={infectious}
                        onChange={(e) => setInfectious(e.target.value)}
                        placeholder="Antibiotic Day, Fever, Cultures..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {hasField('recommendation') && (
                <div>
                  <label className="text-xs text-teal-400 font-bold mb-1 block">
                    R - {lang === 'ar' ? 'التوصيات وخطة المناوبة القادمة (Recommendation & Action Plan)' : 'Recommendation & Next Shift Plan'}
                  </label>
                  <textarea 
                    rows={2}
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder={lang === 'ar' ? 'الخطة السريرية للمناوبة القادمة، التحاليل المعلقة...' : 'Clinical targets, pending labs, weaning plans...'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all cursor-pointer active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSubmitting ? (lang === 'ar' ? 'جارٍ التوقيع المشفر...' : 'Digitally Signing...') : (lang === 'ar' ? 'توقيع واعتماد تسليم المناوبة' : 'Sign & Submit Shift Handover')}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SbarSignModal;
