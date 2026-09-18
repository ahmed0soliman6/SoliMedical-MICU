import React, { useState } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Edit, 
  Lock, 
  KeyRound, 
  Stethoscope, 
  Activity, 
  BadgeCheck,
  Building,
  Sparkles,
  Sliders,
  Search,
  Filter,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  UserX
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useTranslation } from '../services/i18n.ts';
import { StaffRole, IcuUser, UserPermissions } from '../types/schema.ts';
import { getDefaultPermissionsForRole } from '../services/firebase.ts';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const { allUsers, currentUser, createUser, updateUser, changeUserPassword, toggleUserStatus, deleteUser } = useAuth();
  const { lang, isRTL } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isAddMode, setIsAddMode] = useState(false);
  const [editingUser, setEditingUser] = useState<IcuUser | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [userToDelete, setUserToDelete] = useState<IcuUser | null>(null);

  // Change Password state
  const [userToChangePassword, setUserToChangePassword] = useState<IcuUser | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changePassStatus, setChangePassStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states for creating/editing user
  const [formUsername, setFormUsername] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<StaffRole>(StaffRole.BEDSIDE_RN);
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(
    getDefaultPermissionsForRole(StaffRole.BEDSIDE_RN)
  );
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleRoleChange = (role: StaffRole) => {
    setFormRole(role);
    setFormPermissions(getDefaultPermissionsForRole(role));
  };

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormDisplayName('');
    setFormPassword('');
    setShowFormPassword(false);
    setFormRole(StaffRole.BEDSIDE_RN);
    setFormPermissions(getDefaultPermissionsForRole(StaffRole.BEDSIDE_RN));
    setIsAddMode(true);
    setStatusMsg(null);
  };

  const handleOpenEdit = (user: IcuUser) => {
    setEditingUser(user);
    const uname = user.email.includes('@solimedical-micu.org') 
      ? user.email.replace('@solimedical-micu.org', '') 
      : (user.email.split('@')[0] || user.badgeId);
    setFormUsername(uname);
    setFormDisplayName(user.nameAr || user.nameEn);
    setFormPassword(user.pinCode || '12345678');
    setShowFormPassword(false);
    setFormRole(user.role as StaffRole);
    setFormPermissions(user.permissions || getDefaultPermissionsForRole(user.role as StaffRole));
    setIsAddMode(true);
    setStatusMsg(null);
  };

  const handleOpenChangePassword = (user: IcuUser) => {
    setUserToChangePassword(user);
    setNewPasswordInput('');
    setShowNewPassword(false);
    setChangePassStatus(null);
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToChangePassword) return;
    if (!newPasswordInput.trim() || newPasswordInput.trim().length < 4) {
      setChangePassStatus({
        type: 'error',
        text: lang === 'ar' ? 'كلمة المرور يجب أن تتكون من 4 أحرف/أرقام على الأقل' : 'Password must be at least 4 characters'
      });
      return;
    }

    const res = await changeUserPassword(userToChangePassword.uid, newPasswordInput.trim());
    if (res.success) {
      setChangePassStatus({
        type: 'success',
        text: res.message || (lang === 'ar' ? 'تم تغيير كلمة السر بنجاح في قاعدة البيانات السحابية' : 'Password updated successfully')
      });
      setTimeout(() => {
        setUserToChangePassword(null);
      }, 1200);
    } else {
      setChangePassStatus({
        type: 'error',
        text: res.message || 'Error changing password'
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setStatusMsg(null);
    const res = await deleteUser(userToDelete.uid);
    if (res.success) {
      setStatusMsg({ type: 'success', text: res.message || (lang === 'ar' ? 'تم حذف الحساب بنجاح' : 'User deleted successfully') });
    } else {
      setStatusMsg({ type: 'error', text: res.message || (lang === 'ar' ? 'خطأ أثناء حذف الحساب' : 'Error deleting user') });
    }
    setUserToDelete(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    const cleanUsername = formUsername.trim().toLowerCase().replace(/\s+/g, '');
    const userEmail = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@solimedical-micu.org`;
    const cleanDisplayName = formDisplayName.trim() || cleanUsername;
    const cleanPassword = formPassword.length >= 6 ? formPassword : formPassword.padEnd(6, '0');

    if (editingUser) {
      // Update
      const updated: IcuUser = {
        ...editingUser,
        nameAr: cleanDisplayName,
        nameEn: cleanDisplayName,
        email: userEmail,
        role: formRole,
        pinCode: cleanPassword,
        permissions: formPermissions,
      };
      const res = await updateUser(updated);
      if (res.success) {
        setStatusMsg({ type: 'success', text: lang === 'ar' ? 'تم تحديث بيانات المستخدم بنجاح' : 'User updated successfully' });
        setTimeout(() => setIsAddMode(false), 1000);
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Error updating user' });
      }
    } else {
      // Create
      const res = await createUser({
        nameAr: cleanDisplayName,
        nameEn: cleanDisplayName,
        email: userEmail,
        role: formRole,
        licenseNumber: `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
        department: 'Medical Intensive Care Unit',
        badgeId: cleanUsername,
        pinCode: cleanPassword,
        permissions: formPermissions,
      });
      if (res.success) {
        setStatusMsg({ type: 'success', text: lang === 'ar' ? 'تمت إضافة المستخدم وتفعيل الصلاحيات بنجاح' : 'User created successfully' });
        setTimeout(() => setIsAddMode(false), 1000);
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Error creating user' });
      }
    }
  };

  const filteredUsers = (allUsers || []).filter(u => {
    if (!u) return false;
    const q = (searchQuery || '').toLowerCase();
    const nameAr = (u.nameAr || '').toLowerCase();
    const nameEn = (u.nameEn || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const badgeId = (u.badgeId || '').toLowerCase();

    const matchesSearch = 
      nameAr.includes(q) ||
      nameEn.includes(q) ||
      email.includes(q) ||
      badgeId.includes(q);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const permissionLabels: Record<keyof UserPermissions, { ar: string; en: string }> = {
    canAdmitPatient: { ar: 'إدخال وقبول المرضى (Admission)', en: 'Admit Patient' },
    canDischargePatient: { ar: 'تخريج ونقل المرضى (Discharge/Transfer)', en: 'Discharge/Transfer' },
    canSignNotes: { ar: 'كتابة وتوثيق الملاحظات الطبية (Clinical Notes)', en: 'Sign Clinical Notes' },
    canAddAddendum: { ar: 'إضافة ملاحق غير قابلة للحذف (SHA-256 Addendum)', en: 'Add Note Addendum' },
    canSignSbar: { ar: 'توقيع واعتماد تقرير تسليم الشفت (SBAR Handover)', en: 'Sign SBAR Handover' },
    canTitrateMedications: { ar: 'معايرة الأدوية ومضخات الحقن (Titrate Pumps)', en: 'Titrate Infusion Pumps' },
    canManageUsers: { ar: 'إدارة المستخدمين والصلاحيات (User Admin)', en: 'Manage Users & RBAC' },
    canManageSettings: { ar: 'تعديل إعدادات المنظومة (System Settings)', en: 'Manage System Settings' },
    canViewAuditLogs: { ar: 'الاطلاع على سجلات الرقابة (Audit Logs)', en: 'View Compliance Audit Logs' },
    canEditVitals: { ar: 'تعديل وتوثيق العلامات الحيوية (Edit Vitals)', en: 'Record & Edit Vitals' },
  };

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative w-full max-w-6xl mx-auto bg-[#0a1224] border border-slate-800 rounded-3xl shadow-xl p-5 sm:p-7 text-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 p-0.5 shadow-md shadow-teal-500/20">
              <div className="w-full h-full bg-[#070d1a] rounded-[10px] flex items-center justify-center text-teal-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>{lang === 'ar' ? 'إدارة المستخدمين والكوادر الطبية (RBAC)' : 'Clinical Staff & Access Control (RBAC)'}</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-950 border border-teal-800 text-[10px] font-mono text-teal-300">
                  {allUsers.length} {lang === 'ar' ? 'مستخدم' : 'Users'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ar' ? 'تحديد الصلاحيات السريرية وإدارة حسابات مناوبات العناية المركزة' : 'Role-Based Access Control and Shift Staff Management'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAddMode && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة كادر طبي' : 'Add Staff'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          
          {statusMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              statusMsg.type === 'success' ? 'bg-teal-950/60 border border-teal-500/50 text-teal-200' : 'bg-red-950/60 border border-red-500/50 text-red-200'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {isAddMode ? (
            /* Add / Edit Form */
            <form onSubmit={handleSaveUser} className="space-y-4 bg-[#080f1e] p-4 sm:p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-teal-300 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-teal-400" />
                  <span>{editingUser ? (lang === 'ar' ? 'تعديل بيانات المستخدم' : 'Edit User Profile') : (lang === 'ar' ? 'إضافة مستخدم جديد إلى المنظومة:' : 'Add New User to System:')}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddMode(false)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800/60 transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-teal-300 mb-1">
                    {lang === 'ar' ? 'اسم المستخدم (Username) *' : 'Username *'}
                  </label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    required
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-teal-300 mb-1">
                    {lang === 'ar' ? 'الاسم الظاهر (Display Name) *' : 'Display Name *'}
                  </label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    required
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    placeholder="د. أحمد سليمان"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'كلمة المرور (6 أحرف فأكثر) *' : 'Password (6+ chars) *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl pl-3 pr-9 py-2 text-xs text-white focus:outline-none font-mono"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300 p-1 rounded-md transition-colors cursor-pointer"
                      title={showFormPassword ? (lang === 'ar' ? 'إخفاء كلمة المرور' : 'Hide password') : (lang === 'ar' ? 'إظهار كلمة المرور' : 'Show password')}
                    >
                      {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'الدور والصلاحية (Role) *' : 'Role & Permissions *'}
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-teal-300 focus:outline-none"
                  >
                    <option value={StaffRole.ADMIN}>مدير النظام (Admin)</option>
                    <option value={StaffRole.CONSULTANT}>استشاري عناية (Consultant)</option>
                    <option value={StaffRole.SPECIALIST}>أخصائي عناية (Specialist)</option>
                    <option value={StaffRole.RESIDENT}>طبيب مقيم (Resident)</option>
                    <option value={StaffRole.LEAD_RN}>مسؤول تمريض (Charge Nurse)</option>
                    <option value={StaffRole.BEDSIDE_RN}>تمريض سريري (Bedside RN)</option>
                    <option value={StaffRole.CLINICAL_PHARMACIST}>صيدلي إكلينيكي (Pharmacist)</option>
                    <option value={StaffRole.RESPIRATORY_THERAPIST}>علاج تنفسي (RT)</option>
                    <option value={StaffRole.AUDITOR}>سكرتير (استقبال وحجوزات)</option>
                  </select>
                </div>
              </div>

              {/* System Pages Permission Matrix */}
              <div className="mt-4 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'ar' 
                        ? `تخصيص صفحات النظام المسموحة قبل الإنشاء (${Object.values(formPermissions).filter(Boolean).length} من ${Object.keys(formPermissions).length} صفحة محددة)`
                        : `System Permissions Allowed (${Object.values(formPermissions).filter(Boolean).length} of ${Object.keys(formPermissions).length} granted)`
                      }
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFormPermissions(getDefaultPermissionsForRole(formRole))}
                    className="text-[10px] text-teal-400 hover:underline"
                  >
                    {lang === 'ar' ? 'استعادة الافتراضي للدور' : 'Reset to Role Default'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(permissionLabels) as Array<keyof UserPermissions>).map((key) => (
                    <label
                      key={key}
                      className="p-2.5 rounded-xl bg-[#0a1224] border border-slate-800 hover:border-slate-700 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="text-[11px] text-slate-300">
                        {lang === 'ar' ? permissionLabels[key].ar : permissionLabels[key].en}
                      </span>
                      <input
                        type="checkbox"
                        checked={formPermissions[key] || false}
                        onChange={(e) => setFormPermissions({ ...formPermissions, [key]: e.target.checked })}
                        className="w-4 h-4 rounded text-teal-500 focus:ring-teal-400 bg-slate-900 border-slate-700"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMode(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-md"
                >
                  {editingUser 
                    ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                    : (lang === 'ar' ? '+ إنشاء المستخدم' : '+ Create User')
                  }
                </button>
              </div>
            </form>
          ) : (
            /* Staff List View */
            <div className="space-y-3">
              
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'ar' ? 'بحث بالاسم، البريد أو معرف البطاقة...' : 'Search staff by name, email or badge...'}
                    className="w-full bg-[#080f1e] border border-slate-800 focus:border-teal-400 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-[#080f1e] border border-slate-800 focus:border-teal-400 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="ALL">{lang === 'ar' ? 'جميع الأدوار' : 'All Roles'}</option>
                    <option value={StaffRole.ADMIN}>👑 Admin</option>
                    <option value={StaffRole.CONSULTANT}>🩺 Consultant</option>
                    <option value={StaffRole.SPECIALIST}>👨‍⚕️ Specialist</option>
                    <option value={StaffRole.RESIDENT}>👨‍⚕️ Resident</option>
                    <option value={StaffRole.LEAD_RN}>👩‍⚕️ Charge Nurse</option>
                    <option value={StaffRole.BEDSIDE_RN}>💉 Bedside RN</option>
                    <option value={StaffRole.CLINICAL_PHARMACIST}>💊 Pharmacist</option>
                    <option value={StaffRole.RESPIRATORY_THERAPIST}>🫁 RT</option>
                    <option value={StaffRole.AUDITOR}>📋 Auditor</option>
                  </select>
                </div>
              </div>

              {/* Users Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredUsers.map((user) => {
                  const isCurrent = currentUser?.uid === user.uid;
                  return (
                    <div
                      key={user.uid}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        user.isActive 
                          ? isCurrent 
                            ? 'bg-[#0e1b30] border-teal-500/70 shadow-md shadow-teal-500/10' 
                            : 'bg-[#080f1e] border-slate-800/80 hover:border-slate-700' 
                          : 'bg-slate-900/40 border-red-900/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            user.role === StaffRole.ADMIN 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                              : user.role === StaffRole.CONSULTANT || user.role === StaffRole.SPECIALIST
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}>
                            {user.nameEn.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">{lang === 'ar' ? user.nameAr : user.nameEn}</span>
                              {user.isSuperAdmin && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">
                                  ADMIN
                                </span>
                              )}
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 text-[9px] font-bold">
                                  {lang === 'ar' ? 'أنت' : 'You'}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">{user.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-teal-300 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700/60"
                            title={lang === 'ar' ? 'تعديل البيانات والصلاحيات' : 'Edit profile & permissions'}
                          >
                            <Edit className="w-3.5 h-3.5 text-teal-400" />
                            <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenChangePassword(user)}
                            className="px-2.5 py-1 rounded-lg bg-[#0d2a2a] hover:bg-teal-900/60 text-teal-300 hover:text-teal-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-teal-800/40"
                            title={lang === 'ar' ? 'تغيير كلمة السر' : 'Change Password'}
                          >
                            <KeyRound className="w-3.5 h-3.5 text-teal-400" />
                            <span>{lang === 'ar' ? 'كلمة السر' : 'Password'}</span>
                          </button>

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(user.uid)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border ${
                                user.isActive 
                                  ? 'bg-amber-950/50 hover:bg-amber-900/70 text-amber-300 border-amber-800/50' 
                                  : 'bg-emerald-950/50 hover:bg-emerald-900/70 text-emerald-300 border-emerald-800/50'
                              }`}
                              title={user.isActive ? (lang === 'ar' ? 'إيقاف الحساب مؤقتاً' : 'Deactivate') : (lang === 'ar' ? 'إعادة تفعيل الحساب' : 'Activate')}
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{lang === 'ar' ? 'تعطيل' : 'Disable'}</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{lang === 'ar' ? 'تفعيل' : 'Activate'}</span>
                                </>
                              )}
                            </button>
                          )}

                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => setUserToDelete(user)}
                              className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                              title={lang === 'ar' ? 'حذف الحساب نهائياً' : 'Delete Account'}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Meta Tags & Status */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-teal-400 font-bold">{user.role}</span>
                          <span>•</span>
                          <span>{user.badgeId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            user.isActive ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40' : 'bg-red-950/80 text-red-300 border border-red-800/40'
                          }`}>
                            {user.isActive ? (lang === 'ar' ? 'نشط' : 'Active') : (lang === 'ar' ? 'موقوف' : 'Deactivated')}
                          </span>
                        </div>
                      </div>

                      {/* Key Permissions Badges */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {user.permissions?.canAdmitPatient && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px]">Admission</span>
                        )}
                        {user.permissions?.canSignNotes && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px]">Clinical Notes</span>
                        )}
                        {user.permissions?.canSignSbar && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px]">SBAR</span>
                        )}
                        {user.permissions?.canTitrateMedications && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px]">Pumps</span>
                        )}
                        {user.permissions?.canManageUsers && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-300 text-[9px]">RBAC</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Active Policy: Zero-Trust Clinical RBAC</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>

      </div>

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-[#0a1224] border border-red-900/60 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {lang === 'ar' ? `تأكيد حذف حساب المستخدم: ${userToDelete.nameAr || userToDelete.nameEn}` : `Confirm Deleting User: ${userToDelete.nameEn}`}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {userToDelete.email} • {userToDelete.role}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>{lang === 'ar' ? 'حماية الأرشيف السريري وسجلات المرضى' : 'Clinical Record Integrity Guarantee'}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {lang === 'ar'
                  ? 'عند حذف هذا الحساب، لن يتمكن الكادر من تسجيل الدخول مجدداً. ومراعاةً للمعايير الطبية الدولية (CBAHI / JCI)، تظل جميع السجلات الطبية والملاحظات والتقارير (SBAR) المكتوبة مسبقاً باسمه محفوظة بأسماء أصحابها التاريخية في ملفات المرضى.'
                  : 'Upon deletion, this staff member will no longer be able to log in. In compliance with CBAHI/JCI regulations, all historic clinical notes, SBAR reports, and vital sign logs recorded by this user will remain fully preserved under their original name in patient files.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء الأمر' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-red-950/50 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'حذف الحساب نهائياً' : 'Delete Account'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {userToChangePassword && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0a1224] border border-teal-500/40 rounded-3xl p-6 text-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {lang === 'ar' ? `تغيير كلمة السر للمستخدم:` : 'Change Password for User:'}
                </h3>
                <p className="text-xs text-teal-300 font-bold font-mono mt-0.5">
                  {lang === 'ar' ? userToChangePassword.nameAr : userToChangePassword.nameEn} ({userToChangePassword.badgeId})
                </p>
              </div>
            </div>

            {changePassStatus && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                changePassStatus.type === 'success' 
                  ? 'bg-teal-950/60 border border-teal-500/50 text-teal-200' 
                  : 'bg-red-950/60 border border-red-500/50 text-red-200'
              }`}>
                {changePassStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-teal-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
                <span>{changePassStatus.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {lang === 'ar' ? 'كلمة السر الجديدة *' : 'New Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    required
                    minLength={4}
                    className="w-full bg-[#070d1a] border border-slate-700 focus:border-teal-400 rounded-xl pl-3 pr-9 py-2.5 text-xs text-white focus:outline-none font-mono"
                    placeholder={lang === 'ar' ? 'أدخل كلمة السر الجديدة' : 'Enter new password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-300 p-1 rounded-md transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {lang === 'ar' ? 'الرجاء اختيار كلمة سر قوية وسهلة الحفظ (مثال: رقم سري من 4 أرقام على الأقل).' : 'Please enter a secure password/pin (minimum 4 characters).'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUserToChangePassword(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تحديث كلمة السر' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
