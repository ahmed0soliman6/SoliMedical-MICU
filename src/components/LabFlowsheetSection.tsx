import React, { useState } from 'react';
import { 
  FlaskConical, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  Search,
  Filter,
  X,
  Camera,
  Sparkles
} from 'lucide-react';
import { LabResultItem } from '../types/schema.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { db } from '../db/icuSyncDb.ts';
import { collection, doc, setDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase.ts';
import { COLLECTIONS } from '../types/contracts.ts';
import { AiLabScannerModal } from './AiLabScannerModal.tsx';
import { toEnglishDigits } from '../services/numberUtils.ts';

interface LabFlowsheetSectionProps {
  patientId: string;
  bedNumber: string;
  labResults: LabResultItem[];
  onLabAdded: () => void;
}

const COMMON_LAB_PRESETS = [
  { name: 'HG', category: 'CBC', unit: 'g/dL', normal: '12.0 - 16.0' },
  { name: 'Hb', category: 'CBC', unit: 'g/dL', normal: '12.0 - 16.0' },
  { name: 'WBC', category: 'CBC', unit: 'x10^9/L', normal: '4.0 - 11.0' },
  { name: 'Platelets', category: 'CBC', unit: 'x10^9/L', normal: '150 - 450' },
  { name: 'Creatinine', category: 'Biochemistry', unit: 'mg/dL', normal: '0.7 - 1.3' },
  { name: 'Urea', category: 'Biochemistry', unit: 'mg/dL', normal: '15 - 45' },
  { name: 'Sodium (Na)', category: 'Electrolytes', unit: 'mEq/L', normal: '135 - 145' },
  { name: 'Potassium (K)', category: 'Electrolytes', unit: 'mEq/L', normal: '3.5 - 5.0' },
  { name: 'ABG - pH', category: 'ABG', unit: 'pH', normal: '7.35 - 7.45' },
  { name: 'ABG - pO2', category: 'ABG', unit: 'mmHg', normal: '80 - 100' },
  { name: 'ABG - pCO2', category: 'ABG', unit: 'mmHg', normal: '35 - 45' },
  { name: 'ABG - HCO3', category: 'ABG', unit: 'mmol/L', normal: '22 - 26' },
  { name: 'Lactate', category: 'Biochemistry', unit: 'mmol/L', normal: '0.5 - 2.0' },
  { name: 'CRP', category: 'Biochemistry', unit: 'mg/L', normal: '< 5.0' },
  { name: 'INR', category: 'Coagulation', unit: 'ratio', normal: '0.8 - 1.2' },
  { name: 'PT', category: 'Coagulation', unit: 'sec', normal: '11.0 - 13.5' },
  { name: 'PTT', category: 'Coagulation', unit: 'sec', normal: '25 - 35' },
];

export const LabFlowsheetSection: React.FC<LabFlowsheetSectionProps> = ({
  patientId,
  bedNumber,
  labResults,
  onLabAdded,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();

  const [selectedTestName, setSelectedTestName] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [isAiScannerOpen, setIsAiScannerOpen] = useState(false);
  const [aiPreset, setAiPreset] = useState<'ABG' | 'CBC' | 'ALL'>('ALL');

  // Form State
  const [formTestName, setFormTestName] = useState('Hb');
  const [formCustomName, setFormCustomName] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formUnit, setFormUnit] = useState('g/dL');
  const [formNormalRange, setFormNormalRange] = useState('12.0 - 16.0');
  const [formCategory, setFormCategory] = useState('CBC');
  const [formStatus, setFormStatus] = useState<'ORDERED' | 'RESULTED'>('RESULTED');
  const [formNotes, setFormNotes] = useState('');
  const [formTimestamp, setFormTimestamp] = useState(new Date().toISOString().slice(0, 16));
  const [isSaving, setIsSaving] = useState(false);

  // Group all results for this patient by testName
  const patientLabs = (labResults || []).filter(l => l && l.patientId === patientId);

  const groupedLabs = React.useMemo(() => {
    const map = new Map<string, LabResultItem[]>();

    patientLabs.forEach(item => {
      if (!item || !item.testName) return;
      const key = item.testName.trim();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    });

    // Sort items chronologically inside each group (earliest to latest for trend)
    map.forEach((items) => {
      items.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
    });

    return map;
  }, [patientLabs]);

  // Open add modal with preset
  const handleOpenAddForTest = (presetName: string) => {
    const preset = COMMON_LAB_PRESETS.find(p => p.name === presetName);
    if (preset) {
      setFormTestName(preset.name);
      setFormCustomName('');
      setFormUnit(preset.unit);
      setFormNormalRange(preset.normal);
      setFormCategory(preset.category);
    } else {
      setFormTestName('custom');
      setFormCustomName(presetName);
      setFormUnit('');
      setFormNormalRange('');
      setFormCategory('Other');
    }
    setFormValue('');
    setFormNotes('');
    setFormStatus('RESULTED');
    setFormTimestamp(new Date().toISOString().slice(0, 16));
    setIsAddModalOpen(true);
  };

  const handlePresetSelect = (presetName: string) => {
    setFormTestName(presetName);
    if (presetName === 'custom') {
      setFormCustomName('');
      setFormUnit('');
      setFormNormalRange('');
      setFormCategory('Other');
    } else {
      const p = COMMON_LAB_PRESETS.find(x => x.name === presetName);
      if (p) {
        setFormCustomName('');
        setFormUnit(p.unit);
        setFormNormalRange(p.normal);
        setFormCategory(p.category);
      }
    }
  };

  const handleSaveLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValue.trim()) return;

    setIsSaving(true);
    try {
      const finalName = formTestName === 'custom' ? formCustomName.trim() : formTestName;
      if (!finalName) return;

      const userDisplay = currentUser?.nameAr || currentUser?.nameEn || 'الطبيب المناوب';
      const labId = `lab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      const newRecord: LabResultItem = {
        id: labId,
        patientId,
        bedNumber,
        testName: finalName,
        category: formCategory,
        value: toEnglishDigits(formValue.trim()),
        unit: formUnit.trim(),
        normalRange: toEnglishDigits(formNormalRange.trim()),
        timestamp: new Date(formTimestamp).toISOString(),
        status: formStatus,
        notes: formNotes.trim() || undefined,
        recordedByName: userDisplay,
        recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
      };

      // 1. Write to local Dexie table
      await db.labResults.put(newRecord);

      // 2. Write to Firestore SSOT
      try {
        const docRef = doc(firestore, 'medical_records', labId);
        await setDoc(docRef, {
          ...newRecord,
          recordType: 'LAB',
          createdAt: Date.now(),
        });
      } catch (cloudErr) {
        console.warn('Firestore lab record sync:', cloudErr);
      }

      onLabAdded();
      setIsAddModalOpen(false);
      setFormValue('');
      setFormNotes('');
    } catch (err) {
      console.error('Error saving lab result:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const testKeys = (Array.from(groupedLabs.keys()) as string[]).filter((key: string) => 
    Boolean(key) && key.toLowerCase().includes((filterQuery || '').toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{lang === 'ar' ? 'سجل وتطور التحاليل المخبرية (Daily Flowsheet)' : 'Laboratory Flowsheet & Trends'}</span>
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-teal-300">
                {patientLabs.length} {lang === 'ar' ? 'تسجيل' : 'entries'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {lang === 'ar' 
                ? 'عرض تطور كل تحليل بتسلسل متدرج (مثال: 5 > 7 > 8.5 > 8) مع كامل السجل التاريخي عند الضغط' 
                : 'Serial trend view (e.g. 5 > 7 > 8.5 > 8). Click any test to inspect historical entries.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {settings.enableAiLabScanner && (
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAiPreset('ALL');
                  setIsAiScannerOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تصوير تحليل' : 'AI Lab Scan'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiPreset('ABG');
                  setIsAiScannerOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs transition-all border border-emerald-500/30 cursor-pointer"
              >
                🫁 {lang === 'ar' ? 'غازات ABG' : 'ABG'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiPreset('CBC');
                  setIsAiScannerOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 font-bold text-xs transition-all border border-teal-500/30 cursor-pointer"
              >
                🩸 {lang === 'ar' ? 'صورة دم CBC' : 'CBC'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiPreset('CHEMISTRY');
                  setIsAiScannerOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-bold text-xs transition-all border border-cyan-500/30 cursor-pointer"
              >
                🧪 {lang === 'ar' ? 'كيمياء وأملاح' : 'Chemistry'}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setFormTestName('Hb');
              handlePresetSelect('Hb');
              setFormValue('');
              setFormNotes('');
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'إضافة تحليل جديد' : 'Add Lab Result'}</span>
          </button>
        </div>
      </div>

      {/* Quick search filter if there are many tests */}
      {groupedLabs.size > 4 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث في التحاليل المسجلة (مثل Hb, Creatinine)...' : 'Filter lab tests (e.g., Hb, Creatinine)...'}
            className="w-full px-9 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>
      )}

      {/* Lab Trend Cards Grid */}
      {testKeys.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-dashed border-slate-800 space-y-3">
          <FlaskConical className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">
            {lang === 'ar' 
              ? 'لم يتم تسجيل أي تحاليل لهذا المريض حتى الآن. اضغط على "إضافة تحليل جديد" للبدء.' 
              : 'No laboratory tests recorded yet. Click "Add Lab Result" to start.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {COMMON_LAB_PRESETS.slice(0, 8).map(p => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleOpenAddForTest(p.name)}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {testKeys.map((testName) => {
            const items = groupedLabs.get(testName) || [];
            const latest = items[items.length - 1];
            const previous = items.length > 1 ? items[items.length - 2] : null;

            // Trend calculation
            const latestNum = parseFloat(latest.value);
            const prevNum = previous ? parseFloat(previous.value) : null;
            let trend: 'UP' | 'DOWN' | 'EQUAL' | 'NONE' = 'NONE';
            if (!isNaN(latestNum) && prevNum !== null && !isNaN(prevNum)) {
              if (latestNum > prevNum) trend = 'UP';
              else if (latestNum < prevNum) trend = 'DOWN';
              else trend = 'EQUAL';
            }

            // Progression chain: e.g. "5 > 7 > 8.5 > 8"
            const trendChain = items.map(it => it.value);

            return (
              <div
                key={testName}
                onClick={() => setSelectedTestName(testName)}
                className="group p-3.5 rounded-xl bg-[#0d1527] hover:bg-[#111c34] border border-slate-800 hover:border-teal-500/60 transition-all cursor-pointer shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Name, Unit, and Total Count */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white group-hover:text-teal-300 transition-colors">
                        {testName}
                      </span>
                      {latest.unit && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({latest.unit})
                        </span>
                      )}
                      {latest.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">
                          {latest.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {items.length} {lang === 'ar' ? 'قراءات' : 'readings'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  {/* Flow progression: e.g. "5 > 7 > 8.5 > 8" */}
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 mb-2.5 overflow-x-auto">
                    <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs font-bold text-slate-300">
                      {trendChain.map((val, idx) => {
                        const isLast = idx === trendChain.length - 1;
                        return (
                          <React.Fragment key={idx}>
                            <span className={`px-2 py-0.5 rounded ${
                              isLast 
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' 
                                : 'text-slate-400'
                            }`}>
                              {val}
                            </span>
                            {!isLast && (
                              <span className="text-slate-600 font-bold select-none">&gt;</span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer details: Latest value, date/time, and normal range */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{lang === 'ar' ? 'المعدل الطبيعي:' : 'Normal:'}</span>
                    <span className="text-slate-300 font-mono">{latest.normalRange || '—'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {trend === 'UP' && (
                      <span className="text-amber-400 flex items-center gap-0.5 font-mono text-[10px]">
                        <TrendingUp className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'تصاعدي' : 'Rising'}</span>
                      </span>
                    )}
                    {trend === 'DOWN' && (
                      <span className="text-blue-400 flex items-center gap-0.5 font-mono text-[10px]">
                        <TrendingDown className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'تنازلي' : 'Declining'}</span>
                      </span>
                    )}
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(latest.timestamp).toLocaleDateString()} {new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drill-down Modal for a Selected Test (Shows ALL previous history) */}
      {selectedTestName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>{selectedTestName}</span>
                    <span className="text-xs font-mono font-normal text-slate-400">
                      ({groupedLabs.get(selectedTestName)?.length || 0} {lang === 'ar' ? 'تسجيلات سابقة' : 'records'})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' 
                      ? 'السجل التاريخي الشامل وتطور القراءات مع هوية المسجل والتوقيت' 
                      : 'Complete historical logs with recorder identity and timestamp'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenAddForTest(selectedTestName);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إضافة قراءة جديدة' : 'Add Reading'}</span>
                </button>
                <button
                  onClick={() => setSelectedTestName(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content: Full History Table & Sequence */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Trend Chain Banner */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 font-semibold">
                  {lang === 'ar' ? 'المسار الزمني للقراءات:' : 'Chronological Progression:'}
                </div>
                <div className="flex items-center gap-2 flex-wrap font-mono text-sm font-bold">
                  {(groupedLabs.get(selectedTestName) || []).map((it, idx, arr) => (
                    <React.Fragment key={it.id}>
                      <span className={`px-2.5 py-1 rounded-lg ${
                        idx === arr.length - 1
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 ring-1 ring-teal-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {it.value} {it.unit}
                      </span>
                      {idx < arr.length - 1 && (
                        <span className="text-teal-500 font-bold">&gt;</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* History Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-xs text-left rtl:text-right">
                  <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">{lang === 'ar' ? 'التاريخ والوقت' : 'Timestamp'}</th>
                      <th className="p-2.5">{lang === 'ar' ? 'القيمة' : 'Value'}</th>
                      <th className="p-2.5">{lang === 'ar' ? 'المعدل الطبيعي' : 'Normal Range'}</th>
                      <th className="p-2.5">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      <th className="p-2.5">{lang === 'ar' ? 'المسجل' : 'Recorded By'}</th>
                      <th className="p-2.5">{lang === 'ar' ? 'الملاحظات' : 'Notes'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#0d1527]">
                    {[...(groupedLabs.get(selectedTestName) || [])].reverse().map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-2.5 font-mono text-slate-300 whitespace-nowrap">
                          {new Date(rec.timestamp).toLocaleDateString()} {new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-white whitespace-nowrap">
                          <span className="text-teal-300">{rec.value}</span> {rec.unit}
                        </td>
                        <td className="p-2.5 font-mono text-slate-400 whitespace-nowrap">
                          {rec.normalRange || '—'}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rec.status === 'RESULTED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {rec.status === 'RESULTED' 
                              ? (lang === 'ar' ? 'نتيجة معتمدة' : 'Resulted') 
                              : (lang === 'ar' ? 'طلب معلق' : 'Ordered')}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-300 whitespace-nowrap">
                          {rec.recordedByName}
                        </td>
                        <td className="p-2.5 text-slate-400 max-w-xs truncate">
                          {rec.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Lab Result Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-lg bg-[#0a1224] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {lang === 'ar' ? 'تسجيل تحليل مخبري جديد' : 'Record Laboratory Test Result'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {lang === 'ar' ? 'يتم حفظ النتيجة في سجل دائم دون استبدال القراءات السابقة' : 'Appended to permanent chronological history'}
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

            <form onSubmit={handleSaveLab} className="p-5 space-y-4">
              {/* Presets Grid */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {lang === 'ar' ? 'اختر التحليل (أو نص حر):' : 'Select Lab Test (or Custom):'}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-slate-900/60 rounded-xl border border-slate-800">
                  {COMMON_LAB_PRESETS.map(p => (
                    <button
                      type="button"
                      key={p.name}
                      onClick={() => handlePresetSelect(p.name)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-mono transition-all ${
                        formTestName === p.name
                          ? 'bg-teal-500 text-slate-950 font-bold shadow'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('custom')}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-all ${
                      formTestName === 'custom'
                        ? 'bg-teal-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {lang === 'ar' ? '+ تحليل مخصص' : '+ Custom Test'}
                  </button>
                </div>
              </div>

              {/* Custom Test Name Input if 'custom' is selected */}
              {formTestName === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'اسم التحليل المخصص' : 'Custom Test Name'}
                  </label>
                  <input
                    type="text"
                    value={formCustomName}
                    onChange={(e) => setFormCustomName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: Troponin I, D-Dimer, Procalcitonin...' : 'e.g., Troponin I, D-Dimer, Procalcitonin...'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              )}

              {/* Value & Unit & Normal Range */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'القيمة (Value)' : 'Value'}
                  </label>
                  <input
                    type="text"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder="e.g. 7.5"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-teal-500"
                    required
                    autoFocus
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'الوحدة' : 'Unit'}
                  </label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="e.g. g/dL"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'المعدل الطبيعي' : 'Normal'}
                  </label>
                  <input
                    type="text"
                    value={formNormalRange}
                    onChange={(e) => setFormNormalRange(e.target.value)}
                    placeholder="e.g. 12-16"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Status & Timestamp */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'حالة التحليل' : 'Status'}
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="RESULTED">{lang === 'ar' ? 'نتيجة (Resulted)' : 'Resulted'}</option>
                    <option value="ORDERED">{lang === 'ar' ? 'طلب معلق (Ordered)' : 'Ordered'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}
                  </label>
                  <input
                    type="datetime-local"
                    value={formTimestamp}
                    onChange={(e) => setFormTimestamp(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'ملاحظات سريرية (اختياري)' : 'Clinical Notes (Optional)'}
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: عينة مكررة، تم التأكيد بعد نقل كيس دم...' : 'e.g., Repeat sample, post-transfusion check...'}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
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
                  disabled={isSaving || !formValue.trim() || (formTestName === 'custom' && !formCustomName.trim())}
                  className="px-5 py-2 text-xs font-bold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (lang === 'ar' ? 'جارِ الحفظ...' : 'Saving...') : (lang === 'ar' ? 'حفظ النتيجة' : 'Save Result')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Lab OCR Scanner Modal */}
      {settings.enableAiLabScanner && (
        <AiLabScannerModal
          isOpen={isAiScannerOpen}
          onClose={() => setIsAiScannerOpen(false)}
          patientId={patientId}
          bedNumber={bedNumber}
          targetPreset={aiPreset}
          onDirectSave={async (data) => {
            const doctorName = currentUser?.nameEn || currentUser?.nameAr || currentUser?.email || 'Dr. Guest';
            const newItems: LabResultItem[] = (data.items || []).map((it, idx) => ({
              id: `lab-${Date.now()}-${idx}`,
              patientId,
              bedNumber,
              testName: it.testName,
              category: (it.category as any) || 'Other',
              value: it.value,
              unit: it.unit || '',
              normalRange: it.normalRange || '',
              status: 'RESULTED',
              timestamp: new Date(data.timestamp || new Date()).toISOString(),
              notes: `AI Optical OCR - ${data.summaryEn}`,
              recordedByName: doctorName,
              recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
            }));

            if (newItems.length > 0) {
              await db.labResults.bulkPut(newItems);
              for (const item of newItems) {
                try {
                  const docRef = doc(firestore, COLLECTIONS.MEDICAL_RECORDS, item.id);
                  await setDoc(docRef, {
                    ...item,
                    recordType: 'LAB',
                    createdAt: Date.now(),
                  });
                } catch (e) {
                  console.warn('Sync lab result to cloud failed:', e);
                }
              }
            }
            onLabAdded();
          }}
        />
      )}
    </div>
  );
};
