import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  Activity, 
  Trash2, 
  Sliders, 
  Sparkles, 
  ShieldCheck, 
  User, 
  Pencil, 
  Loader2, 
  Plus, 
  Lock, 
  Search, 
  Key, 
  UserPlus, 
  Power, 
  UserX,
  ShieldAlert,
  Shield
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { StaffRole } from '../types/schema.ts';
import { AuditLogsSection } from './AuditLogsSection.tsx';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const { 
    allUsers, 
    currentUser, 
    createUser, 
    updateUser, 
    changeUserPassword, 
    toggleUserStatus, 
    deleteUser, 
    refreshUsers 
  } = useAuth();

  const { lang, isRTL } = useTranslation();

  const [activeSubTab, setActiveSubTab] = useState<'users' | 'audit'>('users');
  const [searchTerm, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Form states
  const [showAddEditForm, setShowAddEditForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [roleInput, setRoleInput] = useState<StaffRole>(StaffRole.BEDSIDE_RN);
  
  // Password Reset modal states
  const [resettingUser, setResetingUser] = useState<any | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // Status & loading messages
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && refreshUsers) {
      refreshUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenAddForm = () => {
    setEditingUser(null);
    setEmailInput('');
    setNameInput('');
    setPasswordInput('');
    setRoleInput(StaffRole.BEDSIDE_RN);
    setStatusMsg(null);
    setShowAddEditForm(true);
  };

  const handleOpenEditForm = (user: any) => {
    setEditingUser(user);
    // Extract username/prefix before email
    setEmailInput(user.email ? user.email.split('@')[0] : user.badgeId);
    setNameInput(user.nameAr || user.nameEn || '');
    setPasswordInput('');
    setRoleInput(user.role || StaffRole.BEDSIDE_RN);
    setStatusMsg(null);
    setShowAddEditForm(true);
  };

  // Helper function to map default permissions for roles
  const getDefaultPermissionsForRole = (role: StaffRole) => {
    switch (role) {
      case StaffRole.ADMIN:
        return { 'clinicalNotes.delete': true, 'patients.delete': true, 'users.manage': true };
      case StaffRole.CONSULTANT:
        return { 'clinicalNotes.delete': false, 'patients.delete': false, 'sbar.sign': true };
      default:
        return { 'clinicalNotes.delete': false, 'patients.delete': false };
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || (!editingUser && !passwordInput.trim())) {
      setStatusMsg({
        type: 'error',
        text: lang === 'ar' ? 'يرجى ملء كافة الحقول المطلوبة.' : 'Please fill out all required fields.'
      });
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      if (editingUser) {
        // Update user
        const res = await updateUser(editingUser.uid, {
          nameAr: nameInput.trim(),
          nameEn: nameInput.trim(),
          role: roleInput
        });

        if (res.success) {
          setStatusMsg({
            type: 'success',
            text: lang === 'ar' ? 'تم تحديث بيانات المستخدم بنجاح.' : 'User updated successfully.'
          });
          setTimeout(() => setShowAddEditForm(false), 1200);
        } else {
          setStatusMsg({
            type: 'error',
            text: res.message || (lang === 'ar' ? 'فشل تحديث بيانات المستخدم.' : 'Failed to update user.')
          });
        }
      } else {
        // Create user
        const res = await createUser({
          username: emailInput.trim(),
          password: passwordInput.trim(),
          displayName: nameInput.trim(),
          role: roleInput,
          permissions: getDefaultPermissionsForRole(roleInput)
        });

        if (res.success) {
          setStatusMsg({
            type: 'success',
            text: lang === 'ar' ? 'تم إنشاء حساب المستخدم بنجاح.' : 'User account created successfully.'
          });
          setTimeout(() => setShowAddEditForm(false), 1200);
        } else {
          setStatusMsg({
            type: 'error',
            text: res.message || (lang === 'ar' ? 'فشل إنشاء حساب المستخدم.' : 'Failed to create user.')
          });
        }
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || (lang === 'ar' ? 'حدث خطأ غير متوقع.' : 'Unexpected operation error.')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: any) => {
    setTogglingUid(user.uid);
    try {
      const currentActive = user.isActive !== false && user.active !== false;
      await toggleUserStatus(user.uid, !currentActive);
    } catch (err) {
      console.warn('Toggle user status exception:', err);
    } finally {
      setTogglingUid(null);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (user.uid === currentUser?.uid) {
      alert(lang === 'ar' ? 'لا يمكنك حذف حسابك الخاص الذي تسجل الدخول به حالياً.' : 'You cannot delete your own active session account.');
      return;
    }

    if (confirm(lang === 'ar' ? `هل أنت متأكد من حذف حساب "${user.nameAr || user.nameEn}" نهائياً؟` : `Delete clinical staff account "${user.nameEn || user.nameAr}" permanently?`)) {
      try {
        await deleteUser(user.uid);
      } catch (err) {
        console.warn('Delete user exception:', err);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPasswordInput.trim()) return;

    setLoading(true);
    try {
      const res = await changeUserPassword(resettingUser.uid, newPasswordInput.trim());
      if (res.success) {
        alert(lang === 'ar' ? 'تم تغيير كلمة المرور/الرمز بنجاح.' : 'Password reset successfully.');
        setResetingUser(null);
        setNewPasswordInput('');
      } else {
        alert(res.message || 'Operation failed');
      }
    } catch (err: any) {
      alert(err?.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Filter users
  const filteredUsers = (allUsers || []).filter(user => {
    const query = searchTerm.toLowerCase().trim();
    const matchSearch = !query || 
      (user.nameAr || '').toLowerCase().includes(query) ||
      (user.nameEn || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query) ||
      (user.badgeId || '').toLowerCase().includes(query);

    const matchRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-5xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Section */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#080f1e] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'إدارة الكادر الطبي وسجلات الأمان' : 'User Accounts & Security Audit'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar' ? 'إدارة صلاحيات الكادر الطبي وسجلات التدقيق الموثقة بالسحابة' : 'Manage ICU staff permissions and cloud security logs'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tab Navigation */}
        <div className="px-6 pt-3 bg-slate-50/60 dark:bg-[#080f1e]/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('users')}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'users'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>{lang === 'ar' ? 'الكادر الطبي والمستخدمين' : 'Clinical Staff Directory'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('audit')}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'audit'
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>{lang === 'ar' ? 'سجلات الأمان والتدقيق' : 'Security Audit Trail'}</span>
            </button>
          </div>

          {activeSubTab === 'users' && (
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer mb-3"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'ar' ? 'إضافة مستخدم جديد' : 'Add New Staff'}</span>
            </button>
          )}
        </div>

        {/* Modal Body Container */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeSubTab === 'audit' ? (
            <AuditLogsSection />
          ) : (
            <div className="space-y-4">
              {/* Search & Filter Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'ar' ? 'بحث بالاسم، الكود، أو البريد...' : 'Search by name, badge ID, or email...'}
                    className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  {['ALL', StaffRole.ADMIN, StaffRole.CONSULTANT, StaffRole.RESIDENT, StaffRole.BEDSIDE_RN].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        roleFilter === role
                          ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      {role === 'ALL' ? (lang === 'ar' ? 'الكل' : 'All') : role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Users Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.map((user) => {
                  const isActive = user.isActive !== false && user.active !== false;
                  return (
                    <div 
                      key={user.uid} 
                      className="p-4 bg-white dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-950 dark:text-white truncate text-sm">
                            {user.nameAr || user.nameEn || user.email}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-teal-600 dark:text-teal-300">
                            {user.role}
                          </span>
                          {!isActive && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-red-150 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                              {lang === 'ar' ? 'معطل' : 'INACTIVE'}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-mono text-[10px] truncate">
                          {user.email || 'No email'} • Badge: {user.badgeId || '—'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(user)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                          title={lang === 'ar' ? 'تعديل الدور' : 'Edit Role'}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setResetingUser(user);
                            setNewPasswordInput('');
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
                          title={lang === 'ar' ? 'تغيير كلمة المرور' : 'Reset Password'}
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={togglingUid === user.uid}
                          className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                            isActive 
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30' 
                              : 'bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/30'
                          }`}
                          title={isActive ? (lang === 'ar' ? 'تعطيل الحساب' : 'Deactivate') : (lang === 'ar' ? 'تفعيل الحساب' : 'Activate')}
                        >
                          {togglingUid === user.uid ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-red-100 dark:bg-slate-900 dark:hover:bg-red-950/40 text-slate-500 hover:text-red-500 dark:text-slate-400 cursor-pointer transition-colors"
                          title={lang === 'ar' ? 'حذف الحساب نهائياً' : 'Delete Account'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Staff Modal Form */}
      {showAddEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0a1122] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {editingUser ? (lang === 'ar' ? 'تعديل صلاحيات المستخدم' : 'Edit Staff Role') : (lang === 'ar' ? 'إضافة مستخدم سريري جديد' : 'Add New Clinical Staff')}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEditForm(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Cancel'}
              </button>
            </div>

            {statusMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${statusMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20' : 'bg-red-950/40 text-red-300 border border-red-500/20'}`}>
                {statusMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {lang === 'ar' ? 'الاسم الكامل المعتمد بالمستشفى *' : 'Full Professional Display Name *'}
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  placeholder="e.g. Dr. Ahmed Al-Mansoori"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {lang === 'ar' ? 'رقم الشارة أو اسم المستخدم (Username) *' : 'Badge ID / Username *'}
                </label>
                <input
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={!!editingUser}
                  required
                  placeholder="e.g. badge-777 or dr.ahmed"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none disabled:opacity-50"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    {lang === 'ar' ? 'كلمة المرور أو رمز PIN الأولي (أدنى حد 6 أحرف) *' : 'Initial Password or PIN Code (min 6) *'}
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {lang === 'ar' ? 'الدور الوظيفي والصلاحيات الطبية (Role) *' : 'Clinical ICU Role / Role Permissions *'}
                </label>
                <select
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as StaffRole)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  <option value={StaffRole.BEDSIDE_RN}>{lang === 'ar' ? 'ممرض مناوب (Bedside RN)' : 'Bedside RN'}</option>
                  <option value={StaffRole.LEAD_RN}>{lang === 'ar' ? 'رئيس التمريض (Lead RN)' : 'Lead RN'}</option>
                  <option value={StaffRole.RESIDENT}>{lang === 'ar' ? 'طبيب مقيم (Resident MD)' : 'Resident MD'}</option>
                  <option value={StaffRole.SPECIALIST}>{lang === 'ar' ? 'أخصائي العناية (Specialist MD)' : 'Specialist MD'}</option>
                  <option value={StaffRole.CONSULTANT}>{lang === 'ar' ? 'استشاري العناية (Consultant MD)' : 'Consultant MD'}</option>
                  <option value={StaffRole.CLINICAL_PHARMACIST}>{lang === 'ar' ? 'صيدلي سريري' : 'Clinical Pharmacist'}</option>
                  <option value={StaffRole.RESPIRATORY_THERAPIST}>{lang === 'ar' ? 'أخصائي تنفسية' : 'Respiratory Therapist'}</option>
                  <option value={StaffRole.ADMIN}>{lang === 'ar' ? 'مدير النظام (ADMIN)' : 'System Admin'}</option>
                  <option value={StaffRole.AUDITOR}>{lang === 'ar' ? 'مدقق تدقيق الجودة' : 'Quality Auditor'}</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-950" />}
                <span>{editingUser ? (lang === 'ar' ? 'حفظ التعديلات' : 'Update User') : (lang === 'ar' ? 'إنشاء حساب الموظف' : 'Create Staff Account')}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal Form */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[#0a1122] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {lang === 'ar' ? 'إعادة تعيين كلمة المرور' : 'Reset Staff Password'}
              </h3>
              <button
                type="button"
                onClick={() => setResetingUser(null)}
                className="text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                {lang === 'ar' ? 'إغلاق' : 'Cancel'}
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 leading-normal">
                  {lang === 'ar' 
                    ? `إدخال كلمة المرور أو الرمز الجديد للمستخدم: ${resettingUser.nameAr || resettingUser.nameEn}`
                    : `Enter the new password or PIN code for: ${resettingUser.nameEn || resettingUser.nameAr}`}
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  {lang === 'ar' ? 'الرمز الجديد (أدنى حد 6 أحرف) *' : 'New Password / PIN Code (min 6) *'}
                </label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-teal-400 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-950" />}
                <span>{lang === 'ar' ? 'تأكيد الحفظ وإعادة التعيين' : 'Save & Reset PIN'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
