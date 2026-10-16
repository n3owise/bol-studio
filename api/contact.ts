import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * The public contact form. Sends the message through Resend to the owner's
 * inbox, with the visitor's address as Reply-To so answering is one click.
 *
 * Needs, in Vercel → Settings → Environment Variables:
 *   RESEND_API_KEY   a Resend sending key (the account already verifies bol-studio.me)
 *   CONTACT_TO       where messages land, e.g. the owner's own inbox
 *   CONTACT_FROM     optional; defaults to "Bol Studio <contact@bol-studio.me>"
 * Without the first two it answers 503 and the form points people at the email address.
 */

const LIMITS = { name: 100, email: 200, message: 5000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Per-instance and best effort: enough to blunt a script hammering one
// warm function, not a substitute for a real limiter.
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter(t => now - t < 10 * 60_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 5;
}

function send(res: ServerResponse, status: number, body: object) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) return null;
  }
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch { return null; }
}

const escape = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'Use POST.' }); }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO;
  if (!key || !to) return send(res, 503, { error: 'not_configured' });

  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  if (tooMany(ip)) return send(res, 429, { error: 'Too many messages. Try again in a few minutes.' });

  const body = await readJson(req);
  if (!body) return send(res, 400, { error: 'That request could not be read.' });

  // The honeypot: a field people never see. Anything in it is a bot, and it
  // gets a success so it has no reason to retry.
  if (typeof body.website === 'string' && body.website.trim()) return send(res, 200, { ok: true });

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const message = String(body.message ?? '').trim();
  if (!name || name.length > LIMITS.name) return send(res, 400, { error: 'Please add your name.', field: 'name' });
  if (!EMAIL.test(email) || email.length > LIMITS.email) return send(res, 400, { error: 'Please enter a valid email address.', field: 'email' });
  if (message.length < 10 || message.length > LIMITS.message) return send(res, 400, { error: 'Please write a message of at least 10 characters.', field: 'message' });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM || 'Bol Studio <contact@bol-studio.me>',
      to: [to],
      reply_to: email,
      subject: `Contact form: ${name.slice(0, 60)}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${escape(name)} &lt;${escape(email)}&gt;</p><p style="white-space:pre-wrap">${escape(message)}</p>`,
    }),
  }).catch(() => null);

  if (!response?.ok) return send(res, 502, { error: 'send_failed' });
  return send(res, 200, { ok: true });
}
