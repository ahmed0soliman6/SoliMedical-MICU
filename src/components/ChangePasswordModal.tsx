import React, { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { lang, isRTL } = useTranslation();
  const { changeMyOwnPassword } = useAuth();

  const [oldPassInput, setOldPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setOldPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
      setShowOldPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
      setStatusMsg(null);
      setLoading(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!oldPassInput.trim()) {
      setStatusMsg({
        type: 'error',
        text: lang === 'ar' ? 'يرجى إدخال كلمة المرور القديمة الحالية.' : 'Please enter your current password.'
      });
      return;
    }

    if (!newPassInput.trim() || newPassInput.trim().length < 6) {
      setStatusMsg({
        type: 'error',
        text: lang === 'ar' ? 'كلمة المرور الجديدة يجب ألا تقل عن 6 أحرف أو أرقام.' : 'New password must be at least 6 characters.'
      });
      return;
    }

    if (newPassInput.trim() !== confirmPassInput.trim()) {
      setStatusMsg({
        type: 'error',
        text: lang === 'ar' ? 'كلمتا المرور الجديدتان غير متطابقتين.' : 'New passwords do not match.'
      });
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      const res = await changeMyOwnPassword(oldPassInput.trim(), newPassInput.trim(), confirmPassInput.trim());
      setLoading(false);

      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: res.message || (lang === 'ar' ? 'تم تغيير كلمة المرور بنجاح.' : 'Password updated successfully.')
        });
        setTimeout(() => {
          onClose();
        }, 1300);
      } else {
        setStatusMsg({
          type: 'error',
          text: res.message || (lang === 'ar' ? 'فشل تغيير كلمة المرور.' : 'Failed to change password.')
        });
      }
    } catch (err: any) {
      setLoading(false);
      setStatusMsg({
        type: 'error',
        text: err?.message || (lang === 'ar' ? 'حدث خطأ غير متوقع أثناء تغيير كلمة المرور.' : 'Unexpected error changing password.')
      });
    }
  };

  return (
    <div
      id="change-password-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div
        id="change-password-modal-card"
        className="w-full max-w-md bg-[#0a1224] border border-teal-500/40 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div id="change-password-header" className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? 'تغيير كلمة المرور الخاصة' : 'Change Personal Password'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'أدخل كلمة المرور القديمة ثم الجديدة لتحديث حسابك' : 'Enter current password then new password to update'}
              </p>
            </div>
          </div>
          <button
            id="change-password-close-btn"
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            title={lang === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Message Notification */}
        {statusMsg && (
          <div
            id="change-password-status-banner"
            className={`p-3 rounded-xl text-xs flex items-center gap-2.5 transition-all ${
              statusMsg.type === 'success'
                ? 'bg-teal-950/70 border border-teal-500/60 text-teal-200 shadow-sm'
                : 'bg-red-950/70 border border-red-500/60 text-red-200 shadow-sm'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="font-medium leading-relaxed">{statusMsg.text}</span>
          </div>
        )}

        {/* Password Form */}
        <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Old Password */}
          <div>
            <label
              htmlFor="old-password-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              {lang === 'ar' ? 'كلمة المرور القديمة الحالية *' : 'Current Password *'}
            </label>
            <div className="relative">
              <input
                id="old-password-input"
                type={showOldPass ? 'text' : 'password'}
                value={oldPassInput}
                onChange={(e) => setOldPassInput(e.target.value)}
                disabled={loading}
                required
                autoComplete="current-password"
                className="w-full bg-[#050b17] border border-slate-700 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono transition-colors disabled:opacity-50"
                placeholder="••••••••"
              />
              <button
                id="toggle-old-password-visibility"
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                disabled={loading}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300 p-1.5 cursor-pointer transition-colors ${
                  isRTL ? 'left-2.5' : 'right-2.5'
                }`}
                title={showOldPass ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}
              >
                {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2. New Password */}
          <div>
            <label
              htmlFor="new-password-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              {lang === 'ar' ? 'كلمة المرور الجديدة (6 أحرف على الأقل) *' : 'New Password (min 6 chars) *'}
            </label>
            <div className="relative">
              <input
                id="new-password-input"
                type={showNewPass ? 'text' : 'password'}
                value={newPassInput}
                onChange={(e) => setNewPassInput(e.target.value)}
                disabled={loading}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-[#050b17] border border-slate-700 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono transition-colors disabled:opacity-50"
                placeholder="••••••••"
              />
              <button
                id="toggle-new-password-visibility"
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                disabled={loading}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300 p-1.5 cursor-pointer transition-colors ${
                  isRTL ? 'left-2.5' : 'right-2.5'
                }`}
                title={showNewPass ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}
              >
                {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 3. Confirm New Password */}
          <div>
            <label
              htmlFor="confirm-password-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              {lang === 'ar' ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
            </label>
            <div className="relative">
              <input
                id="confirm-password-input"
                type={showConfirmPass ? 'text' : 'password'}
                value={confirmPassInput}
                onChange={(e) => setConfirmPassInput(e.target.value)}
                disabled={loading}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-[#050b17] border border-slate-700 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono transition-colors disabled:opacity-50"
                placeholder="••••••••"
              />
              <button
                id="toggle-confirm-password-visibility"
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                disabled={loading}
                className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300 p-1.5 cursor-pointer transition-colors ${
                  isRTL ? 'left-2.5' : 'right-2.5'
                }`}
                title={showConfirmPass ? (lang === 'ar' ? 'إخفاء' : 'Hide') : (lang === 'ar' ? 'إظهار' : 'Show')}
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Modal Actions */}
          <div id="change-password-actions" className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              id="change-password-cancel-btn"
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer transition-colors disabled:opacity-50"
            >
              {lang === 'ar' ? 'إغلاق' : 'Cancel'}
            </button>
            <button
              id="change-password-submit-btn"
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>{lang === 'ar' ? 'جاري التحديث...' : 'Updating...'}</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تحديث كلمة المرور' : 'Update Password'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
