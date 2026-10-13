import { pinAccepted } from './pin.js';
import { identity, overview } from './analytics.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
export async function handle(req: IncomingMessage, res: ServerResponse, accessOnly: boolean) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json');
  const send = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { detail: 'Method not allowed.' }); }
  try {
    const user = await identity(req.headers.authorization);
    if (!user) return send(401, { detail: 'Please sign in.' });
    if (accessOnly) return send(200, { ...user, unlocked: user.allowed && pinAccepted(req.headers['x-bol-admin-pin']) });
    if (!user.allowed) return send(403, { detail: 'Administrator access required.' });
    if (!pinAccepted(req.headers['x-bol-admin-pin'])) return send(403, { detail: 'Enter your security PIN to unlock analytics.' });
    const period = new URL(req.url || '/', 'https://localhost').searchParams.get('days') || '7';
    if (!['7', '30'].includes(period)) return send(422, { detail: 'Choose 7 or 30 days.' });
    return send(200, await overview(Number(period)));
  } catch { console.error('Admin analytics request failed'); return send(503, { detail: 'Analytics is temporarily unavailable.' }); }
}
