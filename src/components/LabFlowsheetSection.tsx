import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  TrendingUp, 
  FileSpreadsheet, 
  Camera, 
  FlaskConical 
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { db } from '../db/icuSyncDb.ts';
import { LabResultItem } from '../types/schema.ts';
import { syncLabResultToCloud, deleteLabResultFromCloud } from '../services/firebase.ts';
import { AiLabScannerModal } from './AiLabScannerModal.tsx';

interface LabFlowsheetSectionProps {
  patientId: string;
  bedNumber: string;
  readOnly?: boolean;
  onDataUpdated?: () => void;
}

export function getCategoryForTest(testName: string, fallbackList: any[] = []): string {
  if (fallbackList && fallbackList.length > 0 && fallbackList[0]?.category) {
    return fallbackList[0].category;
  }
  const name = testName.toLowerCase().trim();
  if (name.includes('wbc') || name.includes('hgb') || name.includes('plt') || name.includes('cbc') || name.includes('platelet') || name.includes('white blood')) {
    return 'Hematology';
  }
  if (name.includes('sodium') || name.includes('potassium') || name.includes('creatinine') || name.includes('bun') || name.includes('urea') || name.includes('lft') || name.includes('bilirubin')) {
    return 'Chemistry';
  }
  if (name.includes('ph') || name.includes('pco2') || name.includes('po2') || name.includes('hco3') || name.includes('abg') || name.includes('lactate')) {
    return 'Arterial Blood Gas';
  }
  if (name.includes('crp') || name.includes('pct') || name.includes('procalcitonin') || name.includes('esr')) {
    return 'Inflammatory Markers';
  }
  return 'General Labs';
}

