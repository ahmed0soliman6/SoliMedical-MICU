import { firestore } from './firebase.ts';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
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
  | 'SETTINGS_UPDATED';

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
 * Records a new audit log entry with minimal payload (~300 bytes)
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
      eventType: 'NOTE_CREATED' as any, // Dexie legacy mapping
      performedBy: {
        staffId: logData.actorUid || 'system',
        name: logData.actorName || 'System',
        role: (logData.actorRole as any) || 'ADMIN',
      },
      description: `${logData.action}: ${logData.details || ''}`,
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
      const data = docSnap.data() as AuditLogEntry;
      logs.push({
        ...data,
        id: docSnap.id,
      });
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
          description: `${log.action}: ${log.details || ''}`,
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
    return all.slice(0, limitCount).map((item: any) => ({
      id: item.id || '',
      timestamp: item.timestamp || new Date().toISOString(),
      action: item.action || 'USER_LOGIN',
      actorUid: item.actorUid || item.performedBy?.staffId || '',
      actorName: item.actorName || item.performedBy?.name || 'User',
      actorRole: item.actorRole || item.performedBy?.role,
      actorEmail: item.actorEmail,
      targetUid: item.targetUid,
      targetName: item.targetName,
      targetEmail: item.targetEmail,
      targetRole: item.targetRole,
      details: item.details || item.description,
      status: item.status || 'SUCCESS',
    }));
  } catch {
    return [];
  }
}
