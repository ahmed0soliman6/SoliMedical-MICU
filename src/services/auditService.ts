import { firestore } from './firebase.ts';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc,
  query, 
  where,
  orderBy, 
  limit, 
  startAfter, 
  DocumentSnapshot 
} from 'firebase/firestore';
import { db } from '../db/icuSyncDb.ts';

export type AuditActionType =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'PASSWORD_RESET'
  | 'ROLE_CHANGED'
  | 'STATUS_CHANGED'
  | 'PERMISSIONS_CHANGED'
  | 'RECOVERY_CODE_UPDATED'
  | 'SETTINGS_UPDATED'
  | 'NOTE_CREATED'
  | 'ADDENDUM_ADDED'
  | 'SYSTEM_EVENT';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string
  action: AuditActionType;
  actorUid: string;
  actorName: string;
  actorRole?: string;
  actorEmail?: string;
  targetUid?: string;
  targetName?: string;
  targetEmail?: string;
  targetRole?: string;
  details?: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
}

/**
 * Normalizes any raw log document (including legacy database schemas)
 * into a complete, clean, typed AuditLogEntry.
 */
export function normalizeAuditLog(raw: any, docId?: string): AuditLogEntry {
  const id = raw?.id || docId || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = raw?.timestamp || raw?.createdAt || new Date().toISOString();

  // 1. Resolve Action
  let action: AuditActionType = raw?.action || raw?.eventType || 'USER_LOGIN';
  if (action === ('NOTE_CREATED' as any)) action = 'SETTINGS_UPDATED';

  // 2. Resolve Actor
  const actorUid = raw?.actorUid || raw?.performedBy?.staffId || raw?.userId || raw?.authorId || raw?.uid || '';
  let actorName = raw?.actorName || raw?.performedBy?.name || raw?.userName || raw?.authorName || raw?.staffName || '';
  if (!actorName && actorUid) {
    actorName = `Staff (${actorUid.slice(0, 8)})`;
  } else if (!actorName) {
    actorName = 'مستخدم المنظومة / ICU Staff';
  }

  const actorRole = raw?.actorRole || raw?.performedBy?.role || raw?.userRole || raw?.role || undefined;
  const actorEmail = raw?.actorEmail || raw?.email || undefined;

  // 3. Resolve Target
  const targetUid = raw?.targetUid || raw?.patientId || undefined;
  const targetName = raw?.targetName || raw?.patientName || undefined;
  const targetEmail = raw?.targetEmail || undefined;
  const targetRole = raw?.targetRole || undefined;

  // 4. Resolve Details
  let details = raw?.details || raw?.description || raw?.message || '';
  if (!details) {
    if (action === 'USER_LOGIN') {
      details = `تسجيل دخول ناجح للمستخدم ${actorName}`;
    } else if (action === 'USER_LOGOUT') {
      details = `تسجيل خروج للمستخدم ${actorName}`;
    } else {
      details = `تم تنفيذ عملية ${action} بنجاح في النظام`;
    }
  }

  const status = raw?.status || 'SUCCESS';

  return {
    id,
    timestamp,
    action,
    actorUid,
    actorName,
    actorRole,
    actorEmail,
    targetUid,
    targetName,
    targetEmail,
    targetRole,
    details,
    status,
  };
}

/**
 * Records a new audit log entry with minimal payload (~300 bytes).
 * Asynchronously writes to Firestore and local IndexedDB cache.
 */
export async function recordAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): Promise<string> {
  const timestamp = new Date().toISOString();
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const logData: AuditLogEntry = {
    ...entry,
    id,
    timestamp,
  };

  try {
    // 1. Save to local Dexie for instant UI response and offline storage
    await db.auditLogs.put({
      id: logData.id,
      timestamp: logData.timestamp,
      eventType: 'NOTE_CREATED' as any,
      performedBy: {
        staffId: logData.actorUid || 'system',
        name: logData.actorName || 'System',
        role: (logData.actorRole as any) || 'ADMIN',
      },
      description: logData.details || `${logData.action} executed`,
      immutableHash: id,
      ...logData,
    } as any).catch(() => {});

    // 2. Asynchronously sync to Cloud Firestore
    const logDocRef = doc(firestore, 'auditLogs', id);
    await setDoc(logDocRef, logData);
  } catch (err) {
    console.warn('[AuditService] Non-fatal log recording notice:', err);
  }

  return id;
}

