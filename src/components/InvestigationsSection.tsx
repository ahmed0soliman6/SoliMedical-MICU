import React, { useState } from 'react';
import { 
  Scan, 
  Plus, 
  FileText, 
  Clock, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Search,
  Activity,
  Image as ImageIcon,
  Pencil,
  Trash2,
  Edit3
} from 'lucide-react';
import { InvestigationItem } from '../types/schema.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { db } from '../db/icuSyncDb.ts';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase.ts';

interface InvestigationsSectionProps {
  patientId: string;
  bedNumber: string;
  investigations: InvestigationItem[];
  onInvestigationAdded: () => void;
}

const MODALITY_PRESETS = [
  { id: 'Chest X-Ray', labelAr: 'أشعة الصدر (Chest X-Ray)', labelEn: 'Chest X-Ray' },
  { id: 'CT', labelAr: 'أشعة مقطعية (CT Scan)', labelEn: 'CT Scan' },
  { id: 'MRI', labelAr: 'رنين مغناطيسي (MRI)', labelEn: 'MRI' },
  { id: 'Ultrasound', labelAr: 'موجات صوتية / سونار (Ultrasound / POCUS)', labelEn: 'Ultrasound / POCUS' },
  { id: 'ECG', labelAr: 'تخطيط قلب 12-قناة (12-Lead ECG)', labelEn: '12-Lead ECG' },
  { id: 'Echo', labelAr: 'إيكو قلب (Echocardiography)', labelEn: 'Echocardiography' },
  { id: 'Other', labelAr: 'فحص إضافي / حر', labelEn: 'Other Modality' },
];

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

