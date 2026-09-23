import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

interface VercelReq extends IncomingMessage {
  body?: any;
  query?: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  method?: string;
}

interface VercelRes extends ServerResponse {
  status(code: number): VercelRes;
  json(body: any): void;
  send(body: any): void;
}

function sendJson(res: any, statusCode: number, data: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  return res.end(JSON.stringify(data));
}

function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;

  let cleanKey = key.trim();

  while (
    (cleanKey.startsWith('"') && cleanKey.endsWith('"')) ||
    (cleanKey.startsWith("'") && cleanKey.endsWith("'"))
  ) {
    cleanKey = cleanKey.slice(1, -1).trim();
  }

  cleanKey = cleanKey
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\\\n/g, '\n');

  if (cleanKey.startsWith('{') && cleanKey.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleanKey);
      if (parsed.private_key) {
        return formatPrivateKey(parsed.private_key);
      }
    } catch {
      // Continue if not JSON
    }
  }

  if (cleanKey.includes('-----BEGIN') && cleanKey.includes('-----END')) {
    const match = cleanKey.match(/(-----BEGIN [^-]+-----)([\s\S]+?)(-----END [^-]+-----)/);
    if (match) {
      const header = match[1].trim();
      const body = match[2].replace(/\s+/g, '');
      const footer = match[3].trim();
      const formattedBody = body.match(/.{1,64}/g)?.join('\n') || body;
      return `${header}\n${formattedBody}\n${footer}\n`;
    }
  } else {
    const base64Body = cleanKey.replace(/\s+/g, '');
    const formattedBody = base64Body.match(/.{1,64}/g)?.join('\n') || base64Body;
    return `-----BEGIN PRIVATE KEY-----\n${formattedBody}\n-----END PRIVATE KEY-----\n`;
  }

  return cleanKey.endsWith('\n') ? cleanKey : `${cleanKey}\n`;
}

function parseServiceAccountCredentials(): { projectId?: string; clientEmail?: string; privateKey?: string } | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
      if (parsed.client_email && parsed.private_key) {
        const formattedKey = formatPrivateKey(parsed.private_key);
        if (formattedKey) {
          return {
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: formattedKey
          };
        }
      }
    } catch (e) {
      console.warn('[Firebase Admin] JSON parse error in service account:', e);
    }
  }

  const rawKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (rawKey && rawKey.startsWith('{') && rawKey.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawKey);
      if (parsed.client_email && parsed.private_key) {
        const formattedKey = formatPrivateKey(parsed.private_key);
        if (formattedKey) {
          return {
            projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID,
            clientEmail: parsed.client_email,
            privateKey: formattedKey
          };
        }
      }
    } catch {
      // Continue
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  if (clientEmail && rawKey) {
    const formattedKey = formatPrivateKey(rawKey);
    if (formattedKey) {
      return {
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail,
        privateKey: formattedKey
      };
    }
  }

  return null;
}

let adminAppInstance: App | null = null;
let firestoreDbInstance: Firestore | null = null;
let authAdminInstance: Auth | null = null;

function getAdminServices(): { db: Firestore; auth: Auth } {
  if (firestoreDbInstance && authAdminInstance) {
    return { db: firestoreDbInstance, auth: authAdminInstance };
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminAppInstance = existingApps[0];
  } else {
    const creds = parseServiceAccountCredentials();
    const projectId = creds?.projectId || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

    if (creds?.clientEmail && creds?.privateKey) {
      adminAppInstance = initializeApp({
        credential: cert({
          projectId: creds.projectId || projectId,
          clientEmail: creds.clientEmail,
          privateKey: creds.privateKey
        }),
        projectId
      });
    } else {
      adminAppInstance = initializeApp({
        credential: applicationDefault(),
        projectId
      });
    }
  }

  firestoreDbInstance = getFirestore(adminAppInstance);
  authAdminInstance = getAuth(adminAppInstance);
  return { db: firestoreDbInstance, auth: authAdminInstance };
}