export const LabFlowsheetSection: React.FC<LabFlowsheetSectionProps> = ({
  patientId,
  bedNumber,
  readOnly = false,
  onDataUpdated
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();

  const [labs, setLabs] = useState<LabResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);

  // Form State
  const [testName, setTestName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [isCritical, setIsCritical] = useState(false);
  const [notes, setNotes] = useState('');

  const loadLabs = async () => {
    try {
      const list = await db.labResults.where('patientId').equals(patientId).reverse().sortBy('timestamp');
      setLabs(list || []);
    } catch (e) {
      console.warn('Error loading lab results from local Dexie:', e);
    }
  };

  useEffect(() => {
    loadLabs();
  }, [patientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim() || !value.trim()) return;

    setLoading(true);
    const category = getCategoryForTest(testName);
    const labId = `lab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nowIso = new Date().toISOString();

    const record: LabResultItem = {
      id: labId,
      patientId,
      bedNumber,
      testName: testName.trim(),
      value: value.trim(),
      unit: unit.trim(),
      category,
      isCritical,
      timestamp: nowIso,
      recordedByStaffId: currentUser?.badgeId || currentUser?.uid || 'system',
      recordedByName: currentUser?.nameEn || currentUser?.email || 'System',
      notes: notes.trim() || undefined,
    };

    try {
      await db.labResults.put(record);
      await syncLabResultToCloud(record).catch(err => {
        console.warn('Firestore lab result sync exception:', err);
      });
      
      setTestName('');
      setValue('');
      setUnit('');
      setIsCritical(false);
      setNotes('');
      setShowAddModal(false);
      
      await loadLabs();
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Failed to save lab result:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (readOnly) return;
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف نتيجة هذا التحليل السريري؟' : 'Are you sure you want to delete this lab result?')) {
      return;
    }

    try {
      await db.labResults.delete(id);
      await deleteLabResultFromCloud(id).catch(err => {
        console.warn('Firestore lab delete exception:', err);
      });
      await loadLabs();
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Failed to delete lab result:', err);
    }
  };

  return (
    <div className="space-y-4" id="lab-flowsheet-container">
      {/* Header controls */}
      <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-2xl border border-slate-900">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-teal-400" />
          <h2 className="text-sm font-bold text-white">
            {lang === 'ar' ? 'لوحة تحاليل الدم والمختبر السريعة' : 'Laboratory & Stat Lab Panel'}
          </h2>
        </div>
        
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOcrModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/10 cursor-pointer active:scale-95 transition-all"
            >
              <Camera className="w-3.5 h-3.5 text-slate-950" />
              <span>{lang === 'ar' ? 'قارئ التقارير الذكي' : 'AI Lab Scan'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-teal-400" />
              <span>{lang === 'ar' ? 'إدخال يدوي' : 'Add Lab Result'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Lab Results Table / Cards */}
      {labs.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-dashed border-slate-800 space-y-2">
          <FlaskConical className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">
            {lang === 'ar' ? 'لا توجد نتائج تحاليل مسجلة حالياً.' : 'No laboratory results recorded yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-900 bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 font-semibold">
                <th className="p-3 text-center w-12">#</th>
                <th className="p-3">{lang === 'ar' ? 'التحليل' : 'Test / Parameter'}</th>
                <th className="p-3 text-center">{lang === 'ar' ? 'النتيجة' : 'Result Value'}</th>
                <th className="p-3">{lang === 'ar' ? 'التصنيف' : 'Category'}</th>
                <th className="p-3">{lang === 'ar' ? 'الوقت' : 'Timestamp'}</th>
                <th className="p-3">{lang === 'ar' ? 'بواسطة' : 'Recorded By'}</th>
                {!readOnly && <th className="p-3 text-center w-16">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>}
              </tr>
            </thead>
            <tbody>
              {labs.map((lab, index) => (
                <tr 
                  key={lab.id} 
                  className={`border-b border-slate-900/50 hover:bg-slate-900/10 transition-colors ${
                    lab.isCritical ? 'bg-red-950/15' : ''
                  }`}
                >
                  <td className="p-3 text-center text-slate-500 font-mono">{index + 1}</td>
                  <td className="p-3 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <span>{lab.testName}</span>
                      {lab.isCritical && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                          {lang === 'ar' ? 'حرج' : 'CRITICAL'}
                        </span>
                      )}
                    </div>
                    {lab.notes && <p className="text-[10px] text-slate-500 mt-0.5 font-normal">{lab.notes}</p>}
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-white">
                    <span className={`px-2 py-1 rounded-lg ${
                      lab.isCritical 
                        ? 'bg-red-500/25 text-red-300 border border-red-500/40' 
                        : 'bg-slate-900 text-teal-300 border border-slate-800'
                    }`}>
                      {lab.value} <span className="text-[10px] font-normal text-slate-400 ml-0.5">{lab.unit}</span>
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 text-slate-300 border border-slate-800">
                      {lab.category}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400 font-mono text-[10px]">
                    {new Date(lab.timestamp).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="p-3 text-slate-400 text-[11px]">{lab.recordedByName}</td>
                  {!readOnly && (
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDelete(lab.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title={lang === 'ar' ? 'حذف النتيجة' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0a1122] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? 'إضافة نتيجة تحليل مخبري' : 'Add Laboratory Result'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Cancel'}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {lang === 'ar' ? 'اسم التحليل / الرمز الطبي (مثال: Creatinine, WBC) *' : 'Test Name / Parameter Symbol *'}
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  required
                  placeholder="e.g. Creatinine, Hgb, Na"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'القيمة المقاسة *' : 'Result Value *'}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                    placeholder="e.g. 1.2, 14.5"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'الوحدة القياسية' : 'Measurement Unit'}
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. mg/dL, g/dL"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-900">
                <input
                  type="checkbox"
                  id="critical-chk"
                  checked={isCritical}
                  onChange={(e) => setIsCritical(e.target.checked)}
                  className="w-4 h-4 text-teal-500 focus:ring-teal-400 bg-slate-950 border-slate-800 rounded ml-2"
                />
                <label htmlFor="critical-chk" className="text-xs font-semibold text-red-400 cursor-pointer select-none">
                  {lang === 'ar' ? 'تنبيه نتيجة حرجة ومقلقة (Critical Level)' : 'Mark as CRITICAL Laboratory Level'}
                </label>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {lang === 'ar' ? 'ملاحظات إضافية' : 'Additional Notes / Comments'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-950" />}
                <span>{lang === 'ar' ? 'حفظ نتيجة التحليل' : 'Save Lab Result'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI OCR Scanner Modal */}
      {showOcrModal && (
        <AiLabScannerModal
          isOpen={showOcrModal}
          onClose={() => setShowOcrModal(false)}
          patientId={patientId}
          bedNumber={bedNumber}
          onLabAdded={() => {
            loadLabs();
            if (onDataUpdated) onDataUpdated();
          }}
        />
      )}
    </div>
  );
};