export interface FetchAuditLogsResult {
  logs: AuditLogEntry[];
  lastVisibleDoc: DocumentSnapshot | null;
  hasMore: boolean;
  source: 'cloud' | 'cache';
}

/**
 * Fetches audit logs strictly with pagination (default 25 records)
 * to ensure absolute minimal Firestore read operations.
 */
export async function fetchAuditLogs(options?: {
  limitCount?: number;
  lastDoc?: DocumentSnapshot | null;
}): Promise<FetchAuditLogsResult> {
  const pageSize = options?.limitCount || 25;

  try {
    const auditCol = collection(firestore, 'auditLogs');
    let q = query(auditCol, orderBy('timestamp', 'desc'), limit(pageSize));

    if (options?.lastDoc) {
      q = query(auditCol, orderBy('timestamp', 'desc'), startAfter(options.lastDoc), limit(pageSize));
    }

    const snap = await getDocs(q);
    const logs: AuditLogEntry[] = [];

    snap.forEach((docSnap) => {
      logs.push(normalizeAuditLog(docSnap.data(), docSnap.id));
    });

    const lastVisibleDoc = snap.docs[snap.docs.length - 1] || null;
    const hasMore = snap.docs.length === pageSize;

    // Cache fetched logs into Dexie in background
    if (logs.length > 0) {
      logs.forEach(log => {
        db.auditLogs.put({
          id: log.id,
          timestamp: log.timestamp,
          eventType: 'NOTE_CREATED' as any,
          performedBy: {
            staffId: log.actorUid || 'system',
            name: log.actorName || 'System',
            role: (log.actorRole as any) || 'ADMIN',
          },
          description: log.details || `${log.action} recorded`,
          immutableHash: log.id,
          ...log,
        } as any).catch(() => {});
      });
    }

    return {
      logs,
      lastVisibleDoc,
      hasMore,
      source: 'cloud',
    };
  } catch (cloudErr) {
    console.warn('[AuditService] Cloud fetch failed, falling back to local cache:', cloudErr);
    
    // Offline local fallback from Dexie
    const localLogs = await getLocalAuditLogs(pageSize);
    return {
      logs: localLogs,
      lastVisibleDoc: null,
      hasMore: false,
      source: 'cache',
    };
  }
}

/**
 * Retrieves cached audit logs from local Dexie database
 */
export async function getLocalAuditLogs(limitCount: number = 25): Promise<AuditLogEntry[]> {
  try {
    const all = await db.auditLogs.reverse().sortBy('timestamp');
    return all.slice(0, limitCount).map((item: any) => normalizeAuditLog(item, item.id));
  } catch {
    return [];
  }
}

/**
 * Formats a timestamp into human-readable relative time (e.g., '5 minutes ago' / 'منذ 5 دقائق')
 * with high clinical clarity and bilingual support.
 */
