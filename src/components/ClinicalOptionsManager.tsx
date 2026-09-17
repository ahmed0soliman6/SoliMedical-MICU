import React, { useState } from 'react';
import { 
  Droplet, 
  Wind, 
  Scale, 
  Plus, 
  Trash2, 
  Check, 
  RotateCcw, 
  Sparkles,
  Layers,
  Activity,
  AlertCircle
} from 'lucide-react';
import { useSystemSettings } from '../services/SettingsContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { 
  InfusionDrugPreset, 
  VentilatorModePreset, 
  FluidCategoryPreset,
  DEFAULT_INFUSION_DRUGS,
  DEFAULT_VENTILATOR_MODES,
  DEFAULT_FLUID_CATEGORIES 
} from '../types/settings.ts';

export const ClinicalOptionsManager: React.FC = () => {
  const { settings, updateSettings } = useSystemSettings();
  const { lang, isRTL } = useTranslation();

  const [activeTab, setActiveTab] = useState<'pumps' | 'vent' | 'fluids'>('pumps');

  // Drug Form State
  const [showAddDrug, setShowAddDrug] = useState(false);
  const [drugNameEn, setDrugNameEn] = useState('');
  const [drugNameAr, setDrugNameAr] = useState('');
  const [drugCarrier, setDrugCarrier] = useState('');
  const [drugUnit, setDrugUnit] = useState<'mcg/kg/min' | 'mcg/h' | 'mg/h' | 'Units/hr' | 'ml/h'>('mcg/kg/min');
  const [drugRate, setDrugRate] = useState('0.1');
  const [drugFlowRate, setDrugFlowRate] = useState('3.0');
  const [drugTarget, setDrugTarget] = useState('Target MAP ≥ 65 mmHg');

  // Vent Mode Form State
  const [showAddMode, setShowAddMode] = useState(false);
  const [modeId, setModeId] = useState('');
  const [modeLabelEn, setModeLabelEn] = useState('');
  const [modeLabelAr, setModeLabelAr] = useState('');
  const [modeType, setModeType] = useState<'invasive' | 'non-invasive' | 'weaning'>('invasive');

  // Fluid Category Form State
  const [showAddFluid, setShowAddFluid] = useState(false);
  const [fluidType, setFluidType] = useState<'intake' | 'output'>('intake');
  const [fluidId, setFluidId] = useState('');
  const [fluidLabelEn, setFluidLabelEn] = useState('');
  const [fluidLabelAr, setFluidLabelAr] = useState('');
  const [fluidDefaultMl, setFluidDefaultMl] = useState('0');

  const drugs = settings.infusionDrugs || DEFAULT_INFUSION_DRUGS;
  const ventModes = settings.ventilatorModes || DEFAULT_VENTILATOR_MODES;
  const fluidCategories = settings.fluidCategories || DEFAULT_FLUID_CATEGORIES;

  // Handlers for Drugs
  const handleAddDrug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugNameEn.trim()) return;

    const newDrug: InfusionDrugPreset = {
      id: `drug-${Date.now()}`,
      nameEn: drugNameEn.trim(),
      nameAr: drugNameAr.trim() || drugNameEn.trim(),
      defaultCarrier: drugCarrier.trim() || '50 mL NS',
      defaultUnit: drugUnit,
      defaultRate: parseFloat(drugRate) || 0.1,
      defaultFlowRate: parseFloat(drugFlowRate) || 2.0,
      defaultTarget: drugTarget.trim() || 'Clinical titration',
    };

    updateSettings({
      infusionDrugs: [...drugs, newDrug]
    });

    setDrugNameEn('');
    setDrugNameAr('');
    setDrugCarrier('');
    setShowAddDrug(false);
  };

  const handleDeleteDrug = (id: string) => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا الخيار من قائمة أدوية المضخات؟' : 'Are you sure you want to remove this medication option?')) return;
    updateSettings({
      infusionDrugs: drugs.filter(d => d.id !== id)
    });
  };

  const handleResetDrugs = () => {
    if (!confirm(lang === 'ar' ? 'استعادة قائمة أدوية المضخات الافتراضية؟' : 'Restore default infusion medications catalog?')) return;
    updateSettings({ infusionDrugs: DEFAULT_INFUSION_DRUGS });
  };

  // Handlers for Vent Modes
  const handleAddMode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = (modeId.trim() || modeLabelEn.trim()).toUpperCase().replace(/\s+/g, '_');
    if (!cleanId) return;

    const newMode: VentilatorModePreset = {
      id: cleanId,
      labelEn: modeLabelEn.trim() || cleanId,
      labelAr: modeLabelAr.trim() || modeLabelEn.trim() || cleanId,
      type: modeType,
    };

    updateSettings({
      ventilatorModes: [...ventModes, newMode]
    });

    setModeId('');
    setModeLabelEn('');
    setModeLabelAr('');
    setShowAddMode(false);
  };

  const handleDeleteMode = (id: string) => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف نمط التنفس هذا؟' : 'Are you sure you want to delete this ventilation mode?')) return;
    updateSettings({
      ventilatorModes: ventModes.filter(m => m.id !== id)
    });
  };

  const handleResetModes = () => {
    if (!confirm(lang === 'ar' ? 'استعادة أوضاع أجهزة التنفس الافتراضية؟' : 'Restore default ventilator modes?')) return;
    updateSettings({ ventilatorModes: DEFAULT_VENTILATOR_MODES });
  };

  // Handlers for Fluid Categories
  const handleAddFluidCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = (fluidId.trim() || fluidLabelEn.trim()).toLowerCase().replace(/\s+/g, '_');
    if (!cleanId) return;

    const newCategory: FluidCategoryPreset = {
      id: cleanId,
      type: fluidType,
      labelEn: fluidLabelEn.trim() || cleanId,
      labelAr: fluidLabelAr.trim() || fluidLabelEn.trim() || cleanId,
      defaultMl: parseFloat(fluidDefaultMl) || 0,
    };

    updateSettings({
      fluidCategories: [...fluidCategories, newCategory]
    });

    setFluidId('');
    setFluidLabelEn('');
    setFluidLabelAr('');
    setFluidDefaultMl('0');
    setShowAddFluid(false);
  };

  const handleDeleteFluidCategory = (id: string) => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا البند من ميزان السوائل؟' : 'Are you sure you want to delete this fluid balance item?')) return;
    updateSettings({
      fluidCategories: fluidCategories.filter(f => f.id !== id)
    });
  };

  const handleResetFluids = () => {
    if (!confirm(lang === 'ar' ? 'استعادة بنود ميزان السوائل الافتراضية؟' : 'Restore default fluid balance items?')) return;
    updateSettings({ fluidCategories: DEFAULT_FLUID_CATEGORIES });
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#060a14] border border-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('pumps')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'pumps'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Droplet className="w-4 h-4 text-amber-400" />
          <span>{lang === 'ar' ? 'مضخات وأدوية المحاليل' : 'Infusion Pumps & Drugs'}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {drugs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'vent'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wind className="w-4 h-4 text-cyan-400" />
          <span>{lang === 'ar' ? 'أوضاع جهاز التنفس' : 'Ventilator Modes'}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {ventModes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fluids')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'fluids'
              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Scale className="w-4 h-4 text-teal-400" />
          <span>{lang === 'ar' ? 'بنود ميزان السوائل' : 'Fluid Balance Categories'}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
            {fluidCategories.length}
          </span>
        </button>
      </div>

      {/* TAB 1: INFUSION PUMPS */}
      {activeTab === 'pumps' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Droplet className="w-4 h-4 text-amber-400" />
                <span>{lang === 'ar' ? 'خيارات أدوية ومحاليل مضخات التسريب الوريدي' : 'Infusion Pumps Medication Catalog'}</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' 
                  ? 'يمكنك إضافة أدوية جديدة أو حذف الأدوية من القائمة للتحكم بما يظهر عند ضبط قنوات الحقن.' 
                  : 'Manage selectable drug presets, carrier solutions, and default titration parameters.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddDrug(!showAddDrug)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة دواء / محلول جديد' : 'Add Medication'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetDrugs}
                title={lang === 'ar' ? 'استعادة الافتراضيات' : 'Reset Defaults'}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Add Drug Form */}
          {showAddDrug && (
            <form onSubmit={handleAddDrug} className="p-4 rounded-xl bg-[#070c18] border border-amber-500/30 space-y-3 animate-in fade-in duration-200">
              <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'بيانات الدواء أو المحلول الجديد' : 'New Infusion Drug Configuration'}</span>
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'الاسم بالإنجليزية (Name in English)' : 'Drug Name (EN)'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nicardipine, Dexmedetomidine"
                    value={drugNameEn}
                    onChange={(e) => setDrugNameEn(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'الاسم بالعربية' : 'Drug Name (AR)'}
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: نيكارديبين، بريسيديكس"
                    value={drugNameAr}
                    onChange={(e) => setDrugNameAr(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'المحلول الحامل والتركيز' : 'Carrier & Concentration'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 25 mg in 50 mL D5W (0.5 mg/mL)"
                    value={drugCarrier}
                    onChange={(e) => setDrugCarrier(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'وحدة الجرعة (Dose Unit)' : 'Dose Unit'}
                  </label>
                  <select
                    value={drugUnit}
                    onChange={(e) => setDrugUnit(e.target.value as any)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="mcg/kg/min">mcg/kg/min</option>
                    <option value="mcg/h">mcg/h</option>
                    <option value="mg/h">mg/h</option>
                    <option value="Units/hr">Units/hr</option>
                    <option value="ml/h">ml/h</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      {lang === 'ar' ? 'الجرعة الافتراضية' : 'Default Dose'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={drugRate}
                      onChange={(e) => setDrugRate(e.target.value)}
                      className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      {lang === 'ar' ? 'التدفق (mL/h)' : 'Flow (mL/h)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={drugFlowRate}
                      onChange={(e) => setDrugFlowRate(e.target.value)}
                      className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'هدف المعايرة السريري' : 'Clinical Titration Target'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Target MAP 65-75, SBP < 140"
                    value={drugTarget}
                    onChange={(e) => setDrugTarget(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddDrug(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ وإضافة الدواء' : 'Save & Add Medication'}
                </button>
              </div>
            </form>
          )}

          {/* Drug List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {drugs.map((drug) => (
              <div 
                key={drug.id}
                className="bg-[#070c18] border border-slate-800 hover:border-slate-700 p-3 rounded-xl flex items-start justify-between gap-3 group transition-all"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <h5 className="text-xs font-bold text-white truncate">
                      {drug.nameEn}
                    </h5>
                  </div>
                  {drug.nameAr && (
                    <div className="text-[11px] text-amber-300/80 font-arabic">
                      {drug.nameAr}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 truncate">
                    {drug.defaultCarrier}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-300">
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-300">
                      {drug.defaultRate} {drug.defaultUnit}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {drug.defaultFlowRate} mL/h
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteDrug(drug.id)}
                  title={lang === 'ar' ? 'حذف هذا الدواء' : 'Delete Medication'}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all cursor-pointer flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: VENTILATOR MODES */}
      {activeTab === 'vent' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-400" />
                <span>{lang === 'ar' ? 'خيارات وأنماط أجهزة التنفس الصناعي (Ventilator Modes)' : 'Ventilator Modes Catalog'}</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' 
                  ? 'يمكنك إضافة أوضاع تنفس جديدة أو حذفها للتحكم بما يظهر في نافذة ضبط جهاز التنفس.' 
                  : 'Configure selectable mechanical ventilation modes (invasive, non-invasive, weaning).'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddMode(!showAddMode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة نمط تنفس جديد' : 'Add Mode'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetModes}
                title={lang === 'ar' ? 'استعادة الافتراضيات' : 'Reset Defaults'}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Add Mode Form */}
          {showAddMode && (
            <form onSubmit={handleAddMode} className="p-4 rounded-xl bg-[#070c18] border border-cyan-500/30 space-y-3 animate-in fade-in duration-200">
              <h5 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'بيانات نمط التنفس الجديد' : 'New Ventilator Mode Configuration'}</span>
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'رمز النمط (Mode Code / ID)' : 'Mode Code / ID'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NAVA, APRV, ASV"
                    value={modeId}
                    onChange={(e) => setModeId(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'نوع النمط' : 'Ventilation Classification'}
                  </label>
                  <select
                    value={modeType}
                    onChange={(e) => setModeType(e.target.value as any)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="invasive">{lang === 'ar' ? 'جائر (Invasive ETT/Tracheostomy)' : 'Invasive (ETT/Tracheostomy)'}</option>
                    <option value="non-invasive">{lang === 'ar' ? 'غير جائر (Non-Invasive / Mask / HFNC)' : 'Non-Invasive (Mask / HFNC)'}</option>
                    <option value="weaning">{lang === 'ar' ? 'فطام وتجربة عفوية (Weaning / Spontaneous)' : 'Weaning / Spontaneous'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'الاسم بالإنجليزية' : 'Label (EN)'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. APRV (Airway Pressure Release)"
                    value={modeLabelEn}
                    onChange={(e) => setModeLabelEn(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'الاسم بالعربية' : 'Label (AR)'}
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: APRV تحرير ضغط مجرى الهواء"
                    value={modeLabelAr}
                    onChange={(e) => setModeLabelAr(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddMode(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ وإضافة النمط' : 'Save & Add Mode'}
                </button>
              </div>
            </form>
          )}

          {/* Mode List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
            {ventModes.map((mode) => (
              <div 
                key={mode.id}
                className="bg-[#070c18] border border-slate-800 hover:border-slate-700 p-3 rounded-xl flex items-center justify-between gap-3 transition-all"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      mode.type === 'invasive' 
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-700' 
                        : mode.type === 'weaning'
                        ? 'bg-amber-950 text-amber-300 border-amber-700'
                        : 'bg-teal-950 text-teal-300 border-teal-700'
                    }`}>
                      {mode.id}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">
                      {mode.type}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-white truncate">
                    {mode.labelEn}
                  </h5>
                  {mode.labelAr && (
                    <div className="text-[11px] text-cyan-300/80 font-arabic">
                      {mode.labelAr}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteMode(mode.id)}
                  title={lang === 'ar' ? 'حذف هذا النمط' : 'Delete Mode'}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-all cursor-pointer flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FLUID BALANCE CATEGORIES */}
      {activeTab === 'fluids' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-teal-400" />
                <span>{lang === 'ar' ? 'خيارات وبنود ميزان السوائل (مدخلات ومخرجات)' : 'Fluid Balance Categories & Channels'}</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'ar' 
                  ? 'يمكنك إضافة قنوات سوائل جديدة (مثل تصريف الدرانق، الغسيل الكلوي) أو حذف الخيارات.' 
                  : 'Manage dynamic intake and output channels for 24h cumulative fluid calculation.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddFluid(!showAddFluid)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 font-bold text-xs hover:bg-teal-400 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة بند سوائل جديد' : 'Add Fluid Item'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetFluids}
                title={lang === 'ar' ? 'استعادة الافتراضيات' : 'Reset Defaults'}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Add Fluid Category Form */}
          {showAddFluid && (
            <form onSubmit={handleAddFluidCategory} className="p-4 rounded-xl bg-[#070c18] border border-teal-500/30 space-y-3 animate-in fade-in duration-200">
              <h5 className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'بيانات بند ميزان السوائل الجديد' : 'New Fluid Channel Configuration'}</span>
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'نوع البند' : 'Channel Classification'} *
                  </label>
                  <select
                    value={fluidType}
                    onChange={(e) => setFluidType(e.target.value as any)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  >
                    <option value="intake">{lang === 'ar' ? 'مدخلات (Intake / Infusions)' : 'Intake / Infusions'}</option>
                    <option value="output">{lang === 'ar' ? 'مخرجات (Output / Drains)' : 'Output / Drains'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'رمز المعرّف (ID Key)' : 'Channel ID'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ultrafiltration, stoma"
                    value={fluidId}
                    onChange={(e) => setFluidId(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'الاسم بالإنجليزية' : 'Label (EN)'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Continuous Renal Ultrafiltration"
                    value={fluidLabelEn}
                    onChange={(e) => setFluidLabelEn(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'الاسم بالعربية' : 'Label (AR)'}
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: ترشيح الغسيل الكلوي المستمر"
                    value={fluidLabelAr}
                    onChange={(e) => setFluidLabelAr(e.target.value)}
                    className="w-full bg-[#0b1224] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddFluid(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-teal-500 text-slate-950 text-xs font-bold hover:bg-teal-400 cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ وإضافة البند' : 'Save & Add Channel'}
                </button>
              </div>
            </form>
          )}

          {/* Categorized Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Intake List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-xs font-bold text-cyan-400 uppercase">
                  {lang === 'ar' ? 'المدخلات (Intake Channels)' : 'Intake Channels'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {fluidCategories.filter(f => f.type === 'intake').length} {lang === 'ar' ? 'بنود' : 'items'}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {fluidCategories.filter(f => f.type === 'intake').map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-[#070c18] border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{cat.labelEn}</div>
                      {cat.labelAr && <div className="text-[11px] text-cyan-300/80">{cat.labelAr}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteFluidCategory(cat.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                      title={lang === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Output List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-400 uppercase">
                  {lang === 'ar' ? 'المخرجات (Output Channels)' : 'Output Channels'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {fluidCategories.filter(f => f.type === 'output').length} {lang === 'ar' ? 'بنود' : 'items'}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {fluidCategories.filter(f => f.type === 'output').map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-[#070c18] border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{cat.labelEn}</div>
                      {cat.labelAr && <div className="text-[11px] text-amber-300/80">{cat.labelAr}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteFluidCategory(cat.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                      title={lang === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
