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
      // Ignore parse error
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
