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
  Image as ImageIcon
} from 'lucide-react';
import { InvestigationItem } from '../types/schema.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { db } from '../db/icuSyncDb.ts';
import { doc, setDoc } from 'firebase/firestore';
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

export const InvestigationsSection: React.FC<InvestigationsSectionProps> = ({
  patientId,
  bedNumber,
  investigations,
  onInvestigationAdded,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InvestigationItem | null>(null);

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
    if (m === 'Chest X-Ray') setTestName('Portable CXR (AP View)');
    else if (m === 'CT') setTestName('CT Brain non-contrast');
    else if (m === 'MRI') setTestName('Brain MRI');
    else if (m === 'Ultrasound') setTestName('Bedside POCUS / Abdominal US');
    else if (m === 'ECG') setTestName('12-Lead Bedside ECG');
    else if (m === 'Echo') setTestName('Transthoracic Echocardiogram (TTE)');
    else setTestName('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testName.trim()) return;

    setIsSaving(true);
    try {
      const userDisplay = currentUser?.nameAr || currentUser?.nameEn || 'الطبيب المناوب';
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
        console.warn('Firestore investigation sync:', cloudErr);
      }

      onInvestigationAdded();
      setIsAddModalOpen(false);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Scan className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{lang === 'ar' ? 'سجل الأشعات والفحوصات (Radiology & Diagnostics)' : 'Radiology & Diagnostic Investigations'}</span>
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-indigo-300">
                {patientInvestigations.length} {lang === 'ar' ? 'فحوصات' : 'studies'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {lang === 'ar' 
                ? 'توثيق الأشعات (X-Ray, CT, MRI, US) وتخطيط وإيكو القلب مع حفظ التقارير والنتائج' 
                : 'Documentation of imaging, ECG, Echo, and diagnostic reports.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            handleModalityChange('Chest X-Ray');
            setResultReport('');
            setNotes('');
            setStatus('REPORTED');
            setTimestamp(new Date().toISOString().slice(0, 16));
            setIsAddModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'إضافة فحص / تقرير جديد' : 'Add Investigation'}</span>
        </button>
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
                onClick={() => {
                  handleModalityChange(m.id);
                  setIsAddModalOpen(true);
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
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
                className="p-3.5 rounded-xl bg-[#0d1527] border border-slate-800/80 hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
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
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(inv.timestamp).toLocaleDateString()} {new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Report Content */}
                {inv.resultReport && (
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/70 text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {inv.resultReport}
                  </div>
                )}

                {/* Footer notes & doctor */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
                  <span className="truncate max-w-md">
                    {inv.notes ? `${lang === 'ar' ? 'ملاحظة: ' : 'Note: '}${inv.notes}` : ''}
                  </span>
                  <span className="text-slate-400 font-mono text-[10px] flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>{inv.recordedByName}</span>
                  </span>
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Add Investigation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Scan className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'تسجيل فحص أو أشعة جديدة' : 'Add Investigation / Diagnostic Study'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' ? 'توثيق تقرير الأشعة وتخطيط القلب وفحوصات السرير' : 'Record radiology report, ECG, or ultrasound'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
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
                      className={`p-2 rounded-xl text-xs text-center border transition-all ${
                        modality === m.id
                          ? 'bg-indigo-500 text-slate-950 font-bold shadow'
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
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
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
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
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
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* Report / Findings */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'النتيجة أو تقرير الفحص' : 'Report Findings / Impression'}
                </label>
                <textarea
                  value={resultReport}
                  onChange={(e) => setResultReport(e.target.value)}
                  placeholder={lang === 'ar' ? 'أدخل نص التقرير، النتائج الإشعاعية، انطباع الطبيب...' : 'Enter findings, radiological impression, acute abnormalities...'}
                  rows={4}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
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
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !testName.trim()}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-indigo-400 hover:bg-indigo-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ الفحص' : 'Save Investigation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
