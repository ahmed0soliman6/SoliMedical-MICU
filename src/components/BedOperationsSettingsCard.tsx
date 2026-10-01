import React, { useState, useEffect } from 'react';
import { db, ensureBedPatientSync } from '../db/icuSyncDb.ts';
import { BedRecord, PatientDossier, BedNumber, BedStatus } from '../types/schema.ts';
import { getPatientForBed, toggleBedOperationalStatus } from '../services/dataModel.ts';
import { syncBedToCloud } from '../services/firebase.ts';
import { useTranslation } from '../services/i18n.ts';
import { 
  Wrench, 
  Power, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Bed, 
  UserCheck, 
  Loader2, 
  Activity,
  Info,
  RotateCcw
} from 'lucide-react';

interface BedOperationsSettingsCardProps {
  onBedUpdated?: () => void;
}

export const BedOperationsSettingsCard: React.FC<BedOperationsSettingsCardProps> = ({ onBedUpdated }) => {
  const { lang } = useTranslation();
  const [beds, setBeds] = useState<BedRecord[]>([]);
  const [patients, setPatients] = useState<PatientDossier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBedNumber, setActionBedNumber] = useState<BedNumber | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isSuccess: boolean } | null>(null);

  const loadBedsData = async () => {
    try {
      setLoading(true);
      const allBeds = await db.beds.orderBy('bedNumber').toArray();
      const allPatients = await db.patients.toArray();
      setBeds(allBeds);
      setPatients(allPatients);
    } catch (err) {
      console.error('Failed to load beds in settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBedsData();
  }, []);

  const handleToggle = async (bedNumber: BedNumber) => {
    try {
      setActionBedNumber(bedNumber);
      setStatusMessage(null);
      const res = await toggleBedOperationalStatus(bedNumber);
      setStatusMessage({
        text: res.message,
        isSuccess: res.success,
      });
      await loadBedsData();
      if (onBedUpdated) {
        onBedUpdated();
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'حدث خطأ أثناء تحديث حالة تشغيل السرير.',
        isSuccess: false,
      });
    } finally {
      setActionBedNumber(null);
    }
  };

  const handleResetBed = async (bedNumber: BedNumber) => {
    try {
      setActionBedNumber(bedNumber);
      setStatusMessage(null);
      const bed = await db.beds.get(bedNumber);
      if (bed) {
        const updated: BedRecord = {
          ...bed,
          status: BedStatus.VACANT,
          currentPatientId: null,
          activePatientId: null,
          isolation: { isIsolated: false, precautions: [] },
          lastCleanedAt: new Date().toISOString(),
        };
        await db.beds.put(updated);
        try {
          await syncBedToCloud(updated);
        } catch (e) {}
      }
      await ensureBedPatientSync();
      setStatusMessage({
        text: lang === 'ar' ? `تم تفريغ السرير ${bedNumber} وإلغاء أي تدابير عزل بنجاح.` : `Bed ${bedNumber} reset to clean vacant with no isolation.`,
        isSuccess: true,
      });
      await loadBedsData();
      if (onBedUpdated) {
        onBedUpdated();
      }
      window.dispatchEvent(new Event('icu-data-updated'));
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'حدث خطأ أثناء إعادة ضبط السرير.',
        isSuccess: false,
      });
    } finally {
      setActionBedNumber(null);
    }
  };

  const totalBeds = beds.length || 6;
  const unavailableBeds = beds.filter(b => b.status === BedStatus.UNAVAILABLE && !getPatientForBed(b, patients)).length;
  const occupiedBeds = beds.filter(b => !!getPatientForBed(b, patients)).length;
  const availableBeds = totalBeds - unavailableBeds - occupiedBeds;

  if (loading && beds.length === 0) {
    return (
      <div className="py-8 flex items-center justify-center gap-3 text-slate-400 text-xs font-semibold">
        <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
        <span>{lang === 'ar' ? 'جاري قراءة حالة الأسِرّة...' : 'Loading bed operational statuses...'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 mt-2">
      {/* Informative Header / Notice */}
      <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-500/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <strong className="text-teal-950 dark:text-teal-200 font-bold block">
            {lang === 'ar' ? 'إدارة الجاهزية التشغيلية لأسِرّة العناية المركزة' : 'ICU Bed Operational Readiness Management'}
          </strong>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {lang === 'ar'
              ? 'تتيح هذه البطاقة التحكم المباشر بحالة كل سرير (وضع السرير خارج الخدمة لأعمال الصيانة الوقائية أو التطهير الشامل، أو إعادته فوراً للخدمة لاستقبال المرضى). تم نقل هذه الخاصية إلى الإعدادات لضمان عدم التفعيل غير المقصود من شاشة العناية الرئيسية.'
              : 'Directly manage the operational readiness of each bed. Put beds out of service for preventive maintenance or decontamination, or reactivate them instantly. This control is centralized here in Settings to prevent accidental toggling on the main ICU dashboard.'}
          </p>
        </div>
      </div>

      {/* Real-time Status Feedback Toast / Banner */}
      {statusMessage && (
        <div 
          className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200 ${
            statusMessage.isSuccess
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-300'
          }`}
        >
          {statusMessage.isSuccess ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#060a14] border border-slate-200 dark:border-slate-800 text-center">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-semibold">
            {lang === 'ar' ? 'إجمالي الأسِرّة' : 'Total Beds'}
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
            {totalBeds}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 text-center">
          <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block font-semibold">
            {lang === 'ar' ? 'متاح للاستقبال' : 'Available (Vacant)'}
          </span>
          <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-0.5 block">
            {availableBeds}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/50 text-center">
          <span className="text-[11px] text-teal-700 dark:text-teal-400 block font-semibold">
            {lang === 'ar' ? 'مشغول بمرضى' : 'Occupied'}
          </span>
          <span className="text-xl font-black text-teal-700 dark:text-teal-400 font-mono mt-0.5 block">
            {occupiedBeds}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 text-center">
          <span className="text-[11px] text-rose-700 dark:text-rose-400 block font-semibold">
            {lang === 'ar' ? 'خارج الخدمة (صيانة)' : 'Out of Service'}
          </span>
          <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono mt-0.5 block">
            {unavailableBeds}
          </span>
        </div>
      </div>

      {/* Grid of Bed Operational Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {beds.map((bed) => {
          const patient = getPatientForBed(bed, patients);
          const isOccupied = !!patient;
          const isUnavailable = bed.status === BedStatus.UNAVAILABLE && !isOccupied;
          const isActionLoading = actionBedNumber === bed.bedNumber;

          return (
            <div
              key={bed.bedNumber}
              id={`settings-bed-card-${bed.bedNumber}`}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                isUnavailable
                  ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                  : isOccupied
                  ? 'bg-teal-50/30 dark:bg-teal-950/10 border-slate-200 dark:border-slate-800'
                  : 'bg-white dark:bg-[#060a14] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-mono font-black text-slate-900 dark:text-white text-sm">
                      {bed.bedNumber}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {lang === 'ar' ? `سرير ${bed.bedNumber}` : `Bed ${bed.bedNumber}`}
                      </h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                        {bed.roomType || 'MICU-STANDARD'}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {isUnavailable ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      <Wrench className="w-3 h-3 shrink-0" />
                      <span>{lang === 'ar' ? 'خارج الخدمة' : 'Out of Service'}</span>
                    </span>
                  ) : isOccupied ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                      <UserCheck className="w-3 h-3 shrink-0" />
                      <span>{lang === 'ar' ? 'مشغول' : 'Occupied'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>{lang === 'ar' ? 'شاغر ومتاح' : 'Available'}</span>
                    </span>
                  )}
                </div>

                {/* Content description based on state */}
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  {isOccupied ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {patient.fullNameAr || patient.fullNameEn}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                          {patient.mrn}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800/40">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="leading-tight">
                          {lang === 'ar'
                            ? 'محمي سريرياً: لا يمكن تعطيل السرير أثناء تنويم المريض'
                            : 'Protected: Cannot set out of service while occupied'}
                        </span>
                      </div>
                    </div>
                  ) : isUnavailable ? (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 text-[11px] leading-relaxed">
                      {lang === 'ar'
                        ? 'السرير متوقف حالياً عن استقبال الحالات ويخضع للصيانة الهندسية أو التعقيم الشامل.'
                        : 'Bed is currently halted and undergoes engineering maintenance or complete disinfection.'}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      {lang === 'ar'
                        ? 'السرير جاهز ونظيف تماماً ومتاح لاستقبال مريض جديد في أي وقت.'
                        : 'Bed is clean, sanitized, and ready for admitting a new ICU patient.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 space-y-2">
                {isOccupied ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 font-bold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200 dark:border-slate-800"
                  >
                    <Bed className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'السرير مشغول بمريض' : 'Bed Occupied'}</span>
                  </button>
                ) : isUnavailable ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      id={`settings-reactivate-bed-${bed.bedNumber}`}
                      onClick={() => handleToggle(bed.bedNumber)}
                      disabled={isActionLoading}
                      className="w-full py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isActionLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{lang === 'ar' ? 'جاري التفعيل...' : 'Activating...'}</span>
                        </>
                      ) : (
                        <>
                          <Power className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'إعادة السرير للخدمة وتفعيله' : 'Reactivate Bed for Service'}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetBed(bed.bedNumber)}
                      disabled={isActionLoading}
                      className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 border border-slate-300 dark:border-slate-700"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-500" />
                      <span>{lang === 'ar' ? 'إعادة الضبط كسرير شاغر نظيف' : 'Reset to Clean Vacant'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      id={`settings-deactivate-bed-${bed.bedNumber}`}
                      onClick={() => handleToggle(bed.bedNumber)}
                      disabled={isActionLoading}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/30 text-slate-700 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 hover:border-rose-300 dark:border-slate-800 dark:hover:border-rose-900/50 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isActionLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{lang === 'ar' ? 'جاري التحديث...' : 'Updating...'}</span>
                        </>
                      ) : (
                        <>
                          <Wrench className="w-3.5 h-3.5 text-slate-400 hover:text-rose-600" />
                          <span>{lang === 'ar' ? 'وضع السرير خارج الخدمة (صيانة / تعقيم)' : 'Set Out of Service (Maintenance)'}</span>
                        </>
                      )}
                    </button>
                    {(bed.isolation?.isIsolated || bed.status !== BedStatus.VACANT) && (
                      <button
                        type="button"
                        onClick={() => handleResetBed(bed.bedNumber)}
                        disabled={isActionLoading}
                        className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 border border-amber-300 dark:border-amber-700/60"
                      >
                        <RotateCcw className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>{lang === 'ar' ? 'إلغاء العزل وتصفير السرير كشاغر' : 'Clear Isolation & Set Vacant'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
