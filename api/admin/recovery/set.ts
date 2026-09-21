import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import crypto from 'crypto';

interface VercelReq extends IncomingMessage {
  body?: any;
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
    throw new Error('Firebase Admin SDK is not configured in environment variables.');
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
    return { isAdmin: false, error: 'Missing or invalid Authorization header.' };
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return { isAdmin: false, error: 'Empty Authorization ID Token.' };
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

    try {
      const callerDoc = await db.collection('users').doc(callerUid).get();
      if (callerDoc.exists) {
        const callerData = callerDoc.data() as any;
        const isActive = callerData.active !== false && callerData.isActive !== false;
        const isAdmin = callerData.role === 'ADMIN' || 
                        callerData.isSuperAdmin === true || 
                        callerData.permissions?.canManageUsers === true;

        if (!isActive || !isAdmin) {
          return { isAdmin: false, callerUid, error: 'Access denied: Caller does not have active administrator permissions.' };
        }
      }
    } catch {
      // Ignore
    }

    return { isAdmin: true, callerUid };
  } catch (err: any) {
    return { isAdmin: false, error: `Authentication verification failed: ${err?.message || err}` };
  }
}

function hashRecoveryCode(code: string, salt: string): string {
  return crypto.pbkdf2Sync(code.trim(), salt, 10000, 64, 'sha512').toString('hex');
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
    if (!authCheck.isAdmin) {
      return sendJson(res, 403, { success: false, message: authCheck.error || 'Permission Denied' });
    }

    const body = await parseJsonBody(req);
    const { newRecoveryCode } = body || {};

    if (!newRecoveryCode || typeof newRecoveryCode !== 'string' || newRecoveryCode.trim().length < 8) {
      return sendJson(res, 400, { success: false, message: 'رمز الاستعادة الجديد يجب ألا يقل عن 8 أحرف/أرقام.' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const codeHash = hashRecoveryCode(newRecoveryCode, salt);

    const { db } = getAdminServices();
    await db.collection('_system').doc('recovery').set({
      salt,
      codeHash,
      updatedAt: new Date().toISOString(),
      updatedByUid: authCheck.callerUid || 'system',
      isImmutable: true
    }, { merge: true });

    return sendJson(res, 200, { success: true, message: 'تم تحديث رمز التشفير بنجاح في النظام.' });
  } catch (err: any) {
    console.error('[Vercel Function /api/admin/recovery/set] Error:', err);
    return sendJson(res, 500, { success: false, message: err?.message || 'Internal Server Error' });
  }
}
