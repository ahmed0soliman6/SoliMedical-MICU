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
  Edit3,
  Sparkles,
  Camera,
  ChevronDown,
  ChevronUp,
  Tag
} from 'lucide-react';
import { InvestigationItem } from '../types/schema.ts';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { db } from '../db/icuSyncDb.ts';
import { syncInvestigationToCloud, deleteInvestigationFromCloud, fetchFullCategoryFromCloud } from '../services/firebase.ts';
import { AiInvestigationScannerModal } from './AiInvestigationScannerModal.tsx';

interface InvestigationsSectionProps {
  patientId: string;
  patientName?: string;
  bedNumber: string;
  investigations: InvestigationItem[];
  onInvestigationAdded: () => void;
  readOnly?: boolean;
}

export interface ModalityPreset {
  id: string;
  code: string;       // مختصر الأشعة الطبي الدولي
  labelAr: string;    // اسم الأشعة بالعربية
  labelEn: string;    // اسم الأشعة بالإنجليزية
  color: string;
  badgeBg: string;
}

export const MODALITY_PRESETS: ModalityPreset[] = [
  { 
    id: 'Chest X-Ray', 
    code: 'CXR', 
    labelAr: 'أشعة الصدر العادية (CXR)', 
    labelEn: 'Chest X-Ray (CXR)',
    color: 'border-teal-500/50 bg-teal-500/10 text-teal-300',
    badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40'
  },
  { 
    id: 'CT', 
    code: 'CT', 
    labelAr: 'أشعة مقطعية (CT Scan)', 
    labelEn: 'CT Scan',
    color: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
  },
  { 
    id: 'MRI', 
    code: 'MRI', 
    labelAr: 'رنين مغناطيسي (MRI)', 
    labelEn: 'MRI Scan',
    color: 'border-purple-500/50 bg-purple-500/10 text-purple-300',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  },
  { 
    id: 'Ultrasound', 
    code: 'US / POCUS', 
    labelAr: 'سونار وموجات صوتية (POCUS)', 
    labelEn: 'Ultrasound / POCUS',
    color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  { 
    id: 'ECG', 
    code: 'ECG', 
    labelAr: 'تخطيط قلب 12-قناة (ECG)', 
    labelEn: '12-Lead ECG',
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  { 
    id: 'Echo', 
    code: 'ECHO', 
    labelAr: 'إيكو قلب بجانب السرير (Echo)', 
    labelEn: 'Bedside Echocardiography',
    color: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  },
  { 
    id: 'Other', 
    code: 'OTHER', 
    labelAr: 'فحص إشعاعي تشخيصي آخر', 
    labelEn: 'Other Modality',
    color: 'border-slate-500/50 bg-slate-500/10 text-slate-300',
    badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-500/40'
  },
];

export const getModalityInfo = (modality: string): ModalityPreset => {
  const m = (modality || '').trim();
  const found = MODALITY_PRESETS.find(p => p.id.toLowerCase() === m.toLowerCase() || p.code.toLowerCase() === m.toLowerCase());
  if (found) return found;

  const lower = m.toLowerCase();
  if (lower.includes('chest') || lower.includes('cxr') || lower.includes('x-ray') || lower.includes('xray') || lower.includes('صدر')) {
    return MODALITY_PRESETS[0];
  }
  if (lower.includes('ct') || lower.includes('مقطعية')) return MODALITY_PRESETS[1];
  if (lower.includes('mri') || lower.includes('رنين')) return MODALITY_PRESETS[2];
  if (lower.includes('ultra') || lower.includes('pocus') || lower.includes('سونار') || lower.includes('موجات')) return MODALITY_PRESETS[3];
  if (lower.includes('ecg') || lower.includes('ekg') || lower.includes('تخطيط')) return MODALITY_PRESETS[4];
  if (lower.includes('echo') || lower.includes('إيكو') || lower.includes('ايكو')) return MODALITY_PRESETS[5];

  return {
    id: m || 'Other',
    code: (m.toUpperCase().slice(0, 8)) || 'RAD',
    labelAr: m || 'فحص إشعاعي',
    labelEn: m || 'Radiology Study',
    color: 'border-teal-500/50 bg-teal-500/10 text-teal-300',
    badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40'
  };
};

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
  patientName,
  bedNumber,
  investigations,
  onInvestigationAdded,
  readOnly = false,
}) => {
  const { lang, isRTL } = useTranslation();
  const { currentUser } = useAuth();
  const { settings } = useSystemSettings();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAiScanModalOpen, setIsAiScanModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InvestigationItem | null>(null);

  // Form states
  const [modality, setModality] = useState<string>('Chest X-Ray');
  const [testName, setTestName] = useState<string>('Portable CXR AP view');
  const [status, setStatus] = useState<'ORDERED' | 'RESULTED' | 'REPORTED'>('REPORTED');
  const [resultReport, setResultReport] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString().slice(0, 16));
  const [isSaving, setIsSaving] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const [showAllReports, setShowAllReports] = useState<boolean>(false);

  const patientInvestigations = (investigations || []).filter(inv => inv && inv.patientId === patientId);

  const handleApplyFromAi = (data: {
    modality: string;
    testName: string;
    status: 'ORDERED' | 'RESULTED' | 'REPORTED';
    timestamp: string;
    resultReport: string;
    notes?: string;
  }) => {
    setEditingItem(null);
    setModality(data.modality);
    setTestName(data.testName);
    setStatus(data.status);
    try {
      const d = new Date(data.timestamp);
      if (!isNaN(d.getTime())) {
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setTimestamp(local);
      } else {
        setTimestamp(new Date().toISOString().slice(0, 16));
      }
    } catch {
      setTimestamp(new Date().toISOString().slice(0, 16));
    }
    setResultReport(data.resultReport);
    setNotes(data.notes || '');
    setIsAddModalOpen(true);
  };

  const handleDirectSaveFromAi = async (data: Omit<InvestigationItem, 'id'>) => {
    const invId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const userDisplay = currentUser?.nameAr || currentUser?.nameEn || currentUser?.email || 'الطبيب المناوب';
    const newRecord: InvestigationItem = {
      ...data,
      id: invId,
      patientId,
      bedNumber,
      recordedByName: `${userDisplay} (AI OCR)`,
      recordedByStaffId: currentUser?.badgeId || currentUser?.uid,
    };

    // 1. Dexie local database
    await db.investigations.put(newRecord);

    // 2. Firestore SSOT (both investigations & medical_records)
    await syncInvestigationToCloud(newRecord);
  };

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
      await deleteInvestigationFromCloud(inv.id);
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
        await syncInvestigationToCloud(updatedRecord);
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
        await syncInvestigationToCloud(newRecord);
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
        <div className="flex items-center gap-2 flex-wrap">
          {!readOnly && (
            <button
              type="button"
              onClick={() => handleOpenAddModal('Chest X-Ray')}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة فحص / تقرير' : 'Add Investigation'}</span>
            </button>
          )}

          {settings.features.enableAiInvestigationScanner !== false && !readOnly && (
            <button
              type="button"
              onClick={() => setIsAiScanModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-400 hover:from-teal-400 hover:to-cyan-300 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/25 transition-all cursor-pointer active:scale-95"
              title={lang === 'ar' ? 'مسح ضوئي ذكي لتقارير الأشعة وتخطيط القلب والسونار بالذكاء الاصطناعي' : 'AI Smart Scan for Radiology, CXR, CT, ECG, and POCUS'}
            >
              <Sparkles className="w-4 h-4 text-slate-950 animate-pulse" />
              <span>{lang === 'ar' ? 'مسح ضوئي ذكي (AI Scanner)' : 'AI Smart Scan'}</span>
            </button>
          )}
        </div>

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
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAiScanModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'المسح الضوئي الذكي بالذكاء الاصطناعي' : 'AI Smart Scan Report'}</span>
            </button>
            {MODALITY_PRESETS.slice(0, 5).map(m => (
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
          {(() => {
            const sorted = [...patientInvestigations].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const visible = showAllReports ? sorted : sorted.slice(0, 4);
            const hasMore = sorted.length > 4;

            return (
              <>
                {visible.map((inv) => {
                  const isExpanded = !!expandedReports[inv.id];
                  const summaryLine = inv.resultReport 
                    ? inv.resultReport.split('\n')[0] 
                    : (inv.notes || (lang === 'ar' ? '— بدون تفاصيل إضافية —' : '— No additional details —'));
                  const info = getModalityInfo(inv.modality);

                  return (
                    <div 
                      key={inv.id}
                      className="p-3 sm:p-3.5 rounded-xl bg-[#0d1527] border border-slate-800/80 hover:border-slate-700 transition-all space-y-2.5"
                    >
                      {/* Collapsible Header */}
                      <div 
                        onClick={() => setExpandedReports(prev => ({ ...prev, [inv.id]: !isExpanded }))}
                        className="cursor-pointer select-none group space-y-2"
                      >
                        {/* Mobile Layout (sm:hidden) */}
                        <div className="sm:hidden space-y-2">
                          {/* Row 1: Abbreviation Badge, Status Badge, Chevron */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* مختصر الأشعة */}
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-bold font-mono shadow-sm">
                                <Tag className="w-3 h-3 text-teal-400" />
                                <span>{lang === 'ar' ? `مختصر: ${info.code}` : `Abbr: ${info.code}`}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                                {lang === 'ar' ? info.labelAr : info.labelEn}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.status === 'REPORTED'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : inv.status === 'RESULTED'
                                  ? 'bg-teal-950 text-teal-300 border border-teal-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}>
                                {inv.status === 'REPORTED' ? (lang === 'ar' ? 'معتمد' : 'Reported') :
                                 inv.status === 'RESULTED' ? (lang === 'ar' ? 'أولية' : 'Resulted') :
                                 (lang === 'ar' ? 'معلق' : 'Ordered')}
                              </span>
                              <div className="p-1 rounded-lg bg-slate-800/80 text-slate-400 group-hover:text-white transition-colors">
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          </div>

                          {/* Row 2: اسم الأشعة بالتفصيل */}
                          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 space-y-1">
                            <span className="text-[10px] font-bold text-teal-400 flex items-center gap-1">
                              <Scan className="w-3 h-3 text-teal-400" />
                              <span>{lang === 'ar' ? 'اسم الأشعة / الفحص:' : 'Radiology Exam / Study:'}</span>
                            </span>
                            <h4 className="text-sm font-bold text-white break-words leading-snug">
                              {inv.testName || (lang === 'ar' ? 'غير محدد' : 'Unspecified')}
                            </h4>
                          </div>

                          {/* Row 3 (when collapsed): summary & time */}
                          {!isExpanded && (
                            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 pt-0.5">
                              <div className="flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>{formatNumericDate(inv.timestamp)} {new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <span className="text-teal-400/90 font-medium">
                                {lang === 'ar' ? 'اضغط لعرض التقرير' : 'Tap for details'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Desktop Layout (hidden sm:flex) */}
                        <div className="hidden sm:flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {/* مختصر الأشعة */}
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono shrink-0 flex items-center gap-1 shadow-sm">
                              <Tag className="w-3 h-3 text-teal-400" />
                              <span>{info.code}</span>
                            </span>

                            {/* اسم الأشعة */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                                {lang === 'ar' ? 'اسم الأشعة:' : 'Study:'}
                              </span>
                              <h4 className="text-xs font-bold text-white group-hover:text-teal-300 transition-colors truncate">
                                {inv.testName}
                              </h4>
                              {!isExpanded && summaryLine && (
                                <span className="text-[11px] text-slate-400 truncate max-w-xs font-sans">
                                  — {summaryLine}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isExpanded && (
                              <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>{formatNumericDate(inv.timestamp)} {new Date(inv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </span>
                            )}
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
                            <div className="p-1 rounded-lg bg-slate-800/80 text-slate-400 group-hover:text-white transition-colors">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Full Report Details */}
                      {isExpanded && (
                        <div className="space-y-3 pt-3 border-t border-slate-800/80 animate-in fade-in duration-200">
                          {/* Top Info Banner */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-teal-400/90 font-semibold uppercase tracking-wider block">
                                {lang === 'ar' ? 'اسم الأشعة / الفحص الكامل:' : 'Full Radiology Exam / Study:'}
                              </span>
                              <p className="text-xs font-bold text-white break-words">
                                {inv.testName}
                              </p>
                            </div>
                            <div className="space-y-0.5 sm:text-end">
                              <span className="text-[10px] text-teal-400/90 font-semibold uppercase tracking-wider block">
                                {lang === 'ar' ? 'مختصر ونوع الأشعة:' : 'Modality & Abbreviation:'}
                              </span>
                              <div className="flex items-center sm:justify-end gap-1.5">
                                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                                  {info.code}
                                </span>
                                <span className="text-slate-300 font-medium text-[11px]">
                                  {lang === 'ar' ? info.labelAr : info.labelEn}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            {!readOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenEditModal(inv); }}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer shadow-sm active:scale-95"
                                  title={lang === 'ar' ? 'تعديل التقرير والفحص' : 'Edit Report & Details'}
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(inv); }}
                                  className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                                  title={lang === 'ar' ? 'حذف الفحص' : 'Delete'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
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

                          {/* Footer details */}
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
                      )}
                    </div>
                  );
                })}

                {/* Show More Button if > 4 reports */}
                {hasMore && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!showAllReports && patientId) {
                          fetchFullCategoryFromCloud(patientId, 'investigations');
                        }
                        setShowAllReports(!showAllReports);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 transition-all cursor-pointer shadow-sm"
                    >
                      {showAllReports 
                        ? (lang === 'ar' ? 'إخفاء (عرض 4 فقط)' : 'Show Less') 
                        : (lang === 'ar' ? `اظهار المزيد (${sorted.length - 4} تقارير أخرى)` : `Show More (${sorted.length - 4} more)`)}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
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

            <div className="px-5 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsAiScanModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-gradient-to-r from-teal-500/15 via-cyan-500/15 to-teal-500/15 border border-teal-500/30 hover:border-teal-400 text-teal-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                <span>{lang === 'ar' ? 'هل تملك صورة للتقرير أو الفحص؟ اضغط للمسح الذكي بالـ AI' : 'Have report photo? Click for AI Smart OCR Scan'}</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Modality & Abbreviation Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    {lang === 'ar' ? 'مختصر ونوع الأشعة (Modality & Code):' : 'Radiology Modality & Abbreviation:'}
                  </label>
                  <span className="text-[11px] font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/80">
                    {getModalityInfo(modality).code}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MODALITY_PRESETS.map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => handleModalityChange(m.id)}
                      className={`p-2.5 rounded-xl text-xs text-start sm:text-center border transition-all cursor-pointer flex sm:flex-col items-center justify-between sm:justify-center gap-1.5 ${
                        modality === m.id
                          ? 'bg-teal-500 text-slate-950 font-bold shadow-md border-teal-400'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                        modality === m.id ? 'bg-black/20 text-slate-950' : 'bg-slate-800 text-teal-300'
                      }`}>
                        {m.code}
                      </span>
                      <span className="truncate text-[11px] font-medium">{lang === 'ar' ? m.labelAr : m.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    {lang === 'ar' ? 'اسم الأشعة / الفحص المطلوب بالتفصيل:' : 'Radiology Study / Exam Name:'}
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {lang === 'ar' ? 'يظهر بالكامل في البطاقة' : 'Displayed in full'}
                  </span>
                </div>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: Portable CXR AP view, CT Brain without contrast...' : 'e.g. Portable CXR, 12-lead ECG...'}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-teal-500"
                  required
                />
                <div className="mt-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between gap-2 text-slate-300">
                  <span className="flex items-center gap-1 text-teal-300 font-mono font-bold shrink-0">
                    <Tag className="w-3 h-3 text-teal-400" />
                    <span>[{getModalityInfo(modality).code}]</span>
                  </span>
                  <span className="truncate font-semibold text-white">
                    {testName || (lang === 'ar' ? '— يرجى كتابة اسم الأشعة —' : '— Enter study name —')}
                  </span>
                </div>
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
                    required
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
                  required={status !== 'ORDERED'}
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
      {/* AI Smart Investigation / Radiology Scanner Modal */}
      {settings.features.enableAiInvestigationScanner !== false && (
        <AiInvestigationScannerModal
          isOpen={isAiScanModalOpen}
          onClose={() => setIsAiScanModalOpen(false)}
          patientId={patientId}
          patientName={patientName}
          bedNumber={bedNumber}
          onApplyToForm={handleApplyFromAi}
          onDirectSave={handleDirectSaveFromAi}
          onInvestigationAdded={onInvestigationAdded}
        />
      )}
    </div>
  );
};

