import React from 'react';
import { 
  BedRecord, 
  PatientDossier, 
  BedStatus, 
  BedNumber 
} from '../types/schema.ts';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface BedMatrixCardProps {
  bed: BedRecord;
  patient?: PatientDossier | null;
  onSelectBed: (bedNumber: BedNumber) => void;
  onAdmitToBed: (bedNumber: BedNumber) => void;
}

export const BedMatrixCard: React.FC<BedMatrixCardProps> = ({
  bed,
  patient,
  onSelectBed,
  onAdmitToBed,
}) => {
  const { lang } = useTranslation();
  
  const isIsolation = bed.status === BedStatus.ISOLATION || (bed.isolation?.isIsolated ?? false);
  const isUnavailable = bed.status === BedStatus.UNAVAILABLE;
  const isOccupied = (bed.status === BedStatus.OCCUPIED || isIsolation) && !!patient;
  const isTransferPending = bed.status === BedStatus.TRANSFER_PENDING && !!patient;
  const isDecontaminating = bed.status === BedStatus.DECONTAMINATING;
  const isVacant = (bed.status === BedStatus.VACANT || (!patient && !isDecontaminating && !isUnavailable && !isIsolation));

  const handleClick = () => {
    if (isOccupied || isTransferPending || isUnavailable || isDecontaminating) {
      onSelectBed(bed.bedNumber);
    } else {
      onAdmitToBed(bed.bedNumber);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between p-4 min-h-[120px] shadow-lg cursor-pointer hover:scale-[1.01] hover:shadow-xl ${
        isUnavailable
          ? 'bg-[#100f1a] border-red-900/50 opacity-90'
          : isIsolation
          ? 'bg-gradient-to-b from-[#1c1409] to-[#0f0c08] border-amber-600/60 shadow-amber-950/20'
          : isTransferPending
          ? 'bg-[#0f172a] border-amber-500/40'
          : isDecontaminating
          ? 'bg-[#0c1222] border-purple-500/30'
          : isOccupied
          ? 'bg-gradient-to-b from-[#0f172c] to-[#090e1a] border-slate-700/80 hover:border-teal-500/50'
          : 'bg-[#0a0f1d] border-slate-800/60 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Bed Number / Status */}
        <div className="flex items-center gap-2.5">
          <div className={`w-12 h-12 rounded-xl font-mono font-black text-xl flex items-center justify-center shadow-md ${
            isUnavailable
              ? 'bg-red-950 text-red-400 border border-red-800'
              : isIsolation
              ? 'bg-red-950 text-red-500 border border-red-800/80 animate-pulse'
              : isOccupied 
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            {bed.bedNumber}
          </div>
          <div>
            <div className="text-base font-bold text-white tracking-wide">
              {lang === 'ar' ? `سرير ${bed.bedNumber}` : `Bed ${bed.bedNumber}`}
            </div>
            <div className="text-xs text-slate-400 truncate max-w-[130px]">
              {bed.bayName}
            </div>
          </div>
        </div>

        {/* Dynamic Status Label */}
        <div className="text-xs font-bold px-2 py-0.5 rounded-md font-mono">
          {isIsolation && (
            <span className="bg-amber-950 text-amber-300 border border-amber-600/70 px-1.5 py-0.5 rounded">
              {lang === 'ar' ? 'عزل' : 'Isolation'}
            </span>
          )}
          {isUnavailable && (
            <span className="bg-red-950 text-red-300 border border-red-800 px-1.5 py-0.5 rounded">
              {lang === 'ar' ? 'غير متاح' : 'Unavailable'}
            </span>
          )}
          {isTransferPending && (
            <span className="bg-amber-950 text-amber-300 border border-amber-700 px-1.5 py-0.5 rounded">
              {lang === 'ar' ? 'نقل معلق' : 'Transfer Pending'}
            </span>
          )}
          {isDecontaminating && (
            <span className="bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded">
              {lang === 'ar' ? 'تطهير' : 'Cleaning'}
            </span>
          )}
          {isVacant && (
            <span className="bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
              {lang === 'ar' ? 'شاغر' : 'Vacant'}
            </span>
          )}
          {isOccupied && !isIsolation && (
            <span className="bg-teal-950 text-teal-300 border border-teal-800 px-1.5 py-0.5 rounded">
              {lang === 'ar' ? 'مشغول' : 'Occupied'}
            </span>
          )}
        </div>
      </div>

      {/* Patient Name or Status Text */}
      <div className="mt-4">
        {isOccupied || isTransferPending ? (
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white truncate">
              {patient?.fullNameAr || patient?.fullNameEn}
              {patient?.age ? <span className="text-xs text-slate-400 font-normal ml-2">{patient.age}y</span> : ''}
            </h2>
            <div className="text-xs text-teal-300 truncate mt-0.5">
              {patient?.diagnosisAr || patient?.diagnosisEn || (lang === 'ar' ? 'بدون تشخيص' : 'No diagnosis')}
            </div>
          </div>
        ) : isDecontaminating ? (
          <div className="text-xs font-semibold text-purple-300">
            {lang === 'ar' ? 'قيد التعقيم والتطهير الشامل' : 'Decontamination in progress'}
          </div>
        ) : isUnavailable ? (
          <div className="text-xs font-semibold text-red-400">
            {lang === 'ar' ? 'خارج الخدمة حالياً' : 'Bed Out of Service'}
          </div>
        ) : (
          <div className="text-xs font-semibold text-teal-500/80">
            {lang === 'ar' ? '+ اضغط لتسجيل مريض جديد' : '+ Click to Admit Patient'}
          </div>
        )}
      </div>
    </div>
  );
};
