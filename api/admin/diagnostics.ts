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

function safeParseServiceAccount(raw: any): any {
  if (!raw) return null;
  if (typeof raw === 'object' && raw !== null) return raw;
  if (typeof raw !== 'string') return null;

  let str = raw.trim();
  if (!str) return null;

  try {
    const res = JSON.parse(str);
    if (typeof res === 'object' && res !== null) return res;
    if (typeof res === 'string') {
      return safeParseServiceAccount(res);
    }
  } catch {}

  if (str.includes('\\"')) {
    try {
      const unescaped = str.replace(/\\"/g, '"');
      const candidate = unescaped.startsWith('{') ? unescaped : `{${unescaped}}`;
      const res = JSON.parse(candidate);
      if (typeof res === 'object' && res !== null) return res;
    } catch {}
  }

  if (!str.startsWith('{')) {
    try {
      let candidate = str;
      if (!candidate.startsWith('{')) candidate = '{' + candidate;
      if (!candidate.endsWith('}')) candidate = candidate + '}';
      const res = JSON.parse(candidate);
      if (typeof res === 'object' && res !== null) return res;
    } catch {}
  }

  if (
    (str.startsWith('"') && str.endsWith('"') && str.length > 2) ||
    (str.startsWith("'") && str.endsWith("'") && str.length > 2)
  ) {
    const inner = str.slice(1, -1).trim();
    try {
      const res = JSON.parse(inner.startsWith('{') ? inner : `{${inner}}`);
      if (typeof res === 'object' && res !== null) return res;
    } catch {}
  }

  if (!str.startsWith('{') && /^[A-Za-z0-9+/=\s]+$/.test(str)) {
    try {
      const decoded = Buffer.from(str.replace(/\s+/g, ''), 'base64').toString('utf-8').trim();
      if (decoded.startsWith('{') || decoded.includes('"client_email"')) {
        const res = safeParseServiceAccount(decoded);
        if (typeof res === 'object' && res !== null) return res;
      }
    } catch {}
  }

  return null;
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
  if (cleanKey.includes('"private_key"') || cleanKey.startsWith('{')) {
    try {
      const parsed = safeParseServiceAccount(cleanKey);
      if (parsed?.private_key) {
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
  const targetProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'solimedical-micu';

  // 1. Direct explicit environment variables: FIREBASE_CLIENT_EMAIL & FIREBASE_PRIVATE_KEY
  const directClientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const directPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (directClientEmail && directPrivateKey) {
    if (directClientEmail.includes(targetProjectId) || !process.env.FIREBASE_SERVICE_ACCOUNT) {
      const formattedKey = formatPrivateKey(directPrivateKey);
      if (formattedKey) {
        return {
          projectId: targetProjectId,
          clientEmail: directClientEmail,
          privateKey: formattedKey
        };
      }
    }
  }

  // 2. Safe parse FIREBASE_SERVICE_ACCOUNT or GOOGLE_SERVICE_ACCOUNT_JSON
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = safeParseServiceAccount(rawJson);
      if (parsed && parsed.client_email && parsed.private_key) {
        const credProjectId = parsed.project_id || targetProjectId;
        const formattedKey = formatPrivateKey(parsed.private_key);
        if (formattedKey) {
          return {
            projectId: credProjectId,
            clientEmail: parsed.client_email,
            privateKey: formattedKey
          };
        }
      }
    } catch {
      // Gracefully ignore parse error
    }
  }

  // 3. Check if FIREBASE_PRIVATE_KEY contains full service account JSON
  if (directPrivateKey) {
    try {
      const parsed = safeParseServiceAccount(directPrivateKey);
      if (parsed && parsed.client_email && parsed.private_key) {
        const formattedKey = formatPrivateKey(parsed.private_key);
        if (formattedKey) {
          return {
            projectId: parsed.project_id || targetProjectId,
            clientEmail: parsed.client_email,
            privateKey: formattedKey
          };
        }
      }
    } catch {
      // Gracefully ignore
    }
  }

  // 4. Fallback to direct clientEmail & formattedKey
  if (directClientEmail && directPrivateKey) {
    const formattedKey = formatPrivateKey(directPrivateKey);
    if (formattedKey) {
      return {
        projectId: targetProjectId,
        clientEmail: directClientEmail,
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
