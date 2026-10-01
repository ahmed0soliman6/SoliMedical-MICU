/**
 * Soli Medical MICU (ICU-Sync) - Audit Log Service
 * 
 * Fetches audit logs strictly with pagination (default 25 records)
 * to ensure absolute minimal Firestore read operations.
 */
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  DocumentSnapshot 
} from 'firebase/firestore';
import { firestore } from './firebase.ts';
import { db } from '../db/icuSyncDb.ts';
import { 
  AuditLogEntry, 
  normalizeAuditLog, 
  getLocalAuditLogs, 
  formatRelativeTime, 
  formatDetailedTimestamp 
} from './operations.ts';

export { 
  getLocalAuditLogs, 
  formatRelativeTime, 
  formatDetailedTimestamp 
};

export function purgeAuditLogsOlderThanOneYear(): void {
  // Stub for audit log retention cleanup
}

export type { AuditLogEntry };

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
