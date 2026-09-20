import type { IncomingMessage, ServerResponse } from 'http';
import { adminPasswordRecovery } from '../../../src/server/adminOperations';

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

    if (!username || !recoveryCode || !newPassword) {
      return sendJson(res, 400, {
        success: false,
        message: 'جميع الحقول مطلوبة (اسم المستخدم، كود الاستعادة، وكلمة المرور الجديدة).'
      });
    }

    const result = await adminPasswordRecovery(username, recoveryCode, newPassword);
    const statusCode = result.success ? 200 : 400;
    return sendJson(res, statusCode, result);
  } catch (err: any) {
    console.error('[Vercel Function /api/admin/recovery] Error:', err);
    return sendJson(res, 500, { success: false, message: err?.message || 'Internal Server Error' });
  }
}
