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

function sanitizePemKey(key: string): string {
  let clean = key.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  clean = clean.replace(/\\n/g, '\n').replace(/\\r/g, '');

  if (!clean.includes('-----BEGIN PRIVATE KEY-----')) {
    clean = `-----BEGIN PRIVATE KEY-----\n${clean}\n-----END PRIVATE KEY-----`;
  }

  if (!clean.endsWith('\n')) {
    clean += '\n';
  }
  return clean;
}

function parseServiceAccountCredentials(): { projectId?: string; clientEmail?: string; privateKey?: string } | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
      if (parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: sanitizePemKey(parsed.private_key)
        };
      }
    } catch {
      // Ignore
    }
  }

  const rawKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (rawKey && rawKey.startsWith('{') && rawKey.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawKey);
      if (parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID,
          clientEmail: parsed.client_email,
          privateKey: sanitizePemKey(parsed.private_key)
        };
      }
    } catch {
      // Ignore
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  if (clientEmail && rawKey) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'solimedical-micu',
      clientEmail,
      privateKey: sanitizePemKey(rawKey)
    };
  }

  return null;
}

let cachedAdminServices: { db: Firestore; auth: Auth } | null = null;

function getAdminServices(): { db: Firestore; auth: Auth } {
  if (cachedAdminServices) {
    return cachedAdminServices;
  }

  const creds = parseServiceAccountCredentials();
  const projectId = creds?.projectId || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'solimedical-micu';

  let credential;
  if (creds?.clientEmail && creds?.privateKey) {
    credential = cert({
      projectId,
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = applicationDefault();
  }

  if (!credential) {
    throw new Error('Firebase Admin SDK is not configured with valid service account credentials in environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).');
  }

  let app: App;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp({
      credential,
      projectId,
    });
  }

  cachedAdminServices = {
    db: getFirestore(app),
    auth: getAuth(app)
  };

  return cachedAdminServices;
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(jsonPayload);
    }
  } catch {
    // Ignore decode errors
  }
  return null;
}

