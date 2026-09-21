import type { IncomingMessage, ServerResponse } from 'http';
import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';

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
      // Ignore parse error
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

let cachedAuth: Auth | null = null;

function getAdminAuth(): Auth {
  if (cachedAuth) {
    return cachedAuth;
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
    throw new Error('Firebase Admin credentials are not configured in environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).');
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

  cachedAuth = getAuth(app);
  return cachedAuth;
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

  try {
    // 1. Check required environment variables
    const hasProj = Boolean(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID);
    const hasEmail = Boolean(process.env.FIREBASE_CLIENT_EMAIL);
    const hasKey = Boolean(
      process.env.FIREBASE_PRIVATE_KEY || 
      process.env.FIREBASE_SERVICE_ACCOUNT || 
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON || 
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );

    if (!hasProj || !hasEmail || !hasKey) {
      const missing: string[] = [];
      if (!hasProj) missing.push('FIREBASE_PROJECT_ID');
      if (!hasEmail) missing.push('FIREBASE_CLIENT_EMAIL');
      if (!hasKey) missing.push('FIREBASE_PRIVATE_KEY');
      return sendJson(res, 500, {
        adminInitialized: false,
        authConnection: false,
        error: `Missing required environment variables: ${missing.join(', ')}`
      });
    }

    // 2. Initialize Firebase Admin SDK
    let auth: Auth;
    try {
      auth = getAdminAuth();
    } catch (initErr: any) {
      const safeError = String(initErr?.message || initErr)
        .replace(/-----BEGIN[\s\S]+?-----END[^\n]+(?:\n|$)/g, '[REDACTED_KEY]')
        .replace(/(?:privateKey|private_key)["']?\s*:\s*["'][^"']+["']/gi, 'private_key:"[REDACTED]"');
      return sendJson(res, 500, {
        adminInitialized: false,
        authConnection: false,
        error: `Firebase Admin initialization failed: ${safeError}`
      });
    }

    // 3. Test real connection to Firebase Authentication
    try {
      await auth.listUsers(1);
      return sendJson(res, 200, {
        adminInitialized: true,
        authConnection: true
      });
    } catch (authErr: any) {
      const safeError = String(authErr?.message || authErr)
        .replace(/-----BEGIN[\s\S]+?-----END[^\n]+(?:\n|$)/g, '[REDACTED_KEY]')
        .replace(/(?:privateKey|private_key)["']?\s*:\s*["'][^"']+["']/gi, 'private_key:"[REDACTED]"');
      return sendJson(res, 500, {
        adminInitialized: true,
        authConnection: false,
        error: `Firebase Auth connection failed: ${safeError}`
      });
    }
  } catch (err: any) {
    const cleanErr = String(err?.message || err)
      .replace(/-----BEGIN[\s\S]+?-----END[^\n]+(?:\n|$)/g, '[REDACTED_KEY]')
      .replace(/(?:privateKey|private_key)["']?\s*:\s*["'][^"']+["']/gi, 'private_key:"[REDACTED]"');

    return sendJson(res, 500, {
      adminInitialized: false,
      authConnection: false,
      error: cleanErr
    });
  }
}
