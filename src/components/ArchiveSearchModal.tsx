import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Search, 
  Trash2,
  Loader2
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { PatientDossier, BedNumber } from '../types/schema.ts';
import { db } from '../db/icuSyncDb.ts';
import { firestore } from '../services/firebase.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { canDeleteMortalityRecord } from '../services/medicalRecordPermissions.ts';

interface ArchiveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPatientBed: (bedNumber: BedNumber) => void;
  onViewReadOnlyPatient: (patient: PatientDossier) => void;
  initialSearchTerm?: string;
  initialFilterType?: 'ALL' | 'ACTIVE_ICU' | 'DISCHARGED' | 'TRANSFERRED' | 'EXPIRED_MORTALITY' | 'ARCHIVED';
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
  onViewReadOnlyPatient,
  initialSearchTerm = '',
  initialFilterType = 'ALL',
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser, user, token } = useAuth();
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  const [allPatients, setAllPatients] = useState<PatientDossier[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'ALL' | 'ACTIVE_ICU' | 'DISCHARGED' | 'TRANSFERRED' | 'EXPIRED_MORTALITY' | 'ARCHIVED'>(initialFilterType);
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);

  const effectiveUser = currentUser || user;
  const isAdmin = canDeleteMortalityRecord(effectiveUser);

  const loadPatients = useCallback(async () => {
    setIsLoading(true);

    // 1. Load initial cache from Dexie IndexedDB for instant UI responsiveness
    try {
      const localList = await db.patients.toArray();
      if (localList && localList.length > 0) {
        setAllPatients(localList);
      }
    } catch (localErr) {
      console.warn('Dexie cache read notice:', localErr);
    }

    // 2. Fetch directly from Firestore collections 'patients' and 'archivedPatients' as Primary Source of Truth
    try {
      const [activeSnap, archiveSnap] = await Promise.all([
        getDocs(collection(firestore, 'patients')).catch((e) => {
          console.warn('Firestore active patients fetch error:', e);
          return null;
        }),
        getDocs(collection(firestore, 'archivedPatients')).catch((e) => {
          console.warn('Firestore archived patients fetch error:', e);
          return null;
        }),
      ]);

      const patientMap = new Map<string, PatientDossier>();

      // Populate from active patients collection
      if (activeSnap && !activeSnap.empty) {
        activeSnap.docs.forEach((d) => {
          const data = d.data() as PatientDossier;
          const patientId = data.id || (data as any).patientId || d.id;
          if (patientId) {
            patientMap.set(patientId, {
              ...data,
              id: patientId,
            });
          }
        });
      }

      // Populate from archivedPatients collection (Deduplicate by patientId: if already in map, keep once)
      if (archiveSnap && !archiveSnap.empty) {
        archiveSnap.docs.forEach((d) => {
          const data = d.data() as PatientDossier;
          const patientId = data.id || (data as any).patientId || d.id;
          if (patientId && !patientMap.has(patientId)) {
            patientMap.set(patientId, {
              ...data,
              id: patientId,
              archiveStatus: data.archiveStatus || 'ARCHIVED',
            });
          }
        });
      }

      // If online data was fetched, update state with combined deduplicated records
      if (patientMap.size > 0) {
        const combined = Array.from(patientMap.values());
        setAllPatients(combined);

        // Update local Dexie cache asynchronously
        try {
          await db.patients.bulkPut(combined);
        } catch {}
      }
    } catch (cloudErr) {
      console.warn('Firestore direct fetch error in ArchiveSearchModal, relying on local cache:', cloudErr);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
  }, [isOpen, initialSearchTerm, initialFilterType, loadPatients]);

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
          'Authorization': `Bearer ${token || ''}`
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
    const q = (searchTerm || '').trim().toLowerCase();
    const mrn = (p.mrn || '').toLowerCase();
    const nameAr = (p.fullNameAr || '').toLowerCase();
    const nameEn = (p.fullNameEn || '').toLowerCase();
    const legacyName = ((p as any).patientName || '').toLowerCase();
    const diagAr = (p.primaryDiagnosisAr || '').toLowerCase();
    const diagEn = (p.primaryDiagnosisEn || '').toLowerCase();
    const legacyDiag = ((p as any).diagnosis || '').toLowerCase();
    const secDiag = ((p as any).secondaryDiagnosis || '').toLowerCase();
    const last4 = (p.nationalIdLast4 || (p.nationalId ? p.nationalId.slice(-4) : '') || ((p as any).idNumber ? (p as any).idNumber.slice(-4) : '')).toLowerCase();
    const fullId = (p.nationalId || (p as any).idNumber || '').toLowerCase();

    const matchesSearch = 
      !q ||
      mrn.includes(q) ||
      nameAr.includes(q) ||
      nameEn.includes(q) ||
      legacyName.includes(q) ||
      diagAr.includes(q) ||
      diagEn.includes(q) ||
      legacyDiag.includes(q) ||
      secDiag.includes(q) ||
      last4.includes(q) ||
      fullId.includes(q);

    if (!matchesSearch) return false;

    // Status filtering
    const isDeceased = p.patientStatus === 'EXPIRED_MORTALITY' || (p as any).currentStatus === 'EXPIRED';
    const isActive = p.patientStatus === 'ACTIVE_ICU' || (p as any).currentStatus === 'ACTIVE_ICU';
    const isTransferred = p.patientStatus === 'TRANSFERRED_EXTERNAL' || 
                          (p as any).currentStatus === 'TRANSFERRED' ||
                          (typeof p.patientStatus === 'string' && p.patientStatus.includes('TRANSFER')) ||
                          (typeof (p as any).currentStatus === 'string' && (p as any).currentStatus.includes('TRANSFER'));
    const isDischarged = (
      p.patientStatus === 'DISCHARGED_STEPDOWN' || 
      p.patientStatus === 'DISCHARGED_HOME' || 
      (p as any).currentStatus === 'DISCHARGED' || 
      (p as any).currentStatus === 'DISCHARGED_HOME' ||
      (p as any).currentStatus === 'DISCHARGED_STEPDOWN' ||
      (typeof p.patientStatus === 'string' && p.patientStatus.includes('DISCHARGE')) ||
      (typeof (p as any).currentStatus === 'string' && (p as any).currentStatus.includes('DISCHARGE')) ||
      (!isActive && !isDeceased && !isTransferred && p.archiveStatus !== 'ARCHIVED' && p.archiveStatus !== 'COLD_STORAGE')
    );
    const isArchived = p.archiveStatus === 'ARCHIVED' || p.archiveStatus === 'COLD_STORAGE' || (p as any).isArchived === true;

    if (filterType === 'ALL') return true;
    if (filterType === 'ACTIVE_ICU') return isActive;
    if (filterType === 'DISCHARGED') return isDischarged && !isActive && !isDeceased;
    if (filterType === 'TRANSFERRED') return isTransferred && !isActive && !isDeceased;
    if (filterType === 'EXPIRED_MORTALITY') return isDeceased;
    if (filterType === 'ARCHIVED') return isArchived;
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
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'أرشيف المرضى والبحث الموحد (MRN Master Index)' : 'MRN Master Archive & Patient Index'}
                </h3>
                {isLoading && (
                  <span className="flex items-center gap-1 text-[11px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 px-2 py-0.5 rounded-md">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{lang === 'ar' ? 'مزامنة السحابة...' : 'Cloud Syncing...'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' 
                  ? 'بحث سحابي ومحلي فوري برقم الملف MRN، الاسم، آخر 4 أرقام، والتشخيص الطبي'
                  : 'Universal cloud and local search by MRN, patient name, last 4 digits, and diagnosis'}
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
              {([
                { id: 'ALL', labelAr: 'الكل', labelEn: 'All Records' },
                { id: 'ACTIVE_ICU', labelAr: 'منوم بالرعاية (ACTIVE_ICU)', labelEn: 'Active ICU' },
                { id: 'DISCHARGED', labelAr: 'خرج (DISCHARGED)', labelEn: 'Discharged' },
                { id: 'TRANSFERRED', labelAr: 'نقل (TRANSFERRED)', labelEn: 'Transferred' },
                { id: 'EXPIRED_MORTALITY', labelAr: 'وفيات (EXPIRED_MORTALITY)', labelEn: 'Mortality' },
                { id: 'ARCHIVED', labelAr: 'الأرشيف الدائم (ARCHIVED / COLD_STORAGE)', labelEn: 'Archived / Cold Storage' },
              ] as const).map((filterItem) => (
                <button
                  key={filterItem.id}
                  onClick={() => setFilterType(filterItem.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filterType === filterItem.id
                      ? 'bg-teal-50 border border-teal-400 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/40 shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:text-slate-200 dark:border-transparent'
                  }`}
                >
                  {lang === 'ar' ? filterItem.labelAr : filterItem.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2.5">
          {filteredPatients.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
              {isLoading 
                ? (lang === 'ar' ? 'جاري جلب السجلات من السحابة وقاعدة البيانات...' : 'Fetching records from Firestore cloud and database...')
                : (lang === 'ar' ? 'لا توجد نتائج مطابقة لبحثك في السجلات.' : 'No matching records found.')}
            </div>
          ) : (
            filteredPatients.map((patient) => {
              const isDeceased = patient.patientStatus === 'EXPIRED_MORTALITY' || (patient as any).currentStatus === 'EXPIRED';
              const isActive = patient.patientStatus === 'ACTIVE_ICU' || (patient as any).currentStatus === 'ACTIVE_ICU';
              const isTransferred = patient.patientStatus === 'TRANSFERRED_EXTERNAL' || 
                                    (patient as any).currentStatus === 'TRANSFERRED' ||
                                    (typeof patient.patientStatus === 'string' && patient.patientStatus.includes('TRANSFER')) ||
                                    (typeof (patient as any).currentStatus === 'string' && (patient as any).currentStatus.includes('TRANSFER'));
              const isDischarged = !isActive && !isDeceased && !isTransferred;
              const isArchivedTier = patient.archiveStatus === 'ARCHIVED' || patient.archiveStatus === 'COLD_STORAGE' || (patient as any).isArchived === true;

              return (
                <div
                  key={patient.id}
                  className="bg-white hover:bg-slate-50 dark:bg-[#0f172a] dark:hover:bg-[#131d35] border border-slate-200 dark:border-slate-800/90 rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {patient.fullNameAr || patient.fullNameEn || (patient as any).patientName || 'Patient'}
                      </span>
                      <span className="font-mono text-xs text-teal-700 dark:text-teal-400 font-semibold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60">
                        #{patient.mrn}
                      </span>
                      {isActive && patient.currentBedId && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700">
                          {lang === 'ar' ? `منوم بسرير ${patient.currentBedId} (ACTIVE_ICU)` : `Admitted Bed ${patient.currentBedId} (ACTIVE_ICU)`}
                        </span>
                      )}
                      {isDeceased && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700">
                          {lang === 'ar' ? 'متوفى (EXPIRED_MORTALITY)' : 'Deceased (EXPIRED_MORTALITY)'}
                        </span>
                      )}
                      {isTransferred && !isDeceased && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                          {lang === 'ar' ? 'نُقل لقسم آخر (TRANSFERRED)' : 'Transferred (TRANSFERRED)'}
                        </span>
                      )}
                      {isDischarged && !isTransferred && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                          {lang === 'ar' ? 'خروج (DISCHARGED)' : 'Discharged (DISCHARGED)'}
                        </span>
                      )}
                      {isArchivedTier && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/80">
                          {lang === 'ar' ? 'أرشيف دائم (ARCHIVED)' : 'Permanent Archive (ARCHIVED)'}
                        </span>
                      )}
                      {(patient.nationalIdLast4 || patient.nationalId || (patient as any).idNumber) && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-transparent">
                          ID: ****{patient.nationalIdLast4 || (patient.nationalId ? patient.nationalId.slice(-4) : '') || ((patient as any).idNumber ? (patient as any).idNumber.slice(-4) : '')}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      {lang === 'ar' 
                        ? (patient.primaryDiagnosisAr || patient.primaryDiagnosisEn || (patient as any).diagnosis) 
                        : (patient.primaryDiagnosisEn || patient.primaryDiagnosisAr || (patient as any).diagnosis)}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                      <span>{lang === 'ar' ? `العمر: ${patient.age || '—'} سنة` : `Age: ${patient.age || '—'} yo`}</span>
                      <span>•</span>
                      <span>{lang === 'ar' ? `كود الإنعاش: ${patient.codeStatus || 'FULL_CODE'}` : `Code: ${patient.codeStatus || 'FULL_CODE'}`}</span>
                      <span>•</span>
                      <span>{lang === 'ar' ? `تاريخ الدخول: ${formatNumericDate(patient.admissionDate)}` : `Admitted: ${formatNumericDate(patient.admissionDate)}`}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 font-sans">
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

                    {!isActive && (
                      <button
                        onClick={() => {
                          onViewReadOnlyPatient(patient);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500/20 dark:hover:bg-indigo-500/30 dark:text-indigo-300 dark:border dark:border-indigo-500/40 text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        {lang === 'ar' ? 'فتح الملف (للقراءة فقط)' : 'Open File (Read-Only)'}
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
