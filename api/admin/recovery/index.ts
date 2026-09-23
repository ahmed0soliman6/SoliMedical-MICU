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

function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;

  let cleanKey = key.trim();

  // Strip wrapping quotes (single or double)
  while (
    (cleanKey.startsWith('"') && cleanKey.endsWith('"')) ||
    (cleanKey.startsWith("'") && cleanKey.endsWith("'"))
  ) {
    cleanKey = cleanKey.slice(1, -1).trim();
  }

  // Convert escaped newlines and CRLF to real newline characters
  cleanKey = cleanKey
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\\\n/g, '\n');

  // Handle case where user pasted the full service account JSON
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

  // Format into standard PEM with clean line breaks
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
    } catch {
      // Ignore
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
      // Ignore
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  if (clientEmail && rawKey) {
    const formattedKey = formatPrivateKey(rawKey);
    if (formattedKey) {
      return {
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'solimedical-micu',
        clientEmail,
        privateKey: formattedKey
      };
    }
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

async function verifyAdminCaller(authHeader: string | undefined): Promise<{ isAdmin: boolean; callerUid?: string; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAdmin: false, error: 'Unauthorized: Missing or invalid Bearer token.' };
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return { isAdmin: false, error: 'Unauthorized: Token is empty.' };
  }

  try {
    const { auth, db } = getAdminServices();
    const decodedToken = await auth.verifyIdToken(token);
    const callerUid = decodedToken?.uid;

    if (!callerUid) {
      return { isAdmin: false, error: 'Invalid token payload: missing caller UID.' };
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
    } catch (dbErr) {
      console.error('[Recovery] Firestore admin check error:', dbErr);
      return { isAdmin: false, callerUid, error: 'Access denied: Unable to verify administrator permissions.' };
    }

    if (!isCallerActive || !isCallerAdmin) {
      return { isAdmin: false, callerUid, error: 'Access denied: Caller does not have active administrator permissions.' };
    }

    return { isAdmin: true, callerUid };
  } catch (err: any) {
    return { isAdmin: false, error: `Authentication verification failed: ${err?.message || err}` };
  }
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
    const url = (req.url || '').toLowerCase();
    const xForwardedUri = ((req.headers['x-forwarded-uri'] as string) || '').toLowerCase();
    const xMatchedPath = ((req.headers['x-matched-path'] as string) || '').toLowerCase();
    const body = await parseJsonBody(req);

    // Branch A: Set Recovery Code
    if (url.includes('/set') || xForwardedUri.includes('/set') || xMatchedPath.includes('/set') || body?.newRecoveryCode || body?.action === 'set') {
      const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined;
      const authCheck = await verifyAdminCaller(authHeader);
      if (!authCheck.isAdmin) {
        return sendJson(res, 403, { success: false, message: authCheck.error || 'Permission Denied: Admin token required.' });
      }

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
    }

    // Branch B: Recover Password using code
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
      return sendJson(res, 400, { success: false, message: 'كود الاستعادة الخطي المكتبي غير صحيح. يرجى التحقق وإعادة المحاولة.' });
    }

    const targetUid = targetUser.uid;
    await auth.updateUser(targetUid, { password: rawNewPass });
    await auth.revokeRefreshTokens(targetUid);

    try {
      await db.collection('users').doc(targetUid).update({
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
