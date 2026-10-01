import React, { useState } from 'react';
import {
  FlaskConical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Check,
  X
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface LabsTemplateManagerProps {
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
  onSettingsChanged?: () => void;
  className?: string;
}

export const LabsTemplateManager: React.FC<LabsTemplateManagerProps> = ({
  isCollapsible = false,
  defaultCollapsed = false,
  onSettingsChanged,
  className = '',
}) => {
  const { settings, updateSettings } = useSystemSettings();
  const { lang, isRTL } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const categories = settings.labCategories || [];

  // New Category Form State
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatId, setNewCatId] = useState('');
  const [newCatNameEn, setNewCatNameEn] = useState('');
  const [newCatNameAr, setNewCatNameAr] = useState('');

  // New Parameter Form State
  const [activeCatForNewParam, setActiveCatForNewParam] = useState<string | null>(null);
  const [newParamId, setNewParamId] = useState('');
  const [newParamName, setNewParamName] = useState('');
  const [newParamUnit, setNewParamUnit] = useState('');
  const [newParamNormal, setNewParamNormal] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const idClean = newCatId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!idClean) return;
    if (categories.some(c => c.id === idClean)) {
      alert(lang === 'ar' ? 'رمز الصندوق هذا مستخدم بالفعل!' : 'Panel ID already exists!');
      return;
    }

    const newCat = {
      id: idClean,
      nameEn: newCatNameEn.trim() || idClean.toUpperCase(),
      nameAr: newCatNameAr.trim() || idClean.toUpperCase(),
      parameters: []
    };

    updateSettings({
      labCategories: [...categories, newCat]
    });

    setNewCatId('');
    setNewCatNameEn('');
    setNewCatNameAr('');
    setShowAddCategory(false);
    onSettingsChanged?.();
  };

  const handleDeleteCategory = (catId: string) => {
    if (!confirm(
      lang === 'ar' 
        ? '⚠️ هل أنت متأكد من حذف هذا الصندوق بالكامل؟ هذا الإجراء سيؤدي لإخفاء حقول الإدخال وعواميد النتائج المتعلقة به في جدول المريض.' 
        : '⚠️ Are you sure you want to delete this panel? This will hide its inputs and columns in the patient flowsheet.'
    )) return;

    updateSettings({
      labCategories: categories.filter(c => c.id !== catId)
    });
    onSettingsChanged?.();
  };

  const handleAddParameter = (catId: string, e: React.FormEvent) => {
    e.preventDefault();
    const idClean = newParamId.trim().toLowerCase().replace(/\s+/g, '_');
    if (!idClean) return;

    const updated = categories.map(cat => {
      if (cat.id === catId) {
        if (cat.parameters.some(p => p.id === idClean)) {
          alert(lang === 'ar' ? 'هذا الرمز موجود بالفعل داخل الصندوق!' : 'Parameter ID already exists in this panel!');
          return cat;
        }
        return {
          ...cat,
          parameters: [
            ...cat.parameters,
            { 
              id: idClean, 
              name: newParamName.trim() || idClean.toUpperCase(), 
              unit: newParamUnit.trim(), 
              normalRange: newParamNormal.trim() || '--' 
            }
          ]
        };
      }
      return cat;
    });

    updateSettings({ labCategories: updated });
    setNewParamId('');
    setNewParamName('');
    setNewParamUnit('');
    setNewParamNormal('');
    setActiveCatForNewParam(null);
    onSettingsChanged?.();
  };

  const handleDeleteParameter = (catId: string, paramId: string) => {
    if (!confirm(lang === 'ar' ? 'هل تريد حذف هذا التحليل من الصندوق؟' : 'Are you sure you want to delete this parameter?')) return;
    const updated = categories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          parameters: cat.parameters.filter(p => p.id !== paramId)
        };
      }
      return cat;
    });
    updateSettings({ labCategories: updated });
    onSettingsChanged?.();
  };

  return (
    <div className={`bg-[#0b1224] border border-teal-500/40 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 ${className}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header Container */}
      <div 
        onClick={() => isCollapsible && setIsCollapsed(!isCollapsed)}
        className={`flex items-start sm:items-center justify-between gap-3 ${isCollapsible ? 'cursor-pointer select-none hover:bg-slate-900/40 p-2 rounded-xl transition-all' : 'border-b border-slate-800 pb-3'}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 flex-shrink-0 shadow-inner">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                {lang === 'ar' 
                  ? 'إعداد وتخصيص صناديق التحاليل الطبية (صورة الدم، كيمياء، غازات الدم...)' 
                  : 'Customize Lab Panel Categories & Parameters'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                {lang === 'ar' ? 'تعديل الإضافة والحذف' : 'Live Config & Customization'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === 'ar'
                ? 'Customize Lab Panel Categories & Parameters'
                : 'Manage panels, parameters, normal ranges, and units for bedside flowsheets'}
            </p>
          </div>
        </div>

        {isCollapsible && (
          <button 
            type="button" 
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Main Content Body */}
      {(!isCollapsible || !isCollapsed) && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Action description & New Panel Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
            <span className="text-slate-300 text-xs leading-relaxed">
              {lang === 'ar' 
                ? 'قم بإعداد صناديق التحاليل والتحاليل بداخل كل صندوق، وسيتم تحديث شاشات إدخال وعرض التحاليل تلقائياً.' 
                : 'Configure lab panels and tests inside each panel. Bedside forms and charts will update automatically.'}
            </span>
            <button
              type="button"
              onClick={() => setShowAddCategory(!showAddCategory)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs transition-all shadow-md active:scale-95 cursor-pointer self-start sm:self-center flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إنشاء صندوق تحاليل جديد' : 'New Lab Panel Box'}</span>
            </button>
          </div>

          {/* Add New Category Form */}
          {showAddCategory && (
            <form onSubmit={handleAddCategory} className="bg-slate-950/90 border border-teal-500/40 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="font-bold text-teal-400 flex items-center gap-2 text-xs sm:text-sm">
                  <FlaskConical className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'إنشاء صندوق تحاليل جديد (مثال: علبة أنزيمات القلب أو التخثر)' : 'Create New Lab Panel Box'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                    {lang === 'ar' ? 'رمز المعرف (إنجليزي فريد بدون مسافات)' : 'Unique ID (Lowercase English)'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., cardiac_enzymes, cbc, kft"
                    value={newCatId}
                    onChange={(e) => setNewCatId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                    {lang === 'ar' ? 'الاسم بالإنجليزية' : 'English Display Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Cardiac Enzymes"
                    value={newCatNameEn}
                    onChange={(e) => setNewCatNameEn(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1 font-bold">
                    {lang === 'ar' ? 'الاسم بالعربية' : 'Arabic Display Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: إنزيمات القلب"
                    value={newCatNameAr}
                    onChange={(e) => setNewCatNameAr(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-teal-500 text-xs"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  {lang === 'ar' ? 'حفظ الصندوق' : 'Save Box'}
                </button>
              </div>
            </form>
          )}

          {/* Categories Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <div 
                key={cat.id} 
                className="bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-lg"
              >
                <div>
                  {/* Category Header */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0">
                        <FlaskConical className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-1.5">
                          <span>{lang === 'ar' ? cat.nameAr : cat.nameEn}</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({lang === 'ar' ? cat.nameEn : cat.nameAr})
                          </span>
                        </h4>
                        <span className="text-[10px] text-teal-400/80 font-mono block mt-0.5">
                          ID: {cat.id} • {cat.parameters.length} {lang === 'ar' ? 'تحاليل' : 'tests'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/40 text-slate-500 hover:text-red-400 transition-all border border-slate-800/80 cursor-pointer flex-shrink-0"
                      title={lang === 'ar' ? 'حذف الصندوق بالكامل' : 'Delete entire box'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Parameters List Table */}
                  <div className="mt-3">
                    {cat.parameters.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs italic bg-slate-900/30 rounded-xl border border-dashed border-slate-800/80">
                        {lang === 'ar' ? 'لا توجد تحاليل مضافة في هذا الصندوق بعد.' : 'No tests added to this panel yet.'}
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-800/70 bg-slate-900/40">
                        <table className="w-full text-xs font-mono select-text min-w-[320px]">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/90 text-[10px] text-slate-400">
                              <th className="p-2 text-start font-bold">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                              <th className="p-2 text-start font-bold">{lang === 'ar' ? 'الرمز' : 'ID'}</th>
                              <th className="p-2 text-start font-bold">{lang === 'ar' ? 'الوحدة' : 'Unit'}</th>
                              <th className="p-2 text-start font-bold">{lang === 'ar' ? 'المدى الطبيعي' : 'Normal'}</th>
                              <th className="p-2 text-end"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40">
                            {cat.parameters.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="p-2 font-bold text-slate-200">{p.name}</td>
                                <td className="p-2 text-slate-400 text-[10px] font-mono">{p.id}</td>
                                <td className="p-2 text-slate-400">{p.unit || '—'}</td>
                                <td className="p-2 text-teal-400 font-bold">{p.normalRange}</td>
                                <td className="p-2 text-end">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParameter(cat.id, p.id)}
                                    className="p-1 rounded bg-slate-900 hover:bg-red-950/30 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                    title={lang === 'ar' ? 'حذف هذا التحليل' : 'Delete parameter'}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Parameter To This Box */}
                <div className="pt-3 border-t border-slate-800/60">
                  {activeCatForNewParam === cat.id ? (
                    <form onSubmit={(e) => handleAddParameter(cat.id, e)} className="bg-slate-900/90 border border-teal-500/30 rounded-xl p-3 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                      <div className="text-[11px] font-bold text-teal-300 mb-1 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? `إضافة تحليل جديد لـ (${cat.nameAr})` : `Add test to ${cat.nameEn}`}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] text-slate-400 mb-0.5">{lang === 'ar' ? 'رمز فريد (إنجليزي)' : 'Code ID'}</label>
                          <input
                            type="text"
                            required
                            placeholder={lang === 'ar' ? 'مثال: trop_i' : 'e.g. trop_i'}
                            value={newParamId}
                            onChange={(e) => setNewParamId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-400 mb-0.5">{lang === 'ar' ? 'الاسم الظاهر' : 'Display Name'}</label>
                          <input
                            type="text"
                            required
                            placeholder={lang === 'ar' ? 'مثال: Troponin I' : 'e.g., Troponin I'}
                            value={newParamName}
                            onChange={(e) => setNewParamName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] text-slate-400 mb-0.5">{lang === 'ar' ? 'الوحدة' : 'Unit'}</label>
                          <input
                            type="text"
                            placeholder={lang === 'ar' ? 'مثال: ng/mL' : 'e.g., ng/mL'}
                            value={newParamUnit}
                            onChange={(e) => setNewParamUnit(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-slate-400 mb-0.5">{lang === 'ar' ? 'المدى الطبيعي' : 'Normal Range'}</label>
                          <input
                            type="text"
                            placeholder={lang === 'ar' ? 'مثال: < 0.04' : 'e.g. < 0.04'}
                            value={newParamNormal}
                            onChange={(e) => setNewParamNormal(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-teal-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveCatForNewParam(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px]"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          className="px-3.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[10px] shadow"
                        >
                          {lang === 'ar' ? 'إضافة للعلبة' : 'Add to Box'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCatForNewParam(cat.id);
                        setNewParamId('');
                        setNewParamName('');
                        setNewParamUnit('');
                        setNewParamNormal('');
                      }}
                      className="w-full py-2 rounded-xl border border-dashed border-slate-800 hover:border-teal-500/50 bg-slate-900/30 hover:bg-slate-900/60 text-slate-400 hover:text-teal-300 transition-all text-center font-bold flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-teal-400" />
                      <span>{lang === 'ar' ? 'إضافة نوع تحليل لهذا الصندوق' : 'Add Test to this Panel Box'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
