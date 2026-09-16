import React, { useState, useEffect } from 'react';
import { Activity, Lock } from 'lucide-react';
import { SbarHandoverReport, PatientDossier, BedRecord } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { useTranslation } from '../services/i18n.ts';

interface SbarHandoverViewProps {
  beds: BedRecord[];
  patients: PatientDossier[];
  onOpenSbarSignForBed: (bedNumber: any) => void;
}

export const SbarHandoverView: React.FC<SbarHandoverViewProps> = ({
  patients,
}) => {
  const { t, lang, isRTL } = useTranslation();
  const [handovers, setHandovers] = useState<SbarHandoverReport[]>([]);

  useEffect(() => {
    loadAllHandovers();
  }, []);

  const loadAllHandovers = async () => {
    const list = await db.sbarHandovers.reverse().sortBy('shiftDate');
    setHandovers(list);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#0b1224] border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {lang === 'ar' ? 'تسليم المناوبات المجمع (Central SBAR Board)' : 'Central SBAR Shift Handover Matrix'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' 
                  ? 'متابعة ملخصات وحالات جميع أسِرّة الرعاية المركزة الستة الموقعة رقمياً'
                  : 'Central overview of signed digital SBAR handovers across all 6 ICU beds'}
              </p>
            </div>
          </div>
        </div>

        {/* List of SBAR handovers grouped by bed */}
        <div className="space-y-4 mt-4">
          {handovers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              {lang === 'ar' ? 'لا توجد تسليمات مسجلة حالياً.' : 'No shift handover records logged yet.'}
            </div>
          ) : (
            handovers.map((sbar) => {
              const matchedPatient = patients.find(p => p.id === sbar.patientId);

              return (
                <div 
                  key={sbar.id}
                  className="bg-[#070c18] border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono font-bold text-xs flex items-center justify-center">
                        {sbar.bedId}
                      </span>
                      <span className="font-bold text-white text-sm">
                        {matchedPatient?.fullNameAr || matchedPatient?.fullNameEn || (lang === 'ar' ? `سرير ${sbar.bedId}` : `Bed ${sbar.bedId}`)}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {sbar.shiftType} SHIFT
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80">
                        {matchedPatient?.codeStatus || 'FULL_CODE'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <span>{sbar.shiftDate} ({sbar.shiftStartTime} - {sbar.shiftEndTime})</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>{sbar.cryptographicHash ? sbar.cryptographicHash.slice(0, 10) : 'HASH'}...</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#0a101f] p-3 rounded-lg border border-slate-800/60">
                      <span className="text-teal-400 font-bold font-mono">S - Situation:</span>
                      <p className="text-slate-200 mt-1">{sbar.situation}</p>
                    </div>

                    <div className="bg-[#0a101f] p-3 rounded-lg border border-slate-800/60">
                      <span className="text-cyan-400 font-bold font-mono">B - Background:</span>
                      <p className="text-slate-200 mt-1">{sbar.background}</p>
                    </div>

                    <div className="bg-[#0a101f] p-3 rounded-lg border border-slate-800/60">
                      <span className="text-amber-400 font-bold font-mono">A - Assessment:</span>
                      <div className="text-slate-200 mt-1 space-y-0.5">
                        <div>• {sbar.assessment.hemodynamics}</div>
                        <div>• {sbar.assessment.pulmonaryAndAirway}</div>
                        <div>• {sbar.assessment.metabolicAndRenal}</div>
                      </div>
                    </div>

                    <div className="bg-[#0a101f] p-3 rounded-lg border border-slate-800/60">
                      <span className="text-emerald-400 font-bold font-mono">R - Recommendation:</span>
                      <ul className="text-slate-200 mt-1 list-disc list-inside space-y-0.5">
                        {sbar.recommendationAndOrders.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 flex-wrap gap-2">
                    <span>
                      {lang === 'ar' ? 'المُسَلِّم: ' : 'Outgoing Clinician: '}
                      <strong className="text-slate-200">{sbar.outgoingDoctor.name}</strong> ({sbar.outgoingDoctor.role})
                    </span>
                    {sbar.incomingDoctor && (
                      <span>
                        {lang === 'ar' ? 'المُستَلِم: ' : 'Incoming Clinician: '}
                        <strong className="text-slate-200">{sbar.incomingDoctor.name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
