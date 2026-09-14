import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldCheck, 
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';

import { SoliLogo } from './SoliLogo.tsx';

export const LoginScreen: React.FC = () => {
  const { loginWithEmailOrBadge } = useAuth();

  const [username, setUsername] = useState('Admin');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const res = await loginWithEmailOrBadge(username, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.message || 'بيانات الدخول غير صحيحة');
    }
  };

  return (
    <div 
      className="text-slate-200 antialiased selection:bg-cyan-500 selection:text-black flex flex-col justify-between items-center px-4 py-8 max-w-[430px] mx-auto min-h-screen w-full"
      style={{
        background: 'radial-gradient(circle at 50% 15%, #0d2847 0%, #050f21 55%, #02060f 100%)'
      }}
    >
      {/* HEADER SECTION: Clinic Logo, Monogram Badge & Title */}
      <header className="w-full flex flex-col items-center text-center mt-2 mb-6" data-purpose="clinic-branding">
        {/* Glowing Official Soli Medical MICU Logo */}
        <div 
          className="w-28 h-28 rounded-3xl bg-transparent flex items-center justify-center p-1 relative mb-4 shadow-2xl"
          style={{
            filter: 'drop-shadow(0 0 25px rgba(0, 229, 255, 0.35))'
          }}
        >
          <SoliLogo className="w-full h-full" />
        </div>

        {/* Main Title */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif mb-1.5 drop-shadow-sm">
          Soli Medical MICU
        </h1>

        {/* Subtitle matching Egyptian MICU Context */}
        <p className="text-xs sm:text-sm text-cyan-200/70 font-normal leading-relaxed">
          نظام العناية المركزة الباطنة • جمهورية مصر العربية
        </p>
      </header>

      {/* LOGIN CARD SECTION - Ultra Clean (ONLY Username & Password) */}
      <main 
        className="w-full rounded-3xl bg-[#081326]/90 backdrop-blur-xl p-5 sm:p-6 shadow-2xl mb-6"
        style={{
          border: '1px solid rgba(0, 229, 255, 0.22)',
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.7), inset 0 1px 1px 0 rgba(255, 255, 255, 0.05)'
        }}
        data-purpose="login-container"
      >
        {/* Header of Form */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-5">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-medium tracking-wide bg-cyan-950/70 text-cyan-400 border border-cyan-800/50">
            v2.6 RBAC
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100">تسجيل الدخول للنظام</span>
            <Lock className="w-4 h-4 text-[#00f2fe]" />
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Controls: ONLY Username & Password */}
        <form className="space-y-4" onSubmit={handleLogin}>
          {/* Field: Username */}
          <div>
            <label className="block text-right text-xs font-medium text-slate-300 mb-1.5" htmlFor="username">
              اسم المستخدم
            </label>
            <div className="relative rounded-xl shadow-inner">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4 text-cyan-500/70" />
              </div>
              <input 
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin"
                required
                className="w-full pr-10 pl-3 py-3 bg-[#050b17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#00f2fe] focus:border-[#00f2fe] transition-all text-right font-sans tracking-wide"
              />
            </div>
          </div>

          {/* Field: Password */}
          <div>
            <label className="block text-right text-xs font-medium text-slate-300 mb-1.5" htmlFor="password">
              كلمة المرور
            </label>
            <div className="relative rounded-xl shadow-inner">
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="إظهار أو إخفاء كلمة المرور"
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center transition-colors cursor-pointer ${showPassword ? 'text-cyan-400' : 'text-slate-400 hover:text-cyan-400'}`}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>

              <input 
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-3 py-3 bg-[#050b17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#00f2fe] focus:border-[#00f2fe] transition-all text-left font-mono tracking-widest"
              />
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#00d2d3] via-[#00f2fe] to-[#00b4d8] hover:opacity-95 text-slate-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm tracking-wide transition duration-150 ease-in-out cursor-pointer active:scale-[0.99] disabled:opacity-50"
              style={{
                boxShadow: '0 4px 20px -2px rgba(0, 242, 254, 0.45)'
              }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <LogIn className="w-4 h-4 rotate-180 text-slate-950" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* FOOTER SECTION */}
      <footer className="w-full text-center space-y-1.5 pb-2" data-purpose="site-footer">
        <p className="text-[11px] text-slate-400 leading-relaxed dir-ltr">
          © 2026 Soli Medical MICU Systems (Egypt). <span className="font-sans">جميع الحقوق محفوظة.</span>
        </p>
        <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
          <span>نظام محمي وفقاً لمعايير نقابة أطباء مصر والهيئة العامة للاعتماد والرقابة الصحية (GAHAR)</span>
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-500/60" />
        </p>
      </footer>
    </div>
  );
};
