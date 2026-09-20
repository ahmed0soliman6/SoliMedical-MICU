import type { IncomingMessage, ServerResponse } from 'http';
import { deleteUserWithToken } from '../../../src/server/adminOperations';

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
    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
    // Timeout safeguard so the promise never hangs if Vercel already consumed the stream
    setTimeout(() => resolve({}), 2000);
  });
}

export default async function handler(req: VercelReq, res: VercelRes) {
  // CORS Configuration for frontend clients (including GitHub Pages & preview instances)
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

    const body = await parseJsonBody(req);
    const targetUid = body?.targetUid;
    const reason = body?.reason;

    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
      return sendJson(res, 400, { success: false, message: 'Missing targetUid in request body.' });
    }

    // Call core admin operation (deletes from Firebase Auth first, then Firestore)
    const result = await deleteUserWithToken(authHeader, targetUid.trim(), reason);

    const statusCode = result.success
      ? 200
      : (result.message.includes('Permission Denied') || result.message.includes('Access denied') || result.message.includes('صلاحية') 
          ? 403 
          : 500);

    return sendJson(res, statusCode, result);
  } catch (err: any) {
    console.error('[Vercel Function /api/admin/users/delete] Internal Error:', err);
    return sendJson(res, 500, { success: false, message: err?.message || 'Internal Server Error' });
  }
}
