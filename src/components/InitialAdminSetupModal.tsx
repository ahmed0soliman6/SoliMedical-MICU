import React, { useState } from 'react';
import { Shield, Sparkles, User, Lock, UserCheck, Briefcase, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';

export const InitialAdminSetupModal: React.FC = () => {
  const { registerFirstUser } = useAuth();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('رئيس قسم العناية المركزة الباطنة');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedUsername = username.trim();
    const trimmedFullName = fullName.trim();
    const trimmedJobTitle = jobTitle.trim();

    if (!trimmedUsername) {
      setErrorMsg('يرجى إدخال اسم المستخدم');
      return;
    }
    if (!password) {
      setErrorMsg('يرجى إدخال كلمة المرور');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }
    if (!trimmedFullName) {
      setErrorMsg('يرجى إدخال الاسم الكامل للمستخدم الأول');
      return;
    }
    if (!trimmedJobTitle) {
      setErrorMsg('يرجى إدخال الوظيفة / الدور السريري');
      return;
    }

    setIsSubmitting(true);

    const res = await registerFirstUser({
      username: trimmedUsername,
      password: password,
      fullName: trimmedFullName,
      jobTitle: trimmedJobTitle,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message || 'حدث خطأ أثناء إنشاء الأول مستخدم في Firebase');
    } else {
      setSuccessMsg('تم إنشاء أول مستخدم بنجاح في Firebase Authentication وFirestore! جاري تحويلك إلى صفحة تسجيل الدخول...');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 overflow-y-auto font-sans text-right" dir="rtl">
      <div className="relative w-full max-w-lg bg-[#081326] border border-teal-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 animate-fade-in text-slate-100 my-auto">
        
        {/* Glow Header Accent */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-500 text-slate-950 text-[11px] font-black uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1.5 whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5 text-slate-950" />
          <span>إنشاء أول مستخدم (First User Setup) • المنظومة المصرية</span>
        </div>

        {/* Title & Branding */}
        <div className="text-center mt-3 mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-b from-[#09223e] to-[#040e1e] border border-teal-400/40 p-2.5 shadow-xl flex items-center justify-center text-teal-300">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            إنشاء حساب أول مستخدم للوحدة
          </h1>
          <p className="text-xs text-teal-200/80 mt-1">
            منظومة إدارة وتسليم العناية المركزة الباطنة (جمهورية مصر العربية)
          </p>
          <div className="mt-2.5 inline-block px-3 py-1 bg-teal-950/60 border border-teal-500/30 rounded-lg text-[11px] text-teal-300 font-medium">
            تظهر هذه الصفحة تلقائياً لعدم وجود مستخدم ADMIN مسجل مسبقاً في Firebase
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs flex items-center gap-2.5 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-teal-950/80 border border-teal-400 text-teal-200 text-xs flex items-center gap-2.5 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* First User Setup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. Username */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="setup-username">
              1. اسم المستخدم (Username)
            </label>
            <div className="relative rounded-xl shadow-inner">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4 text-teal-400/80" />
              </div>
              <input 
                id="setup-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: admin أو soliman"
                required
                className="w-full pr-10 pl-3 py-3 bg-[#050b17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition-all text-right font-sans"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1 pr-1">
              * سيتم تحويله تلقائياً لبريد إلكتروني معتمد في Firebase Authentication
            </p>
          </div>

          {/* 2. Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="setup-password">
              2. كلمة المرور (Password)
            </label>
            <div className="relative rounded-xl shadow-inner">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4 text-teal-400/80" />
              </div>
              <input 
                id="setup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                required
                className="w-full pr-10 pl-3 py-3 bg-[#050b17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition-all text-left font-mono tracking-widest"
              />
            </div>
          </div>

          {/* 3. Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="setup-confirm-password">
              3. تأكيد كلمة المرور (Confirm Password)
            </label>
            <div className="relative rounded-xl shadow-inner">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4 text-teal-400/80" />
              </div>
              <input 
                id="setup-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="إعادة كتابة كلمة المرور"
                required
                className="w-full pr-10 pl-3 py-3 bg-[#050b17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition-all text-left font-mono tracking-widest"
              />
            </div>
          </div>

          {/* 4. Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="setup-fullname">
              4. الاسم الكامل (Full Name)
            </label>
            <div className="relative rounded-xl shadow-inner">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <UserCheck className="w-4 h-4 text-teal-400/80" />
              </div>
              <input 
                id="setup-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: د. أحمد سليمان"
                required
                className="w-full pr-10 pl-3 py-3 bg-[#050b17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition-all text-right font-sans"
              />
            </div>
          </div>

          {/* 5. Job Title / Role */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="setup-jobtitle">
              5. الوظيفة / الدور (Job Title / Position)
            </label>
            <div className="relative rounded-xl shadow-inner">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Briefcase className="w-4 h-4 text-teal-400/80" />
              </div>
              <input 
                id="setup-jobtitle"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="مثال: رئيس قسم العناية المركزة الباطنة"
                required
                className="w-full pr-10 pl-3 py-3 bg-[#050b17] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 transition-all text-right font-sans"
              />
            </div>
            <p className="text-[10px] text-teal-300/80 mt-1 pr-1">
              * سيتم منحه صلاحيات المدير العام (ADMIN / Super Admin) وتفعيله تلقائياً (active = true)
            </p>
          </div>

          <div className="p-3 bg-teal-950/40 border border-teal-500/20 rounded-xl text-[11px] text-teal-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>معتمد وفقاً لمعايير نقابة أطباء مصر والهيئة العامة للاعتماد والرقابة الصحية (GAHAR).</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-400 via-teal-300 to-cyan-400 text-slate-950 font-black text-sm tracking-wide transition duration-150 ease-in-out cursor-pointer active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_20px_-2px_rgba(20,184,166,0.4)] mt-2"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-5 h-5 text-slate-950" />
                <span>إنشاء أول مستخدم</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
