import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wind, 
  Check, 
  AlertTriangle, 
  Activity, 
  Clock, 
  Loader2,
  Trash2
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { firestore } from '../services/firebase.ts';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../db/icuSyncDb.ts';

export interface VentilatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  bedNumber: string;
  patientId?: string;
  patientName?: string;
  onSaved?: () => void;
  readOnly?: boolean;
}

export const VentilatorModal: React.FC<VentilatorModalProps> = ({
  isOpen,
  onClose,
  bedNumber,
  patientId,
  patientName,
  onSaved,
  readOnly = false,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();

  const [mode, setMode] = useState<string>('SIMV');
  const [fio2, setFio2] = useState<number>(40);
  const [peep, setPeep] = useState<number>(5);
  const [tidalVolume, setTidalVolume] = useState<number>(450);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(14);
  const [peakPressure, setPeakPressure] = useState<number>(22);
  const [plateauPressure, setPlateauPressure] = useState<number>(18);
  const [notes, setNotes] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculated Driving Pressure & Static Compliance
  const drivingPressure = Math.max(0, plateauPressure - peep);
  const staticCompliance = drivingPressure > 0 ? Math.round(tidalVolume / drivingPressure) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const timestamp = new Date().toISOString();
    const id = `vent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const ventData = {
      id,
      patientId: patientId || '',
      bedNumber,
      mode,
      fio2: Number(fio2) || 40,
      peep: Number(peep) || 5,
      tidalVolume: Number(tidalVolume) || 0,
      respiratoryRate: Number(respiratoryRate) || 0,
      peakPressure: Number(peakPressure) || 0,
      plateauPressure: Number(plateauPressure) || 0,
      drivingPressure,
      staticCompliance,
      notes: notes.trim(),
      timestamp,
      recordedByUid: currentUser?.uid || '',
      recordedByName: currentUser?.nameAr || currentUser?.nameEn || 'Staff',
    };

    try {
      // 1. Save to local Dexie IndexedDB
      await db.ventilators.put(ventData as any).catch(() => {});

      // 2. Save to Cloud Firestore
      await setDoc(doc(firestore, 'ventilators', id), ventData);

      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      console.warn('Error saving ventilator record:', err);
      setErrorMsg(err?.message || (lang === 'ar' ? 'حدث خطأ أثناء حفظ بيانات جهاز التنفس الصناعي.' : 'Failed to save ventilator parameters.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-xl bg-[#0b1324] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#080f1e] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {lang === 'ar' ? `إعدادات جهاز التنفس الصناعي (سرير ${bedNumber})` : `Mechanical Ventilator Setup (Bed ${bedNumber})`}
              </h3>
              <p className="text-xs text-slate-400">
                {patientName || (lang === 'ar' ? 'توثيق المعلمات الميكانيكية لحظياً' : 'Real-time Mechanical Ventilation Parameters')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-bold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {lang === 'ar' ? 'نمط جهاز التنفس الصناعي (Ventilator Mode)' : 'Ventilator Mode'} *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
              {['SIMV', 'AC_VC', 'AC_PC', 'PSV', 'CPAP', 'BiPAP', 'HighFlow'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-2 px-3 rounded-xl font-mono font-bold transition-all cursor-pointer ${
                    mode === m
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                FiO2 (%) *
              </label>
              <input
                type="number"
                min="21"
                max="100"
                value={fio2}
                onChange={(e) => setFio2(Number(e.target.value))}
                required
                className="w-full bg-[#070e1c] border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                PEEP (cmH2O) *
              </label>
              <input
                type="number"
                min="0"
                max="35"
                value={peep}
                onChange={(e) => setPeep(Number(e.target.value))}
                required
                className="w-full bg-[#070e1c] border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Tidal Volume (mL)
              </label>
              <input
                type="number"
                min="100"
                max="1200"
                value={tidalVolume}
                onChange={(e) => setTidalVolume(Number(e.target.value))}
                className="w-full bg-[#070e1c] border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Resp Rate (bpm)
              </label>
              <input
                type="number"
                min="4"
                max="60"
                value={respiratoryRate}
                onChange={(e) => setRespiratoryRate(Number(e.target.value))}
                className="w-full bg-[#070e1c] border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Peak Press (cmH2O)
              </label>
              <input
                type="number"
                min="0"
                max="80"
                value={peakPressure}
                onChange={(e) => setPeakPressure(Number(e.target.value))}
                className="w-full bg-[#070e1c] border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Pplat (cmH2O)
              </label>
              <input
                type="number"
                min="0"
                max="80"
                value={plateauPressure}
                onChange={(e) => setPlateauPressure(Number(e.target.value))}
                className="w-full bg-[#070e1c] border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Calculated Mechanics */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 text-xs font-mono">
            <div>
              <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'ضغط القيادة (Driving Pressure)' : 'Driving Pressure'}</div>
              <div className="text-sm font-bold text-cyan-300">{drivingPressure} cmH2O</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">{lang === 'ar' ? 'المرونة الاستاتيكية (Compliance)' : 'Static Compliance'}</div>
              <div className="text-sm font-bold text-teal-300">{staticCompliance} mL/cmH2O</div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              {lang === 'ar' ? 'ملاحظات وتوصيات طبيب التنفس' : 'Clinical Ventilator Notes'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'ar' ? 'مثال: تم زيادة PEEP لـ 8 لمنع الانخماص الرئوي...' : 'e.g., Increased PEEP to 8 for alveolar recruitment...'}
              className="w-full bg-[#070e1c] border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>

            {!readOnly && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>{lang === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'حفظ إعدادات جهاز التنفس' : 'Save Parameters'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
