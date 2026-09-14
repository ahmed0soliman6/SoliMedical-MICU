import React, { useState } from 'react';
import { 
  Activity, 
  Lock, 
  User, 
  KeyRound, 
  LogIn, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles,
  Stethoscope,
  HeartPulse,
  Syringe,
  Pill,
  Wind,
  CheckCircle2,
  FileSearch
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useSettings } from '../services/SettingsContext.tsx';
import { StaffRole } from '../types/schema.ts';

export const LoginScreen: React.FC = () => {
  const { loginWithEmailOrBadge, loginWithGoogle, quickDemoLogin, allUsers } = useAuth();
  const { lang } = useSettings();

  const [identifier, setIdentifier] = useState('');
  const [pinOrPass, setPinOrPass] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !pinOrPass) {
      setErrorMsg(lang === 'ar' ? 'يرجى إدخال البريد الإلكتروني أو معرف البطاقة ورمز المرور' : 'Please enter Email/Badge ID and PIN');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const res = await loginWithEmailOrBadge(identifier, pinOrPass);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.message || (lang === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await loginWithGoogle();
    setIsLoading(false);
    if (!res.success) {
      setErrorMsg(res.message || 'Google login failed');
    }
  };

  const rolePresets = [
    { role: StaffRole.ADMIN, labelAr: 'المشرف العام / د. أحمد سليمان', labelEn: 'Super Admin (Dr. Ahmed)', icon: ShieldCheck, badge: 'ADM', color: 'from-amber-500 to-orange-600' },
    { role: StaffRole.CONSULTANT, labelAr: 'استشاري العناية / د. طارق المنصور', labelEn: 'ICU Consultant (Dr. Tariq)', icon: Stethoscope, badge: 'CON', color: 'from-teal-500 to-cyan-600' },
    { role: StaffRole.SPECIALIST, labelAr: 'أخصائي الرعاية / د. ليلى الغامدي', labelEn: 'ICU Specialist (Dr. Layla)', icon: HeartPulse, badge: 'SPC', color: 'from-emerald-500 to-teal-600' },
    { role: StaffRole.LEAD_RN, labelAr: 'مسؤول التمريض / م. سارة جنكينز', labelEn: 'Charge Nurse (RN Sarah)', icon: Syringe, badge: 'LEAD', color: 'from-blue-500 to-indigo-600' },
    { role: StaffRole.BEDSIDE_RN, labelAr: 'تمريض سريري / م. فاطمة الزهراني', labelEn: 'Bedside RN (RN Fatima)', icon: Activity, badge: 'RN', color: 'from-purple-500 to-pink-600' },
    { role: StaffRole.CLINICAL_PHARMACIST, labelAr: 'صيدلي إكلينيكي / ص. زيد العتيبي', labelEn: 'Pharmacist (Pharm. Zaid)', icon: Pill, badge: 'PHM', color: 'from-rose-500 to-red-600' },
    { role: StaffRole.RESPIRATORY_THERAPIST, labelAr: 'علاج تنفسي / أ. هشام محمود', labelEn: 'Resp. Therapist (RT Hisham)', icon: Wind, badge: 'RT', color: 'from-cyan-500 to-blue-600' },
    { role: StaffRole.AUDITOR, labelAr: 'مدقق جودة / أ. منى الحربي', labelEn: 'Quality Auditor (Mona)', icon: FileSearch, badge: 'AUD', color: 'from-slate-500 to-zinc-600' },
  ];

  return (
    <div className="min-h-screen w-full bg-[#050b14] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-600/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="w-full max-w-xl bg-[#0a1224] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10">
        
        {/* Branding & Hospital Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 p-0.5 shadow-lg shadow-teal-500/20 mb-3">
            <div className="w-full h-full bg-[#070d1a] rounded-[14px] flex items-center justify-center text-teal-400">
              <Activity className="w-7 h-7 animate-pulse" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {lang === 'ar' ? 'منظومة العناية المركزة • Soli Medical MICU' : 'Soli Medical MICU • Central Access'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'ar' 
              ? 'بوابة الدخول السريري الآمن وإدارة الصلاحيات (CBAHI & JCI Compliant)' 
              : 'Secure Clinical Access & Role-Based Authentication'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick Shift Changeover / Role Switcher */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>{lang === 'ar' ? 'التبديل السريع للكوادر السريرية (مناوبات العناية)' : 'Quick Clinical Role Switcher'}</span>
            </span>
            <span className="text-[10px] text-teal-400 font-mono font-semibold">{lang === 'ar' ? 'تسجيل فوري' : 'Instant Sign-in'}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {rolePresets.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.role}
                  type="button"
                  onClick={() => quickDemoLogin(preset.role)}
                  className="p-2.5 rounded-xl bg-[#0e172a] hover:bg-[#152238] border border-slate-800 hover:border-teal-500/60 flex flex-col items-center text-center transition-all group active:scale-95 cursor-pointer shadow-sm"
                  title={preset.labelEn}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${preset.color} flex items-center justify-center text-white mb-1.5 shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-200 group-hover:text-teal-300 truncate w-full">
                    {lang === 'ar' ? preset.labelAr.split('/')[0] : preset.badge}
                  </span>
                  <span className="text-[9px] text-slate-500 truncate w-full font-mono">
                    {lang === 'ar' ? preset.labelAr.split('/')[1] || preset.badge : preset.labelEn.split('(')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative flex items-center justify-center my-5">
          <div className="border-t border-slate-800 w-full"></div>
          <span className="bg-[#0a1224] px-3 text-[11px] text-slate-500 uppercase font-mono">
            {lang === 'ar' ? 'أو تسجيل الدخول بالمعرف / PIN' : 'or Standard Login'}
          </span>
          <div className="border-t border-slate-800 w-full"></div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {lang === 'ar' ? 'البريد الإلكتروني أو معرف البطاقة (Badge ID / Email)' : 'Email or Badge ID'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none"
                placeholder={lang === 'ar' ? 'مثال: ahmed0soliman6@gmail.com أو ADM-001' : 'e.g. admin@micu.org or ADM-001'}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                {lang === 'ar' ? 'رمز المرور أو PIN السريري' : 'Password or Clinical PIN'}
              </label>
              <span className="text-[10px] text-slate-500 font-mono">{lang === 'ar' ? 'الافتراضي: 1234' : 'Default: 1234'}</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={pinOrPass}
                onChange={(e) => setPinOrPass(e.target.value)}
                required
                className="w-full bg-[#080f1e] border border-slate-700 focus:border-teal-400 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none font-mono"
                placeholder="••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-lg shadow-teal-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4 text-slate-950" />
                <span>{lang === 'ar' ? 'تسجيل الدخول إلى محطة العناية' : 'Sign In to Central Station'}</span>
              </>
            )}
          </button>
        </form>

        {/* Google Sign-In */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-teal-500 text-slate-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2.5 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{lang === 'ar' ? 'الدخول بحساب Google' : 'Sign in with Google'}</span>
          </button>
        </div>

        {/* Footer Security Badge */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>CBAHI & JCI Verified</span>
          </div>
          <div>Firebase Firestore Live</div>
        </div>

      </div>
    </div>
  );
};