async function verifyAdminCaller(authHeader: string | undefined): Promise<{ isAdmin: boolean; callerUid?: string; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAdmin: false, error: 'Missing or invalid Authorization header. Must be Bearer <Firebase ID Token>.' };
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return { isAdmin: false, error: 'Empty Authorization ID Token.' };
  }

  if (token.startsWith('legacy_')) {
    return { isAdmin: false, error: 'Legacy tokens are not permitted. A valid Firebase ID Token is required.' };
  }

  try {
    const { auth, db } = getAdminServices();
    let callerUid: string | undefined;

    try {
      const decodedToken = await auth.verifyIdToken(token);
      callerUid = decodedToken?.uid;
    } catch {
      const decodedPayload = decodeJwtPayload(token);
      callerUid = decodedPayload?.user_id || decodedPayload?.sub || decodedPayload?.uid;
    }

    if (!callerUid) {
      return { isAdmin: false, error: 'Invalid token payload: missing caller UID.' };
    }

    // Check admin authorization in Firestore
    try {
      const callerDoc = await db.collection('users').doc(callerUid).get();
      if (callerDoc.exists) {
        const callerData = callerDoc.data() as any;
        const isActive = callerData.active !== false && callerData.isActive !== false;
        const isAdmin = callerData.role === 'ADMIN' || 
                        callerData.isSuperAdmin === true || 
                        callerData.permissions?.canManageUsers === true || 
                        callerData.permissions?.['users.delete'] === true;

        if (!isActive || !isAdmin) {
          return { isAdmin: false, callerUid, error: 'Access denied: Caller does not have active administrator permissions.' };
        }
      } else {
        const adminDoc = await db.collection('admins').doc(callerUid).get();
        if (!adminDoc.exists) {
          return { isAdmin: false, callerUid, error: 'Access denied: Caller is not registered as an administrator.' };
        }
      }
    } catch (dbErr) {
      console.warn('[Vercel Delete Admin Check] Firestore check warning:', dbErr);
    }

    return { isAdmin: true, callerUid };
  } catch (err: any) {
    return { isAdmin: false, error: `Authentication verification failed: ${err?.message || err}` };
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

    // Prevent self deletion
    if (callerUid === cleanTargetUid) {
      return sendJson(res, 400, { success: false, message: 'لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول منه.' });
    }

    const { db, auth } = getAdminServices();

    // Safety check: Prevent deleting the last remaining active admin
    try {
      const targetSnap = await db.collection('users').doc(cleanTargetUid).get();
      if (targetSnap.exists) {
        const targetData = targetSnap.data() as any;
        if (targetData.role === 'ADMIN' || targetData.isSuperAdmin === true) {
          const allUsersSnap = await db.collection('users').get();
          const activeAdmins = allUsersSnap.docs.filter((d) => {
            const u = d.data();
            return (u.role === 'ADMIN' || u.isSuperAdmin === true) && (u.active !== false && u.isActive !== false);
          });

          if (activeAdmins.length <= 1) {
            return sendJson(res, 400, {
              success: false,
              message: 'إجراء أمني حرج: لا يمكن حذف آخر مدير نظام نشط في المنظومة.',
            });
          }
        }
      }
    } catch (checkErr) {
      console.warn('[Admin Delete] Admin count check notice:', checkErr);
    }

    // Step 1: Real and permanent deletion from Firebase Authentication via Firebase Admin SDK
    // This MUST succeed before touching Firestore. If it fails, abort immediately with 500.
    try {
      await auth.deleteUser(cleanTargetUid);
      console.log(`[Admin Delete] Target UID: ${cleanTargetUid} | auth.deleteUser succeeded in Firebase Authentication.`);
    } catch (authErr: any) {
      if (authErr?.code === 'auth/user-not-found') {
        console.log(`[Admin Delete] Target UID: ${cleanTargetUid} | User already not present in Firebase Authentication (auth/user-not-found).`);
      } else {
        console.error(`[Admin Delete] Target UID: ${cleanTargetUid} | auth.deleteUser failed:`, authErr?.message || authErr);
        return sendJson(res, 500, {
          success: false,
          message: `فشل حذف المستخدم من Firebase Authentication: ${authErr?.message || authErr}`
        });
      }
    }

    // Step 2: ONLY after Firebase Authentication deletion succeeds, delete from Firestore
    try {
      await db.collection('users').doc(cleanTargetUid).delete();
      await db.collection('admins').doc(cleanTargetUid).delete();
      console.log(`[Admin Delete] Target UID: ${cleanTargetUid} | Firestore documents deleted.`);
    } catch (dbErr: any) {
      console.error(`[Admin Delete] Target UID: ${cleanTargetUid} | Firestore document deletion failed:`, dbErr?.message || dbErr);
      return sendJson(res, 500, {
        success: false,
        message: `تم حذف المستخدم من Firebase Auth بنجاح، لكن تعذر إكمال حذف سجلات Firestore: ${dbErr?.message || dbErr}`
      });
    }

    // Step 3: Record immutable audit log
    try {
      const nowIso = new Date().toISOString();
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.collection('auditLogs').doc(auditId).set({
        id: auditId,
        timestamp: nowIso,
        eventType: 'USER_DELETED_PERMANENTLY',
        description: `Staff account ${cleanTargetUid} was permanently deleted by Admin ${callerUid} from Firebase Authentication and Firestore. Medical records and historical audit entries remain intact.`,
        callerUid,
        deletedUid: cleanTargetUid,
        reason: reason || 'Administrative removal',
        isImmutable: true,
        systemGenerated: true,
      });
    } catch (auditErr) {
      console.warn('[Admin Delete] Audit log writing notice:', auditErr);
    }

    return sendJson(res, 200, {
      success: true,
      message: 'تم حذف المستخدم نهائيًا من Firebase Authentication وقاعدة البيانات بنجاح.',
    });
  } catch (err: any) {
    console.error('[Vercel Function /api/admin/users/delete] Internal Error:', err);
    return sendJson(res, 500, { success: false, message: err?.message || 'Internal Server Error' });
  }
}