export function formatRelativeTime(dateInput?: string | number | Date | null, lang: 'ar' | 'en' = 'en'): string {
  if (!dateInput) {
    return lang === 'ar' ? 'لم يسجل بعد' : 'Never';
  }

  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return String(dateInput);
  }

  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInSec = Math.floor(diffInMs / 1000);

  // Future or very recent safety check
  if (diffInSec < 10) {
    return lang === 'ar' ? 'الآن' : 'Just now';
  }

  if (diffInSec < 60) {
    return lang === 'ar' ? `منذ ${diffInSec} ثانية` : `${diffInSec} seconds ago`;
  }

  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin === 1) {
    return lang === 'ar' ? 'منذ دقيقة' : '1 minute ago';
  }
  if (diffInMin === 2) {
    return lang === 'ar' ? 'منذ دقيقتين' : '2 minutes ago';
  }
  if (diffInMin < 60) {
    if (lang === 'ar') {
      if (diffInMin >= 3 && diffInMin <= 10) return `منذ ${diffInMin} دقائق`;
      return `منذ ${diffInMin} دقيقة`;
    }
    return `${diffInMin} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours === 1) {
    return lang === 'ar' ? 'منذ ساعة' : '1 hour ago';
  }
  if (diffInHours === 2) {
    return lang === 'ar' ? 'منذ ساعتين' : '2 hours ago';
  }
  if (diffInHours < 24) {
    if (lang === 'ar') {
      if (diffInHours >= 3 && diffInHours <= 10) return `منذ ${diffInHours} ساعات`;
      return `منذ ${diffInHours} ساعة`;
    }
    return `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return lang === 'ar' ? 'أمس' : 'Yesterday';
  }
  if (diffInDays === 2) {
    return lang === 'ar' ? 'منذ يومين' : '2 days ago';
  }
  if (diffInDays < 7) {
    if (lang === 'ar') {
      if (diffInDays >= 3 && diffInDays <= 10) return `منذ ${diffInDays} أيام`;
      return `منذ ${diffInDays} يوم`;
    }
    return `${diffInDays} days ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks === 1) {
    return lang === 'ar' ? 'منذ أسبوع' : '1 week ago';
  }
  if (diffInWeeks === 2) {
    return lang === 'ar' ? 'منذ أسبوعين' : '2 weeks ago';
  }
  if (diffInWeeks < 4) {
    if (lang === 'ar') {
      return `منذ ${diffInWeeks} أسابيع`;
    }
    return `${diffInWeeks} weeks ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths === 1) {
    return lang === 'ar' ? 'منذ شهر' : '1 month ago';
  }
  if (diffInMonths === 2) {
    return lang === 'ar' ? 'منذ شهرين' : '2 months ago';
  }
  if (diffInMonths < 12) {
    if (lang === 'ar') {
      return `منذ ${diffInMonths} أشهر`;
    }
    return `${diffInMonths} months ago`;
  }

  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a timestamp into an exact, localized date and time string.
 */
export function formatDetailedTimestamp(dateInput?: string | number | Date | null, lang: 'ar' | 'en' = 'en'): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  return date.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Automatically purges and deletes any audit logs older than 1 year (365 days)
 * from both Cloud Firestore and local Dexie IndexedDB cache.
 */
export async function purgeAuditLogsOlderThanOneYear(): Promise<{ deletedCount: number; message: string }> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoffIso = oneYearAgo.toISOString();

  let deletedCount = 0;

  try {
    // 1. Delete from Cloud Firestore
    const auditCol = collection(firestore, 'auditLogs');
    const oldQuery = query(auditCol, where('timestamp', '<', cutoffIso), limit(200));
    const oldSnap = await getDocs(oldQuery);

    if (!oldSnap.empty) {
      for (const docSnap of oldSnap.docs) {
        await deleteDoc(doc(firestore, 'auditLogs', docSnap.id)).catch(() => {});
        deletedCount++;
      }
    }

    // 2. Delete from local Dexie IndexedDB
    try {
      const localOld = await db.auditLogs.where('timestamp').below(cutoffIso).toArray();
      if (localOld.length > 0) {
        const oldIds = localOld.map((item: any) => item.id);
        await db.auditLogs.bulkDelete(oldIds);
      }
    } catch (e) {
      console.warn('[AuditService] Local prune notice:', e);
    }

    return {
      deletedCount,
      message: deletedCount > 0
        ? `تم مسح وقص ${deletedCount} سجلاً أمنياً أقدم من سنة من السحابة بنجاح.`
        : 'لا توجد سجلات أمنية أقدم من سنة في السحابة.'
    };
  } catch (err: any) {
    console.warn('[AuditService] Purge error:', err);
    return {
      deletedCount: 0,
      message: `تعذر مسح السجلات القديمة: ${err?.message || 'خطأ غير معروف'}`
    };
  }
}


