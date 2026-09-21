import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search,
  Archive,
  Trash2
} from 'lucide-react';
import { PatientDossier, BedNumber } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { canDeleteMortalityRecord } from '../services/medicalRecordPermissions.ts';

interface ArchiveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPatientBed: (bedNumber: BedNumber) => void;
  initialSearchTerm?: string;
  initialFilterType?: 'ALL' | 'ACTIVE_ICU' | 'DISCHARGED' | 'ARCHIVED' | 'DECEASED';
}

const formatNumericDate = (dateVal?: string | Date | number): string => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '—';
  }
};

export const ArchiveSearchModal: React.FC<ArchiveSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectPatientBed,
  initialSearchTerm = '',
  initialFilterType = 'ALL',
}) => {
  const { t, lang, isRTL } = useTranslation();
  const { currentUser, user, token } = useAuth();
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  const [allPatients, setAllPatients] = useState<PatientDossier[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE_ICU' | 'DISCHARGED' | 'ARCHIVED' | 'DECEASED'>(initialFilterType);
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);

  const effectiveUser = currentUser || user;
  const isAdmin = canDeleteMortalityRecord(effectiveUser);

  useEffect(() => {
    if (isOpen) {
      loadPatients();
      if (initialSearchTerm) {
        setSearchTerm(initialSearchTerm);
      }
      if (initialFilterType) {
        setFilterType(initialFilterType);
      }
    }
  }, [isOpen, initialSearchTerm, initialFilterType]);

  const loadPatients = async () => {
    const list = await db.patients.toArray();
    setAllPatients(list);
  };

  const handleDeleteMortalityPatient = async (patient: PatientDossier) => {
    if (!isAdmin) {
      alert(lang === 'ar' ? 'غير مصرح: الحذف متاح فقط لمدير النظام (ADMIN).' : 'Unauthorized: Deletion is available for ADMIN only.');
      return;
    }

    const confirmMsg = lang === 'ar'
      ? `هل أنت متأكد من حذف سجل المتوفى للمريض "${patient.fullNameAr || patient.fullNameEn}" (#${patient.mrn}) نهائياً من قاعدة البيانات والمنظومة؟`
      : `Are you sure you want to permanently delete the mortality record for "${patient.fullNameEn}" (#${patient.mrn}) from the database?`;

    if (!confirm(confirmMsg)) return;

    try {
      setDeletingPatientId(patient.id);

      // Server-side permanent deletion
      const res = await fetch('/api/admin/mortality/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'legacy_admin'}`
        },
        body: JSON.stringify({ patientId: patient.id })
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok || (resData && !resData.success)) {
        throw new Error(resData?.message || (lang === 'ar' ? 'فشلت عملية الحذف من السيرفر.' : 'Server deletion failed.'));
      }

      // Local IndexedDB deletion
      await db.patients.delete(patient.id);
      await db.clinicalNotes.where('patientId').equals(patient.id).delete();
      await db.vitals.where('patientId').equals(patient.id).delete();
      await db.patientAntibiotics.where('patientId').equals(patient.id).delete();

      alert(lang === 'ar' ? 'تم حذف ملف حالة الوفاة وكافة سجلاته بنجاح.' : 'Mortality record deleted successfully.');
      await loadPatients();
    } catch (err: any) {
      alert(err?.message || (lang === 'ar' ? 'حدث خطأ أثناء عملية الحذف.' : 'An error occurred during deletion.'));
    } finally {
      setDeletingPatientId(null);
    }
  };

  if (!isOpen) return null;

  const filteredPatients = (allPatients || []).filter((p) => {
    if (!p) return false;
    const q = (searchTerm || '').toLowerCase();
    const mrn = (p.mrn || '').toLowerCase();
    const nameAr = p.fullNameAr || '';
    const nameEn = (p.fullNameEn || '').toLowerCase();
    const diagAr = p.primaryDiagnosisAr || '';
    const diagEn = (p.primaryDiagnosisEn || '').toLowerCase();
    const last4 = p.nationalIdLast4 || (p.nationalId ? p.nationalId.slice(-4) : '');

    const matchesSearch = 
      mrn.includes(q) ||
      nameAr.includes(searchTerm) ||
      nameEn.includes(q) ||
      diagAr.includes(searchTerm) ||
      diagEn.includes(q) ||
      last4.includes(q);

    if (!matchesSearch) return false;
    if (filterType === 'ALL') return true;
    if (filterType === 'ACTIVE_ICU') return p.patientStatus === 'ACTIVE_ICU';
    if (filterType === 'ARCHIVED') return p.archiveStatus === 'ARCHIVED' || p.archiveStatus === 'COLD_STORAGE';
    if (filterType === 'DECEASED') return p.patientStatus === 'EXPIRED_MORTALITY';
    if (filterType === 'DISCHARGED') return p.patientStatus !== 'ACTIVE_ICU' && p.patientStatus !== 'EXPIRED_MORTALITY';
    return true;
  });

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-6xl mx-auto bg-white dark:bg-[#0c1426] border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-xl overflow-hidden transition-colors">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#090f1d] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'أرشيف المرضى والبحث الموحد (MRN Master Index)' : 'MRN Master Archive & Patient Index'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' 
                  ? 'بحث فوري برقم الملف MRN، الاسم، آخر 4 أرقام، والتشخيص الطبي'
                  : 'Universal search by MRN, patient name, last 4 digits, and diagnosis'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-slate-50/60 dark:bg-[#080d19] border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="relative">
            <Search className={`w-4 h-4 text-slate-400 dark:text-slate-500 absolute top-3 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={lang === 'ar' ? "ابحث بالرقم الطبي MRN، اسم المريض بالعربي/الإنجليزي، آخر 4 أرقام، أو التشخيص..." : "Search by MRN, patient name, last 4 digits, or ICD-10 diagnosis..."}
              className={`w-full bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-xl py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-teal-500 focus:outline-none shadow-sm ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'}`}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['ALL', 'ACTIVE_ICU', 'DISCHARGED', 'ARCHIVED', 'DECEASED'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === type
                      ? 'bg-teal-50 border border-teal-400 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40 shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:text-slate-200 dark:border-transparent'
                  }`}
                >
                  {type === 'ALL' && (lang === 'ar' ? 'الكل' : 'All Records')}
                  {type === 'ACTIVE_ICU' && (lang === 'ar' ? 'منوم بالرعاية' : 'Active ICU')}
                  {type === 'DISCHARGED' && (lang === 'ar' ? 'خرج/نُقل' : 'Discharged / Step-Down')}
                  {type === 'ARCHIVED' && (lang === 'ar' ? 'الأرشيف الدائم' : 'Permanent Archive')}
                  {type === 'DECEASED' && (lang === 'ar' ? 'وفيات (أرشيف دائم)' : 'Mortality (Archived)')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2.5">
          {filteredPatients.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              {lang === 'ar' 
                ? 'لا توجد نتائج مطابقة لبحثك في قاعدة البيانات المحلية.'
                : 'No matching records found in the local database.'}
            </div>
          ) : (
            filteredPatients.map((patient) => {
              const isDeceased = patient.patientStatus === 'EXPIRED_MORTALITY';
              const isDischarged = patient.patientStatus !== 'ACTIVE_ICU' && !isDeceased;
              const isActive = patient.patientStatus === 'ACTIVE_ICU';

              return (
                <div
                  key={patient.id}
                  className="bg-white hover:bg-slate-50 dark:bg-[#0f172a] dark:hover:bg-[#131d35] border border-slate-200 dark:border-slate-800/90 rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {patient.fullNameAr || patient.fullNameEn}
                      </span>
                      <span className="font-mono text-xs text-teal-700 dark:text-teal-400 font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60">
                        #{patient.mrn}
                      </span>
                      {isActive && patient.currentBedId && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700">
                          {lang === 'ar' ? `منوم بسرير ${patient.currentBedId}` : `Admitted in Bed ${patient.currentBedId}`}
                        </span>
                      )}
                      {isDeceased && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
                          {lang === 'ar' ? 'متوفى (أرشيف دائم للقراءة فقط)' : 'Deceased (Permanent Read-Only Archive)'}
                        </span>
                      )}
                      {isDischarged && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                          {lang === 'ar' ? 'نُقل للجناح / خرج' : 'Discharged / Step-Down'}
                        </span>
                      )}
                      {(patient.archiveStatus === 'ARCHIVED' || patient.archiveStatus === 'COLD_STORAGE') && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/80">
                          {lang === 'ar' ? 'مؤرشف دائم' : 'Archived Tier'}
                        </span>
                      )}
                      {(patient.nationalIdLast4 || patient.nationalId) && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-transparent">
                          ID: ****{patient.nationalIdLast4 || (patient.nationalId ? patient.nationalId.slice(-4) : '')}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      {lang === 'ar' 
                        ? (patient.primaryDiagnosisAr || patient.primaryDiagnosisEn) 
                        : (patient.primaryDiagnosisEn || patient.primaryDiagnosisAr)}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                      <span>{lang === 'ar' ? `العمر: ${patient.age} سنة` : `Age: ${patient.age} yo`}</span>
                      <span>•</span>
                      <span>{lang === 'ar' ? `كود الإنعاش: ${patient.codeStatus}` : `Code: ${patient.codeStatus}`}</span>
                      <span>•</span>
                      <span>{lang === 'ar' ? `تاريخ الدخول: ${formatNumericDate(patient.admissionDate)}` : `Admitted: ${formatNumericDate(patient.admissionDate)}`}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isActive && patient.currentBedId && (
                      <button
                        onClick={() => {
                          onSelectPatientBed(patient.currentBedId!);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white dark:bg-teal-500/20 dark:hover:bg-teal-500/30 dark:text-teal-300 dark:border dark:border-teal-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        {lang === 'ar' ? `فتح سرير ${patient.currentBedId}` : `Open Bed ${patient.currentBedId}`}
                      </button>
                    )}

                    {isDeceased && isAdmin && (
                      <button
                        onClick={() => handleDeleteMortalityPatient(patient)}
                        disabled={deletingPatientId === patient.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        title={lang === 'ar' ? 'حذف سجل الوفاة من قاعدة البيانات نهائياً (ADMIN)' : 'Delete mortality record permanently (ADMIN)'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{deletingPatientId === patient.id ? (lang === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (lang === 'ar' ? 'حذف نهائي' : 'Delete Record')}</span>
                      </button>
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
