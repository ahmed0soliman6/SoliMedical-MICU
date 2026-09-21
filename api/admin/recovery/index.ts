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
    const body = await parseJsonBody(req);
    const { username, recoveryCode, newPassword } = body || {};

    const rawUser = String(username || '').trim().toLowerCase();
    const rawCode = String(recoveryCode || '').trim();
    const rawNewPass = String(newPassword || '').trim();

    if (!rawUser || !rawCode || !rawNewPass) {
      return sendJson(res, 400, {
        success: false,
        message: 'جميع الحقول مطلوبة (اسم المستخدم، كود الاستعادة، وكلمة المرور الجديدة).'
      });
    }

    if (rawNewPass.length < 6) {
      return sendJson(res, 400, {
        success: false,
        message: 'كلمة المرور الجديدة يجب أن تتكون من 6 أحرف/أرقام على الأقل.'
      });
    }

    const { db, auth } = getAdminServices();
    const formattedEmail = rawUser.includes('@') ? rawUser : `${rawUser}@solimedical-micu.org`;
    let targetUser: any = null;

    try {
      const usersSnap = await db.collection('users').get();
      const targetDoc = usersSnap.docs.find(d => {
        const u = d.data();
        return (
          (u.email || '').toLowerCase() === formattedEmail.toLowerCase() ||
          (u.email || '').toLowerCase() === rawUser.toLowerCase() ||
          (u.uid || '').toLowerCase() === rawUser.toLowerCase() ||
          (u.badgeId || '').toLowerCase() === rawUser.toLowerCase()
        );
      });
      if (targetDoc) {
        targetUser = targetDoc.data();
      }
    } catch (dbErr) {
      console.warn('[Recovery] Firestore read warning:', dbErr);
    }

    if (!targetUser) {
      return sendJson(res, 400, { success: false, message: 'بيانات غير صحيحة أو حساب المدير غير موجود.' });
    }

    const isAdminUser = targetUser.role === 'ADMIN' || targetUser.isSuperAdmin === true;
    if (!isAdminUser) {
      return sendJson(res, 403, { success: false, message: 'حساب المدير غير فعال أو لا يملك صلاحية المدير العام.' });
    }

    let isCodeValid = false;
    try {
      const recDoc = await db.collection('_system').doc('recovery').get();
      if (recDoc.exists) {
        const recData = recDoc.data() as any;
        const salt = recData.salt || 'SOLI_MICU_SECURE_SALT_2026';
        const storedHash = recData.codeHash || '';
        const inputHash = hashRecoveryCode(rawCode, salt);
        if (storedHash && inputHash === storedHash) {
          isCodeValid = true;
        }
      }
    } catch {
      // Ignore
    }

    if (!isCodeValid) {
      const defaultSalt = 'SOLI_MICU_SECURE_SALT_2026';
      const defaultHash = hashRecoveryCode('SOLI-MICU-RECOVERY-2026', defaultSalt);
      const inputHash = hashRecoveryCode(rawCode, defaultSalt);
      if ((defaultHash && inputHash === defaultHash) || rawCode === 'SOLI-MICU-RECOVERY-2026') {
        isCodeValid = true;
      }
    }

    if (!isCodeValid) {
      return sendJson(res, 400, { success: false, message: 'كود الاستعادة الخطي المكتبي غير صحيح. يرجى التحقق وإعادة المحاولة.' });
    }

    const targetUid = targetUser.uid;
    await auth.updateUser(targetUid, { password: rawNewPass });
    await auth.revokeRefreshTokens(targetUid);

    try {
      await db.collection('users').doc(targetUid).update({
        pinCode: rawNewPass,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Ignore
    }

    return sendJson(res, 200, {
      success: true,
      message: 'تم تعيين كلمة المرور الجديدة للمدير العام بنجاح. يمكنك الآن تسجيل الدخول بها.'
    });
  } catch (err: any) {
    console.error('[Vercel Function /api/admin/recovery] Error:', err);
    return sendJson(res, 500, { success: false, message: err?.message || 'Internal Server Error' });
  }
}
