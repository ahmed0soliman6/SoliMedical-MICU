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
  Filter
} from 'lucide-react';
import { useAuth } from '../services/AuthContext.tsx';
import { useSettings } from '../services/SettingsContext.tsx';
import { StaffRole, IcuUser, UserPermissions } from '../types/schema.ts';
import { getDefaultPermissionsForRole } from '../services/firebase.ts';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const { allUsers, currentUser, createUser, updateUser, toggleUserStatus } = useAuth();
  const { lang, isRTL } = useSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isAddMode, setIsAddMode] = useState(false);
  const [editingUser, setEditingUser] = useState<IcuUser | null>(null);

  // Form states for creating/editing user
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<StaffRole>(StaffRole.BEDSIDE_RN);
  const [formLicense, setFormLicense] = useState('');
  const [formDept, setFormDept] = useState('Medical Intensive Care');
  const [formBadge, setFormBadge] = useState('');
  const [formPin, setFormPin] = useState('1234');
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
    setFormNameAr('');
    setFormNameEn('');
    setFormEmail('');
    setFormRole(StaffRole.BEDSIDE_RN);
    setFormLicense(`SCFHS-${Math.floor(10000 + Math.random() * 90000)}`);
    setFormDept('MICU');
    setFormBadge(`STF-${Math.floor(100 + Math.random() * 900)}`);
    setFormPin('1234');
    setFormPermissions(getDefaultPermissionsForRole(StaffRole.BEDSIDE_RN));
    setIsAddMode(true);
    setStatusMsg(null);
  };

  const handleOpenEdit = (user: IcuUser) => {
    setEditingUser(user);
    setFormNameAr(user.nameAr);
    setFormNameEn(user.nameEn);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormLicense(user.licenseNumber);
    setFormDept(user.department);
    setFormBadge(user.badgeId);
    setFormPin(user.pinCode || '1234');
    setFormPermissions(user.permissions || getDefaultPermissionsForRole(user.role));
    setIsAddMode(true);
    setStatusMsg(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (editingUser) {
      // Update
      const updated: IcuUser = {
        ...editingUser,
        nameAr: formNameAr,
        nameEn: formNameEn,
        email: formEmail,
        role: formRole,
        licenseNumber: formLicense,
        department: formDept,
        badgeId: formBadge,
        pinCode: formPin,
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
        nameAr: formNameAr,
        nameEn: formNameEn,
        email: formEmail,
        role: formRole,
        licenseNumber: formLicense,
        department: formDept,
        badgeId: formBadge,
        pinCode: formPin,
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

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = 
      u.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.badgeId.toLowerCase().includes(searchQuery.toLowerCase());
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0a1224] border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 text-slate-100 max-h-[92vh] flex flex-col">
        
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
                  <BadgeCheck className="w-4 h-4" />
                  <span>{editingUser ? (lang === 'ar' ? 'تعديل بيانات وصلاحيات الكادر' : 'Edit Staff Profile') : (lang === 'ar' ? 'إضافة مستخدم جديد وتعيين الدور' : 'New Staff Member Registration')}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddMode(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800/60"
                >
                  {lang === 'ar' ? 'إلغاء والعودة للقائمة' : 'Cancel'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'الاسم بالعربية *' : 'Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    value={formNameAr}
                    onChange={(e) => setFormNameAr(e.target.value)}
                    required
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    placeholder="د. أحمد سليمان"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'الاسم بالإنجليزية *' : 'Name (English) *'}
                  </label>
                  <input
                    type="text"
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    required
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    placeholder="Dr. Ahmed Soliman"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'البريد الإلكتروني *' : 'Email *'}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    placeholder="doctor@hospital.org"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'الدور السريري (Staff Role) *' : 'Clinical Role *'}
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-teal-300 focus:outline-none"
                  >
                    <option value={StaffRole.ADMIN}>👑 المشرف العام (ADMIN)</option>
                    <option value={StaffRole.CONSULTANT}>🩺 استشاري عناية (CONSULTANT)</option>
                    <option value={StaffRole.SPECIALIST}>👨‍⚕️ أخصائي عناية (SPECIALIST)</option>
                    <option value={StaffRole.RESIDENT}>👨‍⚕️ مقيم عناية (RESIDENT)</option>
                    <option value={StaffRole.LEAD_RN}>👩‍⚕️ مسؤول تمريض (LEAD_RN)</option>
                    <option value={StaffRole.BEDSIDE_RN}>💉 تمريض سريري (BEDSIDE_RN)</option>
                    <option value={StaffRole.CLINICAL_PHARMACIST}>💊 صيدلي إكلينيكي (PHARMACIST)</option>
                    <option value={StaffRole.RESPIRATORY_THERAPIST}>🫁 علاج تنفسي (RT)</option>
                    <option value={StaffRole.AUDITOR}>📋 مدقق جودة (AUDITOR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'رقم ترخيص الهيئة (SCFHS) *' : 'License Number *'}
                  </label>
                  <input
                    type="text"
                    value={formLicense}
                    onChange={(e) => setFormLicense(e.target.value)}
                    required
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'القسم / الوحدة' : 'Department'}
                  </label>
                  <input
                    type="text"
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value)}
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'معرف البطاقة (Badge ID)' : 'Badge ID'}
                  </label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {lang === 'ar' ? 'رمز PIN السريري' : 'Clinical PIN'}
                  </label>
                  <input
                    type="password"
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    className="w-full bg-[#0a1224] border border-slate-700 focus:border-teal-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono text-center"
                    placeholder="••••"
                  />
                </div>
              </div>

              {/* Granular Permission Matrix */}
              <div className="mt-4 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'مصفوفة الصلاحيات الممنوحة لهذا المستخدم' : 'Fine-Grained Permissions'}</span>
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
                  {lang === 'ar' ? 'حفظ وتطبيق الصلاحيات' : 'Save User & Permissions'}
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

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-teal-300 transition-colors"
                            title={lang === 'ar' ? 'تعديل البيانات والصلاحيات' : 'Edit profile & permissions'}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {!user.isSuperAdmin && (
                            <button
                              onClick={() => toggleUserStatus(user.uid)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                user.isActive 
                                  ? 'bg-red-950/40 hover:bg-red-900/60 text-red-400' 
                                  : 'bg-teal-950/40 hover:bg-teal-900/60 text-teal-400'
                              }`}
                              title={user.isActive ? (lang === 'ar' ? 'تعطيل الحساب' : 'Deactivate') : (lang === 'ar' ? 'تفعيل الحساب' : 'Activate')}
                            >
                              {user.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Meta Tags */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-teal-400 font-bold">{user.role}</span>
                          <span>•</span>
                          <span>{user.badgeId}</span>
                        </div>
                        <div>
                          <span>LIC: {user.licenseNumber}</span>
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
    </div>
  );
};
