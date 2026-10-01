import React, { useState } from 'react';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldCheck, 
  AlertCircle,
  KeyRound,
  CheckCircle2,
  X
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../services/firebase.ts';
import { API_BASE_URL } from '../config/api.ts';

import { SoliLogo } from './SoliLogo.tsx';

export const LoginScreen: React.FC = () => {
  const { loginWithEmailOrBadge } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotToken, setForgotToken] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotInput.trim() || !forgotToken.trim() || !forgotNewPass.trim()) {
      setForgotMsg({ type: 'error', text: 'يرجى إدخال اسم المستخدم، رمز التشفير (كود الاستعادة)، وكلمة المرور الجديدة.' });
      return;
    }
    if (forgotNewPass.trim().length < 6) {
      setForgotMsg({ type: 'error', text: 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو أرقام.' });
      return;
    }

    setForgotLoading(true);
    setForgotMsg(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: forgotInput.trim(),
          recoveryCode: forgotToken.trim(),
          newPassword: forgotNewPass.trim()
        })
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setForgotMsg({ type: 'error', text: 'تعذر الاتصال بالخادم الرئيسي للنظام. يرجى المحاولة بعد قليل.' });
        return;
      }
      const data = await response.json();
      if (data.success) {
        setForgotMsg({ type: 'success', text: data.message || 'تمت استعادة كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.' });
        setTimeout(() => {
          setShowForgotModal(false);
          setForgotInput('');
          setForgotToken('');
          setForgotNewPass('');
          setForgotMsg(null);
        }, 2000);
      } else {
        setForgotMsg({ type: 'error', text: data.message || 'فشل عملية الاستعادة. تحقق من صحة رمز التشفير واسم المستخدم.' });
      }
    } catch (err: any) {
      setForgotMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء الاتصال بالخادم.' });
    } finally {
      setForgotLoading(false);
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
              اسم المستخدم أو البريد الإلكتروني
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
                placeholder="اسم المستخدم أو البريد الإلكتروني"
                required
                className="w-full pr-10 pl-3 py-3 bg-[#050b17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#00f2fe] focus:border-[#00f2fe] transition-all text-right font-sans tracking-wide"
              />
            </div>
          </div>

          {/* Field: Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(true);
                  setForgotInput(username);
                  setForgotMsg(null);
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                نسيت كلمة المرور؟
              </button>
              <label className="block text-right text-xs font-medium text-slate-300" htmlFor="password">
                كلمة المرور
              </label>
            </div>
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

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0a1224] border border-cyan-500/40 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    استعادة كلمة المرور
                  </h3>
                  <p className="text-xs text-slate-400">
                    أدخل البيانات المطلوبة لتعيين كلمة مرور جديدة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {forgotMsg && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                forgotMsg.type === 'success' ? 'bg-cyan-950/60 border border-cyan-500/50 text-cyan-200' : 'bg-red-950/60 border border-red-500/50 text-red-200'
              }`}>
                {forgotMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <span>{forgotMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-right text-xs font-medium text-slate-300 mb-1" htmlFor="forgot-username">
                  اسم المستخدم أو البريد الإلكتروني
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4 text-cyan-500/70" />
                  </div>
                  <input
                    id="forgot-username"
                    type="text"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    placeholder=""
                    required
                    autoComplete="off"
                    className="w-full pr-10 pl-3 py-2.5 bg-[#050b17] border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 text-right font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-right text-xs font-medium text-slate-300 mb-1" htmlFor="forgot-token">
                  رمز التشفير / كود الاستعادة
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4 text-cyan-500/70" />
                  </div>
                  <input
                    id="forgot-token"
                    type="password"
                    value={forgotToken}
                    onChange={(e) => setForgotToken(e.target.value)}
                    placeholder=""
                    required
                    autoComplete="off"
                    className="w-full pr-10 pl-3 py-2.5 bg-[#050b17] border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 text-right font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-right text-xs font-medium text-slate-300 mb-1" htmlFor="forgot-newpass">
                  كلمة المرور الجديدة (6 أحرف على الأقل)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4 text-cyan-500/70" />
                  </div>
                  <input
                    id="forgot-newpass"
                    type="password"
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder=""
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full pr-10 pl-3 py-2.5 bg-[#050b17] border border-slate-700 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 text-left font-mono tracking-widest"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:opacity-95 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {forgotLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>تحديث كلمة المرور بالرمز</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
