import type { IncomingMessage, ServerResponse } from 'http';
import { adminMortalityAutoPurgeSweep, adminArchiveSweep } from '../../../src/server/adminOperations';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS & Preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Check CRON_SECRET security
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'CRON_SECRET is not configured on the server.' }));
    return;
  }

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Unauthorized: CRON_SECRET mismatch.' }));
    return;
  }

  try {
    // Run the sweeps securely server-side without user auth token (trusted by cron secret)
    const purgeResult = await adminMortalityAutoPurgeSweep();
    const archiveResult = await adminArchiveSweep(undefined, 30); // 30 days retention

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Vercel Cron auto-purge & archive tasks executed successfully.',
      purgeResult,
      archiveResult
    }));
  } catch (error: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error?.message || 'Internal server error.' }));
  }
}
