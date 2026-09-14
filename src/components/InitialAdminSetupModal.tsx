import React, { useState } from 'react';
import { Shield, CheckCircle2, UserCheck, AlertCircle, KeyRound, Sparkles, Building2, BadgePercent, Lock } from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useSettings } from '../services/SettingsContext.tsx';

export const InitialAdminSetupModal: React.FC = () => {
  const { registerSuperAdmin, loginWithGoogle } = useAuth();
  const { lang } = useSettings();

  const [nameAr, setNameAr] = useState('د. أحمد سليمان');
  const [nameEn, setNameEn] = useState('Dr. Ahmed Soliman');
  const [email, setEmail] = useState('ahmed0soliman6@gmail.com');
  const [licenseNumber, setLicenseNumber] = useState('SCFHS-ICU-88902');
  const [department, setDepartment] = useState('MICU - Medical Intensive Care Unit');
  const [badgeId, setBadgeId] = useState('ADM-001');
  const [pinCode, setPinCode] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr || !nameEn || !email || !licenseNumber || !pinCode) {
      setErrorMsg(lang === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة لتعيين المشرف العام' : 'Please fill all required fields');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await registerSuperAdmin({
      nameAr,
      nameEn,
      email,
      licenseNumber,
      department,
      badgeId,
      pinCode,
    });

    setIsSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.message || 'Error creating administrator account');
    }
  };

  const handleGoogleSetup = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await loginWithGoogle();
    setIsSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.message || 'Google signup failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0a1224] border-2 border-teal-500/50 rounded-3xl shadow-2xl shadow-teal-500/10 p-6 sm:p-8 my-8 animate-fade-in text-slate-100">
        
        {/* Glow Header Accent */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-teal-600 via-emerald-500 to-teal-600 text-slate-950 text-xs font-black uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{lang === 'ar' ? 'إعداد المنظومة لأول مرة • One-Time Setup' : 'System Provisioning • One-Time Setup'}</span>
        </div>

        {/* Title & Clinical Branding */}
        <div className="text-center mt-2 mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-teal-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-[#070d1a] rounded-[14px] flex items-center justify-center text-teal-400">
              <Shield className="w-7 h-7" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'تسجيل المشرف العام وتفعيل المنظومة السريرية' : 'Super Admin Provisioning & System Activation'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto mt-1.5 leading-relaxed">
            {lang === 'ar' 
              ? 'مرحباً بك في Soli Medical MICU. هذه الصفحة تظهر مرة واحدة فقط لتهيئة بيانات استشاري ورئيس قسم العناية المركزة والمشرف العام على المنظومة، ثم تختفي نهائياً.'
              : 'Welcome to Soli Medical MICU. This screen appears only once to bootstrap the Medical Director & Super Administrator account.'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google Quick Provision Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoogleSetup}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-teal-500 text-slate-200 hover:text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-3 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{lang === 'ar' ? 'التسجيل السريع بحساب Google كمشرف عام' : 'Sign Up via Google as Super Administrator'}</span>
          </button>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-800 w-full"></div>
            <span className="bg-[#0a1224] px-3 text-[11px] text-slate-500 uppercase font-mono">{lang === 'ar' ? 'أو التسجيل اليدوي بالبيانات السريرية' : 'or Enter Clinical Profile'}</span>
            <div className="border-t border-slate-800 w-full"></div>
          </div>
        </div>

        {/* Manual Setup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'الاسم باللغة العربية (رئيس القسم / الاستشاري) *' : 'Full Name (Arabic) *'}
              </label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                required
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none"
                placeholder="د. أحمد سليمان"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'الاسم باللغة الإنجليزية *' : 'Full Name (English) *'}
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                required
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none"
                placeholder="Dr. Ahmed Soliman"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'البريد الإلكتروني الرسمي *' : 'Official Email *'}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none"
                placeholder="ahmed0soliman6@gmail.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'رقم الترخيص الطبي / الهيئة السعودية (SCFHS) *' : 'Medical License / CBAHI ID *'}
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                required
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none font-mono"
                placeholder="SCFHS-ICU-88902"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'القسم والوحدة' : 'Department'}
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none"
                placeholder="MICU"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'معرف البطاقة (Badge ID)' : 'Badge ID'}
              </label>
              <input
                type="text"
                value={badgeId}
                onChange={(e) => setBadgeId(e.target.value)}
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none font-mono"
                placeholder="ADM-001"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {lang === 'ar' ? 'رمز المرور / PIN السريري *' : 'Clinical PIN / Password *'}
              </label>
              <input
                type="password"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                required
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none font-mono tracking-widest text-center"
                placeholder="••••"
              />
            </div>
          </div>

          {/* Compliance notice */}
          <div className="p-3 bg-teal-950/40 border border-teal-800/40 rounded-xl text-teal-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>
              {lang === 'ar' 
                ? 'سيتم منح هذا الحساب صلاحيات الإشراف الكاملة (SUPER_ADMIN) وإدراجه في قواعد أمان Firebase Firestore.'
                : 'This account will be granted full SUPER_ADMIN privileges and recorded in Firestore security rules.'}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-sm font-black transition-all shadow-lg shadow-teal-500/25 active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>{lang === 'ar' ? 'حفظ وتثبيت المشرف العام وتفعيل المنظومة' : 'Save & Provision Super Admin'}</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