export const InvestigationsSection: React.FC<InvestigationsSectionProps> = ({
  patientId,
  bedNumber,
  investigations,
  onInvestigationAdded,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InvestigationItem | null>(null);

  // Form states
  const [modality, setModality] = useState<string>('Chest X-Ray');
  const [testName, setTestName] = useState<string>('Portable CXR AP view');
  const [status, setStatus] = useState<'ORDERED' | 'RESULTED' | 'REPORTED'>('REPORTED');
  const [resultReport, setResultReport] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString().slice(0, 16));
  const [isSaving, setIsSaving] = useState(false);

  const patientInvestigations = (investigations || []).filter(inv => inv && inv.patientId === patientId);

  const handleModalityChange = (m: string) => {
    setModality(m);
    if (!editingItem) {
      if (m === 'Chest X-Ray') setTestName('Portable CXR (AP View)');
      else if (m === 'CT') setTestName('CT Brain non-contrast');
      else if (m === 'MRI') setTestName('Brain MRI');
      else if (m === 'Ultrasound') setTestName('Bedside POCUS / Abdominal US');
      else if (m === 'ECG') setTestName('12-Lead Bedside ECG');
      else if (m === 'Echo') setTestName('Transthoracic Echocardiogram (TTE)');
      else setTestName('');
    }
  };

  const handleOpenAddModal = (presetModality?: string) => {
    setEditingItem(null);
    const m = presetModality || 'Chest X-Ray';
    setModality(m);
    if (m === 'Chest X-Ray') setTestName('Portable CXR (AP View)');
    else if (m === 'CT') setTestName('CT Brain non-contrast');
    else if (m === 'MRI') setTestName('Brain MRI');
    else if (m === 'Ultrasound') setTestName('Bedside POCUS / Abdominal US');
    else if (m === 'ECG') setTestName('12-Lead Bedside ECG');
    else if (m === 'Echo') setTestName('Transthoracic Echocardiogram (TTE)');
    else setTestName('');
    
    setResultReport('');
    setNotes('');
    setStatus('REPORTED');
    setTimestamp(new Date().toISOString().slice(0, 16));
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: InvestigationItem) => {
    setEditingItem(item);
    setModality(item.modality);
    setTestName(item.testName);
    setStatus(item.status);
    setResultReport(item.resultReport || '');
    setNotes(item.notes || '');
    try {
      setTimestamp(new Date(item.timestamp).toISOString().slice(0, 16));
    } catch {
      setTimestamp(new Date().toISOString().slice(0, 16));
    }
    setIsAddModalOpen(true);
  };

  const handleDelete = async (inv: InvestigationItem) => {
    if (!window.confirm(lang === 'ar' ? `هل أنت متأكد من حذف تقرير ${inv.testName}؟` : `Are you sure you want to delete ${inv.testName}?`)) {
      return;
    }
    try {
      await db.investigations.delete(inv.id);
      try {
        const docRef = doc(firestore, 'medical_records', inv.id);
        await deleteDoc(docRef);
      } catch (cloudErr) {
        console.warn('Firestore delete investigation error:', cloudErr);
      }
      onInvestigationAdded();
    } catch (err) {
      console.error('Failed to delete investigation:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim()) return;

    setIsSaving(true);
    try {
      const userDisplay = currentUser?.nameAr || currentUser?.nameEn || currentUser?.email || 'الطبيب المناوب';
      
      if (editingItem) {
        // Edit existing record
        const updatedRecord: InvestigationItem = {
          ...editingItem,
          modality,
          testName: testName.trim(),
          timestamp: new Date(timestamp).toISOString(),
          status,
          resultReport: resultReport.trim(),
          notes: notes.trim() || undefined,
          lastModifiedByName: userDisplay,
          lastModifiedByStaffId: currentUser?.badgeId || currentUser?.uid,
          lastModifiedAt: new Date().toISOString(),
        };

        // 1. Dexie update
        await db.investigations.put(updatedRecord);

        // 2. Firestore update
        try {
          const docRef = doc(firestore, 'medical_records', editingItem.id);
          await setDoc(docRef, {
            ...updatedRecord,
            recordType: 'INVESTIGATION',
            updatedAt: Date.now(),
          }, { merge: true });
        } catch (cloudErr) {
          console.warn('Firestore investigation sync update error:', cloudErr);
        }
      } else {
        // Add new record
        const invId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        const newRecord: InvestigationItem = {
          id: invId,
          patientId,
          bedNumber,
          modality,
          testName: testName.trim(),
          timestamp: new Date(timestamp).toISOString(),
          status,
          resultReport: resultReport.trim(),
          notes: notes.trim() || undefined,
          recordedByName: userDisplay,
          recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
        };

        // 1. Dexie local database
        await db.investigations.put(newRecord);

        // 2. Firestore SSOT
        try {
          const docRef = doc(firestore, 'medical_records', invId);
          await setDoc(docRef, {
            ...newRecord,
            recordType: 'INVESTIGATION',
            createdAt: Date.now(),
          });
        } catch (cloudErr) {
          console.warn('Firestore investigation sync error:', cloudErr);
        }
      }

      onInvestigationAdded();
      setIsAddModalOpen(false);
      setEditingItem(null);
      setResultReport('');
      setNotes('');
    } catch (err) {
      console.error('Failed to save investigation:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sleek Action Bar inside Card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 bg-[#070c18] rounded-xl border border-slate-800/80">
        <button
          type="button"
          onClick={() => handleOpenAddModal('Chest X-Ray')}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'ar' ? 'إضافة فحص / تقرير' : 'Add Investigation / Report'}</span>
        </button>

        <div className="flex items-center justify-between sm:justify-end gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
          <span className="text-slate-400 text-[11px]">{lang === 'ar' ? 'عدد الفحوصات المسجلة:' : 'Recorded Studies:'}</span>
          <span className="font-bold text-teal-300 px-2 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/30">
            {patientInvestigations.length}
          </span>
        </div>
      </div>

      {/* Studies List */}
      {patientInvestigations.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800 space-y-3">
          <Scan className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">
            {lang === 'ar' 
              ? 'لا توجد فحوصات أو أشعات مسجلة لهذا المريض بعد.' 
              : 'No radiology or investigations recorded for this patient.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {MODALITY_PRESETS.slice(0, 6).map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleOpenAddModal(m.id)}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 cursor-pointer"
              >
                + {m.id}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {patientInvestigations
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((inv) => (
              <div 
                key={inv.id}
                className="p-3.5 rounded-xl bg-[#0d1527] border border-slate-800/80 hover:border-slate-700 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono">
                      {inv.modality}
                    </span>
                    <h4 className="text-xs font-bold text-white">
                      {inv.testName}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inv.status === 'REPORTED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : inv.status === 'RESULTED'
                        ? 'bg-teal-950 text-teal-300 border border-teal-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {inv.status === 'REPORTED' ? (lang === 'ar' ? 'تقرير معتمد' : 'Reported') :
                       inv.status === 'RESULTED' ? (lang === 'ar' ? 'نتيجة أولية' : 'Resulted') :
                       (lang === 'ar' ? 'طلب معلق' : 'Ordered')}
                    </span>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(inv)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer shadow-sm active:scale-95"
                      title={lang === 'ar' ? 'تعديل التقرير والفحص' : 'Edit Report & Details'}
                    >
                      <Pencil className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(inv)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                      title={lang === 'ar' ? 'حذف الفحص' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Report Content */}
                {inv.resultReport ? (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {inv.resultReport}
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-slate-950/40 border border-dashed border-slate-800 text-[11px] text-slate-500 italic">
                    {lang === 'ar' ? 'لم يتم إدخال نص تقرير مكتوب بعد.' : 'No written findings/report provided yet.'}
                  </div>
                )}

                {/* Footer details: recorded time, recorder, and last modified doctor */}
                <div className="pt-2 border-t border-slate-800/60 space-y-1.5 text-[11px]">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400">
                    <span className="truncate max-w-md">
                      {inv.notes ? `${lang === 'ar' ? 'ملاحظة: ' : 'Note: '}${inv.notes}` : ''}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[10px]">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatNumericDate(inv.timestamp)} {new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      <span className="text-slate-300 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{lang === 'ar' ? 'بواسطة: ' : 'By: '}{inv.recordedByName}</span>
                      </span>
                    </div>
                  </div>

                  {/* Show who edited the report if modified */}
                  {inv.lastModifiedByName && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                      <Edit3 className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>
                        {lang === 'ar' ? 'تم التعديل بواسطة: ' : 'Edited by: '}
                        <strong className="font-semibold text-amber-200">{inv.lastModifiedByName}</strong>
                        {inv.lastModifiedAt && (
                          <span className="text-slate-400 font-mono ml-1 mr-1">
                            • {formatNumericDate(inv.lastModifiedAt)} {new Date(inv.lastModifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Add / Edit Investigation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  {editingItem ? <Pencil className="w-5 h-5" /> : <Scan className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editingItem 
                      ? (lang === 'ar' ? 'تعديل الفحص / تقرير الأشعة' : 'Edit Investigation Report')
                      : (lang === 'ar' ? 'تسجيل فحص أو تقرير جديد' : 'Add Investigation / Diagnostic Study')}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {editingItem
                      ? (lang === 'ar' ? 'تعديل النتائج وسيتم توثيق اسمك وتوقيت التعديل تلقائياً' : 'Update report findings; editor and timestamp will be logged')
                      : (lang === 'ar' ? 'توثيق تقرير الأشعة وتخطيط القلب وفحوصات السرير' : 'Record radiology report, ECG, or ultrasound')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingItem(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
              {/* Modality Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'ar' ? 'نوع الفحص (Modality):' : 'Investigation Modality:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {MODALITY_PRESETS.map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => handleModalityChange(m.id)}
                      className={`p-2 rounded-xl text-xs text-center border transition-all cursor-pointer ${
                        modality === m.id
                          ? 'bg-teal-500 text-slate-950 font-bold shadow'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {m.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'اسم الفحص الدقيق' : 'Study Specific Name'}
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: Portable CXR AP view, CT Brain without contrast...' : 'e.g. Portable CXR, 12-lead ECG...'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              {/* Status & Timestamp */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'حالة الفحص' : 'Status'}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="REPORTED">{lang === 'ar' ? 'تقرير معتمد (Reported)' : 'Reported'}</option>
                    <option value="RESULTED">{lang === 'ar' ? 'نتيجة أولية (Resulted)' : 'Resulted'}</option>
                    <option value="ORDERED">{lang === 'ar' ? 'طلب معلق (Ordered)' : 'Ordered'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}
                  </label>
                  <input
                    type="datetime-local"
                    value={timestamp}
                    onChange={(e) => setTimestamp(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Report / Findings */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'النتيجة أو نص التقرير الطبي' : 'Report Findings / Impression'}
                </label>
                <textarea
                  value={resultReport}
                  onChange={(e) => setResultReport(e.target.value)}
                  placeholder={lang === 'ar' ? 'أدخل نص التقرير، النتائج الإشعاعية، انطباع الطبيب...' : 'Enter findings, radiological impression, acute abnormalities...'}
                  rows={4}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-sans"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'ملاحظات سريرية إضافية' : 'Clinical Notes'}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: فحص بجانب السرير، مقارنة مع الفحص السابق...' : 'e.g. Bedside portable study, compared with baseline...'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingItem(null);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !testName.trim()}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving 
                    ? (lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...') 
                    : (editingItem ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (lang === 'ar' ? 'حفظ الفحص' : 'Save Investigation'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