async function verifyAdminCaller(authHeader?: string): Promise<{ isAdmin: boolean; callerUid?: string; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAdmin: false, error: 'Missing or invalid Authorization header.' };
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return { isAdmin: false, error: 'Empty Authorization ID Token.' };
  }

  try {
    const { auth, db } = getAdminServices();
    const decodedToken = await auth.verifyIdToken(token);
    const callerUid = decodedToken?.uid;

    if (!callerUid) {
      return { isAdmin: false, error: 'Invalid token: missing caller UID.' };
    }

    let isCallerAdmin = false;
    let isCallerActive = false;

    try {
      const callerDoc = await db.collection('users').doc(callerUid).get();
      if (callerDoc.exists) {
        const callerData = callerDoc.data() as any;
        isCallerActive = callerData.active !== false && callerData.isActive !== false;
        isCallerAdmin = callerData.role === 'ADMIN' || callerData.isSuperAdmin === true;
      } else {
        const adminDoc = await db.collection('admins').doc(callerUid).get();
        if (adminDoc.exists) {
          isCallerAdmin = true;
          isCallerActive = true;
        }
      }
    } catch (dbErr: any) {
      return { isAdmin: false, callerUid, error: 'Access denied: Unable to verify administrator role in database.' };
    }

    if (!isCallerActive || !isCallerAdmin) {
      return { isAdmin: false, callerUid, error: 'Access denied: Caller does not have active administrator permissions.' };
    }

    return { isAdmin: true, callerUid };
  } catch (err: any) {
    return { isAdmin: false, error: `Admin authentication failed: ${err?.message || 'Invalid or expired ID token'}` };
  }
}

async function parseJsonBody(req: any): Promise<any> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
    setTimeout(() => resolve({}), 2000);
  });
}

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, message: 'Method Not Allowed. Use POST.' });
  }

  try {
    const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJson(res, 401, { success: false, message: 'Missing or invalid Authorization Bearer token.' });
    }

    const authCheck = await verifyAdminCaller(authHeader);
    if (!authCheck.isAdmin || !authCheck.callerUid) {
      return sendJson(res, 403, { success: false, message: authCheck.error || 'Permission Denied: Caller is not an authorized administrator.' });
    }

    const callerUid = authCheck.callerUid;
    const body = await parseJsonBody(req);
    const targetUid = body?.targetUid;
    const reason = body?.reason;

    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
      return sendJson(res, 400, { success: false, message: 'Missing targetUid in request body.' });
    }

    const cleanTargetUid = targetUid.trim();

    if (callerUid === cleanTargetUid) {
      return sendJson(res, 400, { success: false, message: 'لا يمكنك تعطيل حسابك الحالي أثناء تسجيل الدخول منه.' });
    }

    const { db, auth } = getAdminServices();

    // Check user exists
    const targetRef = db.collection('users').doc(cleanTargetUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return sendJson(res, 404, { success: false, message: 'المستخدم غير موجود في النظام.' });
    }

    const nowIso = new Date().toISOString();

    // 1. Revoke tokens and disable user in Firebase Authentication
    try {
      await auth.revokeRefreshTokens(cleanTargetUid);
      await auth.updateUser(cleanTargetUid, { disabled: true });
    } catch (authErr: any) {
      return sendJson(res, 500, {
        success: false,
        message: `فشل تعطيل المستخدم في Firebase Authentication: ${authErr?.message || authErr}`
      });
    }

    // 2. Synchronize Firestore users collection
    try {
      await targetRef.update({
        active: false,
        isActive: false,
        updatedAt: nowIso,
        updatedByUid: callerUid,
        disabledReason: reason || 'Disabled by Administrator',
      });
    } catch (dbErr: any) {
      return sendJson(res, 500, {
        success: false,
        message: `فشل تحديث حالة المستخدم في Firestore: ${dbErr?.message || dbErr}`
      });
    }

    // 3. Record audit log
    try {
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.collection('auditLogs').doc(auditId).set({
        id: auditId,
        timestamp: nowIso,
        eventType: 'USER_DISABLED',
        description: `User account ${cleanTargetUid} disabled by Admin ${callerUid}. Reason: ${reason || 'N/A'}. Clinical history preserved.`,
        callerUid,
        targetUid: cleanTargetUid,
        isImmutable: true,
      });
    } catch (auditErr) {
      console.warn('Audit log write error:', auditErr);
    }

    return sendJson(res, 200, {
      success: true,
      message: 'تم تعطيل الحساب وإبطال جلساته في Firebase Authentication وقاعدة البيانات بنجاح.',
    });
  } catch (err: any) {
    console.error('[Vercel Function /api/admin/users/disable] Internal Error:', err);
    return sendJson(res, 500, { success: false, message: err?.message || 'Internal Server Error' });
  }
}
