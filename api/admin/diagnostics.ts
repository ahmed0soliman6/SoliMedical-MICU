import type { IncomingMessage, ServerResponse } from 'http';
import { runAdminDiagnosticCheck } from '../../src/server/adminOperations';

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
    const authHeader = Array.isArray(req.headers.authorization) 
      ? req.headers.authorization[0] 
      : req.headers.authorization;

    const result = await runAdminDiagnosticCheck(authHeader);

    if (result.adminInitialized && result.authConnection) {
      return sendJson(res, 200, {
        adminInitialized: true,
        authConnection: true
      });
    }

    const statusCode = result.error?.includes('Access denied') || result.error?.includes('Unauthorized') ? 403 : 500;
    return sendJson(res, statusCode, result);
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
