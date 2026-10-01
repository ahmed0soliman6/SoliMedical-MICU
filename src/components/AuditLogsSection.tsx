import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  RefreshCw, 
  Download, 
  LogIn, 
  LogOut, 
  UserPlus, 
  Edit, 
  Key, 
  ShieldAlert, 
  Trash2, 
  Sliders, 
  CheckCircle2, 
  Clock, 
  User, 
  Shield, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { useTranslation } from '../services/i18n.ts';
import { useAuth } from '../services/AuthContext.tsx';
import { 
  AuditLogEntry, 
  fetchAuditLogs, 
  getLocalAuditLogs, 
  formatRelativeTime, 
  formatDetailedTimestamp,
  purgeAuditLogsOlderThanOneYear
} from '../services/auditService.ts';

export const AuditLogsSection: React.FC = () => {
  const { lang } = useTranslation();
  const { allUsers } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadInitialLogs();
  }, []);

  const loadInitialLogs = async () => {
    setIsLoading(true);
    try {
      // 1. Instant local display from Dexie to save initial wait
      const cached = await getLocalAuditLogs(25);
      if (cached.length > 0) {
        setLogs(cached);
      }

      // 2. Fetch latest slice from Firestore (strictly limit 25 to ensure low cost reads)
      const res = await fetchAuditLogs({ limitCount: 25 });
      if (res.logs.length > 0) {
        setLogs(res.logs);
        setLastVisibleDoc(res.lastVisibleDoc);
        setHasMore(res.hasMore);
      }

      // 3. Auto-prune audit logs older than 1 year in background
      purgeAuditLogsOlderThanOneYear().catch((e) => console.warn('Auto purge old audit logs error:', e));
    } catch (err) {
      console.warn('Failed to load initial audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchAuditLogs({ limitCount: 25 });
      if (res.logs.length > 0) {
        setLogs(res.logs);
        setLastVisibleDoc(res.lastVisibleDoc);
        setHasMore(res.hasMore);
      }
    } catch (err) {
      console.warn('Failed to refresh audit logs:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (!lastVisibleDoc || isLoading) return;
    setIsLoading(true);
    try {
      const res = await fetchAuditLogs({ limitCount: 25, lastDoc: lastVisibleDoc });
      setLogs(prev => [...prev, ...res.logs]);
      setLastVisibleDoc(res.lastVisibleDoc);
      setHasMore(res.hasMore);
    } catch (err) {
      console.warn('Failed to load more audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurgeOldLogs = async () => {
    setIsPurging(true);
    setPurgeFeedback(null);
    try {
      const res = await purgeAuditLogsOlderThanOneYear();
      setPurgeFeedback(res.message);
      if (res.deletedCount > 0) {
        await handleRefresh();
      }
      setTimeout(() => setPurgeFeedback(null), 4000);
    } catch (err: any) {
      setPurgeFeedback(err?.message || (lang === 'ar' ? 'فشل تنظيف السجلات القديمة.' : 'Purge failed.'));
    } finally {
      setIsPurging(false);
    }
  };

  // Helper to resolve real user name from active users directory
  const resolveActorName = (log: AuditLogEntry): string => {
    if (log.actorName && log.actorName !== 'User' && log.actorName !== 'System' && !log.actorName.startsWith('Staff (')) {
      return log.actorName;
    }

    if (allUsers && allUsers.length > 0) {
      const matched = allUsers.find(u => 
        (log.actorUid && (u.uid === log.actorUid || log.actorUid.includes(u.uid) || (u.badgeId && log.actorUid.includes(u.badgeId)))) ||
        (log.actorEmail && u.email && u.email.toLowerCase() === log.actorEmail.toLowerCase())
      );
      if (matched) {
        return (lang === 'ar' ? matched.nameAr : matched.nameEn) || matched.nameAr || matched.nameEn || log.actorName || 'طاقم العناية المركزة';
      }
    }

    return log.actorName || (log.actorUid ? `Staff (${log.actorUid.slice(0, 8)})` : (lang === 'ar' ? 'طاقم العناية' : 'Clinical Staff'));
  };

  // Helper to resolve target user name
  const resolveTargetName = (log: AuditLogEntry): string => {
    if (log.targetName && log.targetName !== 'User' && !log.targetName.startsWith('Staff (')) {
      return log.targetName;
    }

    if (allUsers && allUsers.length > 0) {
      const matched = allUsers.find(u => 
        (log.targetUid && (u.uid === log.targetUid || log.targetUid.includes(u.uid) || (u.badgeId && log.targetUid.includes(u.badgeId)))) ||
        (log.targetEmail && u.email && u.email.toLowerCase() === log.targetEmail.toLowerCase())
      );
      if (matched) {
        return (lang === 'ar' ? matched.nameAr : matched.nameEn) || matched.nameAr || matched.nameEn || log.targetName || '';
      }
    }

    return log.targetName || log.targetUid || '';
  };

  const exportToCsv = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Action', 'Actor Name', 'Actor Role', 'Actor UID', 'Target User', 'Details', 'Status'];
    const rows = logs.map(l => {
      const actor = resolveActorName(l);
      const target = resolveTargetName(l);
      return [
        `"${l.timestamp}"`,
        `"${l.action}"`,
        `"${actor}"`,
        `"${l.actorRole || ''}"`,
        `"${l.actorUid || ''}"`,
        `"${target}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${l.status || 'SUCCESS'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ICU_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered logs
  const filteredLogs = logs.filter(l => {
    // Action Type filter
    if (filterType === 'LOGINS' && l.action !== 'USER_LOGIN' && l.action !== 'USER_LOGOUT') return false;
    if (filterType === 'ACCOUNTS' && l.action !== 'USER_CREATED' && l.action !== 'USER_UPDATED' && l.action !== 'USER_DELETED') return false;
    if (filterType === 'SECURITY' && l.action !== 'PASSWORD_RESET' && l.action !== 'ROLE_CHANGED' && l.action !== 'STATUS_CHANGED' && l.action !== 'PERMISSIONS_CHANGED') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const actor = resolveActorName(l).toLowerCase();
      const target = resolveTargetName(l).toLowerCase();
      const matchActor = actor.includes(q) || (l.actorEmail || '').toLowerCase().includes(q);
      const matchTarget = target.includes(q) || (l.targetEmail || '').toLowerCase().includes(q);
      const matchDetails = (l.details || '').toLowerCase().includes(q);
      const matchAction = (l.action || '').toLowerCase().includes(q);
      return matchActor || matchTarget || matchDetails || matchAction;
    }

    return true;
  });

  const getActionBadge = (action: string | undefined) => {
    switch (action) {
      case 'USER_LOGIN':
      case 'LOGIN':
        return {
          icon: LogIn,
          labelAr: 'تسجيل دخول',
          labelEn: 'User Login',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30'
        };
      case 'USER_LOGOUT':
      case 'LOGOUT':
        return {
          icon: LogOut,
          labelAr: 'تسجيل خروج',
          labelEn: 'User Logout',
          bg: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
        };
      case 'USER_CREATED':
        return {
          icon: UserPlus,
          labelAr: 'إنشاء حساب جديد',
          labelEn: 'User Created',
          bg: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30'
        };
      case 'USER_UPDATED':
        return {
          icon: Edit,
          labelAr: 'تحديث بيانات المستخدم',
          labelEn: 'User Updated',
          bg: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-500/30'
        };
      case 'PASSWORD_RESET':
        return {
          icon: Key,
          labelAr: 'تغيير كلمة المرور',
          labelEn: 'Password Changed',
          bg: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-500/30'
        };
      case 'STATUS_CHANGED':
        return {
          icon: ShieldAlert,
          labelAr: 'تعديل حالة الحساب',
          labelEn: 'Status Changed',
          bg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30'
        };
      case 'USER_DELETED':
        return {
          icon: Trash2,
          labelAr: 'حذف حساب مستخدم',
          labelEn: 'User Deleted',
          bg: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/30'
        };
      case 'SETTINGS_UPDATED':
      case 'NOTE_CREATED':
        return {
          icon: Sliders,
          labelAr: 'توثيق وتعديل سجل',
          labelEn: 'Record Updated',
          bg: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-500/30'
        };
      default:
        return {
          icon: History,
          labelAr: action || 'عملية بالنظام',
          labelEn: action || 'System Activity',
          bg: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
        };
    }
  };

  const loginCount = logs.filter(l => l.action === 'USER_LOGIN' || l.action === ('LOGIN' as any)).length;
  const securityCount = logs.filter(l => l.action === 'PASSWORD_RESET' || l.action === 'STATUS_CHANGED' || l.action === 'ROLE_CHANGED').length;
  const accountCount = logs.filter(l => l.action === 'USER_CREATED' || l.action === 'USER_DELETED').length;

  return (
    <div className="space-y-4">
      {/* Purge Notification Banner */}
      {purgeFeedback && (
        <div className="p-3 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-500/40 rounded-xl text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
          <span>{purgeFeedback}</span>
        </div>
      )}

      {/* Stats Cards - Fully harmonious in light and dark mode */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>{lang === 'ar' ? 'إجمالي السجلات المحملة' : 'Loaded Logs'}</span>
            <History className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">{logs.length}</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>{lang === 'ar' ? 'عمليات تسجيل الدخول' : 'Logins'}</span>
            <LogIn className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{loginCount}</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>{lang === 'ar' ? 'تعديلات أمنية وكلمات سر' : 'Security Changes'}</span>
            <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-extrabold text-purple-600 dark:text-purple-400 font-mono">{securityCount}</div>
        </div>

        <div className="p-3.5 bg-white dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>{lang === 'ar' ? 'إنشاء / حذف حسابات' : 'User Changes'}</span>
            <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400 font-mono">{accountCount}</div>
        </div>
      </div>

      {/* Control & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ar' ? "بحث في سجلات التدقيق بالاسم أو الحدث..." : "Search logs by staff name or action..."}
              className="w-full bg-white dark:bg-[#0c1529] border border-slate-300 dark:border-slate-700/80 focus:border-teal-500 rounded-xl pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white dark:bg-[#0c1529] p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] shadow-sm">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterType === 'ALL' ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {lang === 'ar' ? 'الكل' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('LOGINS')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterType === 'LOGINS' ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {lang === 'ar' ? 'تسجيل الدخول' : 'Logins'}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('SECURITY')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterType === 'SECURITY' ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {lang === 'ar' ? 'الأمان وكلمات السر' : 'Security'}
            </button>
            <button
              type="button"
              onClick={() => setFilterType('ACCOUNTS')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterType === 'ACCOUNTS' ? 'bg-teal-100 dark:bg-teal-500/20 text-teal-900 dark:text-teal-300 border border-teal-300 dark:border-teal-500/40 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {lang === 'ar' ? 'الحسابات' : 'Accounts'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-300 transition-colors border border-slate-200 dark:border-slate-700/60 cursor-pointer shadow-sm"
            title={lang === 'ar' ? 'تحديث السجلات من السحابة (25 سجلاً)' : 'Refresh logs from cloud'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-600 dark:text-teal-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handlePurgeOldLogs}
            disabled={isPurging}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800/60 cursor-pointer disabled:opacity-50 transition-all shadow-sm"
            title={lang === 'ar' ? 'حذف أي سجلات أمنية أقدم من سنة لتوفير القراءات' : 'Delete logs older than 1 year'}
          >
            {isPurging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{lang === 'ar' ? 'حذف سجلات > سنة' : 'Prune > 1y Logs'}</span>
          </button>

          <button
            type="button"
            onClick={exportToCsv}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700/60 cursor-pointer disabled:opacity-50 shadow-sm"
            title={lang === 'ar' ? 'تصدير التقرير إلى ملف CSV' : 'Export audit report as CSV'}
          >
            <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'تصدير CSV' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center bg-white dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
            <History className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
              {lang === 'ar' ? 'لا توجد سجلات تدقيق تطابق معايير البحث.' : 'No audit logs found matching criteria.'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {lang === 'ar' ? 'يتم توثيق كل عملية دخول وتعديل أمني تلقائياً بحجم صغير جداً لتوفير استهلاك القراءات.' : 'Log reads are paginated strictly to protect daily quota.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getActionBadge(log.action);
            const IconComp = badge.icon;
            const relativeTimeStr = formatRelativeTime(log.timestamp, lang);
            const exactTimestampStr = formatDetailedTimestamp(log.timestamp, lang);

            const actorName = resolveActorName(log);
            const targetName = resolveTargetName(log);
            const actionTitle = lang === 'ar' ? badge.labelAr : badge.labelEn;
            const logDetails = log.details || (lang === 'ar' ? `تم تنفيذ ${actionTitle} بنجاح` : `${actionTitle} executed successfully`);

            return (
              <div 
                key={log.id}
                className="p-3.5 bg-white dark:bg-[#080f1e] border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs group"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-xl border flex-shrink-0 ${badge.bg}`}>
                    <IconComp className="w-4 h-4" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {actionTitle}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-semibold">
                        {log.action || 'ACTIVITY'}
                      </span>
                      {log.action === 'USER_LOGIN' && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
                          {relativeTimeStr}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed break-words font-medium">
                      {logDetails}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                        <span>{lang === 'ar' ? 'المنفذ:' : 'Actor:'}</span>
                        <strong className="text-slate-900 dark:text-slate-200 font-bold">{actorName}</strong>
                        {log.actorRole && <span className="text-teal-700 dark:text-teal-400 font-mono">({log.actorRole})</span>}
                      </span>

                      {targetName && (
                        <span className="flex items-center gap-1 border-r border-slate-300 dark:border-slate-700 pr-2 rtl:border-r-0 rtl:border-l rtl:pr-0 rtl:pl-2">
                          <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>{lang === 'ar' ? 'المستهدف:' : 'Target:'}</span>
                          <strong className="text-slate-900 dark:text-slate-200 font-bold">{targetName}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-2 sm:pt-0 text-[10px] text-slate-500 dark:text-slate-400 font-mono flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                    <span className="font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800/40 px-2 py-0.5 rounded-md text-[10px]">
                      {relativeTimeStr}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-1" title={exactTimestampStr}>
                    {exactTimestampStr}
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[9px] mt-0.5 font-bold">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>{lang === 'ar' ? 'موثق بالسحابة' : 'Firestore Synced'}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination / Load More Button */}
      {hasMore && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-300 text-xs font-bold border border-slate-300 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-2 mx-auto disabled:opacity-50 shadow-sm"
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 dark:text-teal-400" />}
            <span>{lang === 'ar' ? 'تحميل المزيد من السجلات (25 سجلاً إضافياً)' : 'Load More (Next 25 Logs)'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
