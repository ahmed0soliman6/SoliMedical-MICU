import React, { useState } from 'react';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { StaffRole } from '../types/schema.ts';
import { KeyRound, Eye, EyeOff, AlertCircle, Loader2, LogIn, Shield, Users, Globe } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { lang, isRTL, setLanguage } = useTranslation();
  const { loginWithEmailOrBadge, loginWithGoogle, quickDemoLogin } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'credentials' | 'demo'>('credentials');

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!identifier.trim()) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال البريد الإلكتروني أو رقم الشارة الخاص بك.' : 'Please enter your email or Badge ID.');
      return;
    }

    if (!password.trim()) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال كلمة المرور أو رمز PIN الخاص بك.' : 'Please enter your password or PIN.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await loginWithEmailOrBadge(identifier.trim(), password.trim());
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.message || (lang === 'ar' ? 'بيانات الاعتماد غير صالحة.' : 'Invalid credentials.'));
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || (lang === 'ar' ? 'حدث خطأ غير متوقع أثناء تسجيل الدخول.' : 'An unexpected error occurred.'));
    }
  };

  const handleDemoLogin = async (role: StaffRole) => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await quickDemoLogin(role);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || (lang === 'ar' ? 'فشل تسجيل الدخول كحساب تجريبي.' : 'Demo login failed.'));
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await loginWithGoogle();
      setLoading(false);
      if (!res.success) {
        setErrorMsg(res.message || (lang === 'ar' ? 'فشل تسجيل الدخول بواسطة Google.' : 'Google sign-in failed.'));
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || (lang === 'ar' ? 'حدث خطأ غير متوقع أثناء تسجيل الدخول بواسطة Google.' : 'Unexpected error during Google sign-in.'));
    }
  };

  return (
    <div
      id="login-screen-wrapper"
      className="min-h-screen bg-[#050a15] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Language Switcher Bar at the top */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLanguage(lang === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95 shadow-md shadow-black/30"
        >
          <Globe className="w-3.5 h-3.5 text-teal-400" />
          <span>{lang === 'ar' ? 'English (純 طبي)' : 'العربية (Clinical)'}</span>
        </button>
      </div>

      <div
        id="login-container"
        className="w-full max-w-md bg-[#0a1122]/90 border border-slate-800/80 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-6 relative z-10 backdrop-blur-md"
      >
        {/* Header Branding */}
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-slate-950 font-black text-2xl mx-auto shadow-lg shadow-teal-500/25">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              {lang === 'ar' ? 'العناية المركزة الباطنية Soli Medical' : 'Soli Medical MICU'}
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {lang === 'ar'
                ? 'محطة المراقبة السريرية والقياس عن بعد ICU-Sync'
                : 'ICU-Sync Central Telemetry Station'}
            </p>
          </div>
        </div>

        {/* Display Error Message */}
        {errorMsg && (
          <div
            id="login-error-banner"
            className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 text-xs font-medium rounded-xl flex items-center gap-2.5 shadow-sm animate-shake"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-850">
          <button
            type="button"
            onClick={() => {
              setActiveTab('credentials');
              setErrorMsg(null);
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'credentials'
                ? 'bg-slate-900 text-teal-400 border border-teal-500/20 shadow-md shadow-black/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Security Sign-In'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('demo');
              setErrorMsg(null);
            }}
            className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'demo'
                ? 'bg-slate-900 text-teal-400 border border-teal-500/20 shadow-md shadow-black/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'وصول سريع (تجريبي)' : 'Quick Demo Access'}</span>
          </button>
        </div>

        {activeTab === 'credentials' ? (
          /* Credentials Form */
          <form id="credentials-login-form" onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="identifier-input"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                {lang === 'ar' ? 'البريد الإلكتروني أو رقم الشارة الخاص بالمستشفى *' : 'Hospital Email or Badge ID *'}
              </label>
              <input
                id="identifier-input"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-all disabled:opacity-50"
                placeholder={lang === 'ar' ? 'مثال: badge-777 أو dr.ahmed@soli.med' : 'e.g. badge-777 or admin@soli.med'}
              />
            </div>

            <div>
              <label
                htmlFor="password-input"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                {lang === 'ar' ? 'كلمة المرور أو رمز PIN الخاص بك *' : 'Password or PIN Code *'}
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono transition-all disabled:opacity-50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300 p-1.5 cursor-pointer transition-colors ${
                    isRTL ? 'left-2.5' : 'right-2.5'
                  }`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{lang === 'ar' ? 'جاري التحقق...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-slate-950" />
                  <span>{lang === 'ar' ? 'تسجيل الدخول الآمن' : 'Secure Clinical Login'}</span>
                </>
              )}
            </button>

            {/* Separator */}
            <div className="relative flex items-center justify-center my-4 py-1">
              <div className="border-t border-slate-800/80 w-full" />
              <span className="absolute bg-[#0a1122] px-3 text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                {lang === 'ar' ? 'أو' : 'OR'}
              </span>
            </div>

            {/* Google Authentication Option */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 shadow-md shadow-black/25"
            >
              <svg className="w-3.5 h-3.5 text-red-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.136 4.113-3.555 0-6.437-2.882-6.437-6.437s2.882-6.437 6.437-6.437c1.554 0 2.98.548 4.113 1.455l3.111-3.111C18.995 1.944 15.82 1 12.24 1 6.136 1 1.25 6.136 1.25 12.24s4.886 11.24 10.99 11.24c6.236 0 11.24-4.886 11.24-11.24 0-.648-.051-1.334-.145-1.954H12.24z" />
              </svg>
              <span>{lang === 'ar' ? 'تسجيل بواسطة Google Workspace' : 'Sign in with Google Account'}</span>
            </button>
          </form>
        ) : (
          /* Quick Demo Login Grid */
          <div className="space-y-4">
            <div className="text-center p-3 bg-teal-950/20 border border-teal-500/20 rounded-2xl">
              <p className="text-[11px] text-teal-300 font-semibold leading-relaxed">
                {lang === 'ar'
                  ? 'اختر دورك الوظيفي السريري لتسجيل الدخول السريع وفحص محاكي العلامات والقياس عن بعد:'
                  : 'Select your clinical staff role to quickly preview the real-time ICU telemetry dashboard:'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleDemoLogin(StaffRole.ADMIN)}
                disabled={loading}
                className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl text-center transition-all cursor-pointer hover:shadow-lg disabled:opacity-50 group"
              >
                <p className="text-xs font-bold text-white group-hover:text-teal-400">
                  {lang === 'ar' ? 'مدير النظام (ADMIN)' : 'System Admin'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'ar' ? 'صلاحية كاملة وإعدادات' : 'Full access & logs'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin(StaffRole.CONSULTANT)}
                disabled={loading}
                className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl text-center transition-all cursor-pointer hover:shadow-lg disabled:opacity-50 group"
              >
                <p className="text-xs font-bold text-white group-hover:text-teal-400">
                  {lang === 'ar' ? 'استشاري (Consultant)' : 'Consultant MD'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'ar' ? 'اتخاذ القرار والتوقيع' : 'SBAR Sign-off'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin(StaffRole.SPECIALIST)}
                disabled={loading}
                className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl text-center transition-all cursor-pointer hover:shadow-lg disabled:opacity-50 group"
              >
                <p className="text-xs font-bold text-white group-hover:text-teal-400">
                  {lang === 'ar' ? 'أخصائي (Specialist)' : 'Specialist MD'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'ar' ? 'تعديل السجلات الطبية' : 'Manage patient dossier'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin(StaffRole.RESIDENT)}
                disabled={loading}
                className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl text-center transition-all cursor-pointer hover:shadow-lg disabled:opacity-50 group"
              >
                <p className="text-xs font-bold text-white group-hover:text-teal-400">
                  {lang === 'ar' ? 'مقيم (Resident)' : 'Resident MD'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'ar' ? 'كتابة ملاحظات وتأكيد' : 'Write notes & triage'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin(StaffRole.LEAD_RN)}
                disabled={loading}
                className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl text-center transition-all cursor-pointer hover:shadow-lg disabled:opacity-50 group"
              >
                <p className="text-xs font-bold text-white group-hover:text-teal-400">
                  {lang === 'ar' ? 'رئيس التمريض (Lead RN)' : 'Lead RN'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'ar' ? 'تنسيق الأسرة والورديات' : 'Triage & Bed manager'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin(StaffRole.BEDSIDE_RN)}
                disabled={loading}
                className="p-3 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-xl text-center transition-all cursor-pointer hover:shadow-lg disabled:opacity-50 group"
              >
                <p className="text-xs font-bold text-white group-hover:text-teal-400">
                  {lang === 'ar' ? 'ممرض مناوب (Bedside RN)' : 'Bedside RN'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {lang === 'ar' ? 'تسجيل العلامات والجرعات' : 'Vitals stream & infusions'}
                </p>
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 pt-2 text-teal-400 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{lang === 'ar' ? 'جاري الدخول السريع...' : 'Quick routing to Central Dashboard...'}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer Regulatory compliance statement */}
        <div className="text-center pt-2 border-t border-slate-800/60">
          <p className="text-[10px] text-slate-500 leading-normal">
            {lang === 'ar'
              ? 'بوابة آمنة ومتوافقة مع معايير CBAHI و JCI و HIPAA لتوثيق حالات المرضى في العناية المركزة.'
              : 'Secure & Authorized access portal. Compliant with CBAHI, JCI, and HIPAA ICU data privacy standards.'}
          </p>
        </div>
      </div>
    </div>
  );
};
