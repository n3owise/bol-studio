/** Vercel control plane: no model, media or worker dependencies. */
type Env = Record<string, string | undefined>;
const env = process.env;
export function safeLink(value: string | undefined, hosts: string[], fallback: string): string {
  try { const u = new URL(value || ''); return u.protocol === 'https:' && hosts.includes(u.hostname) && !u.username && !u.password && !u.search ? u.href : fallback; } catch { return fallback; }
}
export function links(e: Env = env) {
  let ref = ''; try { const h = new URL(e.BOL_SUPABASE_URL || e.VITE_SUPABASE_URL || '').hostname; if (h.endsWith('.supabase.co')) ref = h.split('.')[0]; } catch {}
  return {
    vercel: safeLink(e.BOL_VERCEL_DASHBOARD_URL, ['vercel.com'], 'https://vercel.com/iamspyderhack-7710s-projects/bol-studio/analytics'),
    posthog: safeLink(e.BOL_POSTHOG_DASHBOARD_URL, ['us.posthog.com', 'eu.posthog.com', 'app.posthog.com'], 'https://us.posthog.com/'),
    sentry: safeLink(e.BOL_SENTRY_DASHBOARD_URL, ['sentry.io'], 'https://sentry.io/'),
    supabase: ref ? `https://supabase.com/dashboard/project/${ref}` : 'https://supabase.com/dashboard',
  };
}
export async function boundedJson(url: string, init: RequestInit = {}, fetcher = fetch): Promise<any> {
  const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok || !response.body) throw new Error('Provider unavailable');
  const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 2_000_000) throw new Error('Response too large'); chunks.push(value); } }
  finally { await reader.cancel(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
/** Supabase validates token server-side. Browser owner headers/metadata never authorize access. */
export async function identity(authorization: string | undefined, e: Env = env, fetcher = fetch) {
  if (!authorization || !/^Bearer [^\s]+$/.test(authorization) || authorization.length > 16000) return null;
  const host = e.BOL_SUPABASE_URL || e.VITE_SUPABASE_URL;
  const key = e.BOL_SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY;
  if (!host || !key) throw new Error('Authentication is not configured');
  const u = new URL(host);
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.supabase.co') || u.username || u.password || u.search || u.hash) throw new Error('Invalid authentication host');
  try {
    const user = await boundedJson(`${u.origin}/auth/v1/user`, { headers: { Authorization: authorization, apikey: key } }, fetcher);
    if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) return null;
    const allowed = (e.BOL_ADMIN_USER_IDS || '').split(',').map(x => x.trim()).includes(user.id);
    return { userId: user.id, allowed };
  } catch { return null; }
}
function missing(provider: string, names: string[]) { return { provider, status: 'setup_needed', message: 'Add the reporting credentials to connect this service.', missing: names, metrics: {}, rows: [] }; }
async function provider(name: string, fields: string[], task: () => Promise<any>, e: Env) {
  const absent = fields.filter(f => !e[f]); if (absent.length) return missing(name, absent);
  try { return { provider: name, status: 'connected', ...await task() }; }
  catch { return { provider: name, status: 'unavailable', message: 'Unable to read this service. Check API credentials, permissions and plan access.', metrics: {}, rows: [] }; }
}
export async function overview(days: number, e: Env = env, fetcher = fetch) {
  if (![7, 30].includes(days)) throw new Error('Invalid period');
  const read = (url: string, token: string | undefined, init: RequestInit = {}) => boundedJson(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }, fetcher);
  const providers = await Promise.all([
    provider('vercel', ['BOL_VERCEL_ANALYTICS_TOKEN', 'BOL_VERCEL_PROJECT_ID'], async () => {
      const params = new URLSearchParams({ projectId: e.BOL_VERCEL_PROJECT_ID!, since: new Date(Date.now() - days * 86400000).toISOString(), until: new Date().toISOString(), limit: '40' });
      if (e.BOL_VERCEL_TEAM_ID) params.set('teamId', e.BOL_VERCEL_TEAM_ID);
      const endpoint = 'https://api.vercel.com/v1/query/web-analytics/visits/aggregate';
      const [total, devices] = await Promise.all([read(`${endpoint}?${params}&by=environment`, e.BOL_VERCEL_ANALYTICS_TOKEN), read(`${endpoint}?${params}&by=deviceType`, e.BOL_VERCEL_ANALYTICS_TOKEN)]);
      const row = Array.isArray(total.data) ? total.data[0] || {} : total.data || {};
      const metrics = Object.fromEntries(['visitors', 'pageviews'].filter(k => typeof row[k] === 'number').map(k => [k, row[k]]));
      const rows = Array.isArray(devices.data) ? devices.data.slice(0, 20).map((r: any) => ({ deviceType: r.deviceType, visitors: r.visitors, pageviews: r.pageviews })) : [];
      const dimensions = ['day', 'country', 'browserName', 'osName', 'requestPath', 'referrerHostname'];
      const reports = await Promise.all(dimensions.map(async key => {
        try { const response = await read(`${endpoint}?${params}&by=${key}`, e.BOL_VERCEL_ANALYTICS_TOKEN);
          return { key, status: 'connected', rows: Array.isArray(response.data) ? response.data.slice(0, key === 'day' ? 31 : 20) : [] }; }
        catch { return { key, status: 'unavailable', rows: [] }; }
      }));
      return { message: 'Vercel production traffic.', metrics, rows, reports };
    }, e),
    provider('posthog', ['BOL_POSTHOG_PERSONAL_API_KEY', 'BOL_POSTHOG_PROJECT_ID'], async () => {
      const host = (e.BOL_POSTHOG_API_HOST || 'https://us.posthog.com').replace(/\/$/, '');
      if (!['https://us.posthog.com', 'https://eu.posthog.com', 'https://app.posthog.com'].includes(host) || !/^\d+$/.test(e.BOL_POSTHOG_PROJECT_ID!)) throw new Error('Invalid provider');
      const sql = [
        `SELECT event, count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event IN ('studio_opened','signup_completed','upload_started','upload_completed','upload_failed','captions_started','captions_completed','captions_failed','export_started','export_completed','export_failed') GROUP BY event ORDER BY count() DESC LIMIT 20`,
        `SELECT count(), avg(duration) FROM (SELECT dateDiff('second', min(timestamp), max(timestamp)) AS duration FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND properties.$session_id IS NOT NULL GROUP BY properties.$session_id)`
      ];
      const [events, sessions] = await Promise.all(sql.map(query => read(`${host}/api/projects/${e.BOL_POSTHOG_PROJECT_ID}/query/`, e.BOL_POSTHOG_PERSONAL_API_KEY, { method: 'POST', body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }) })));
      const rows = events.results.filter((r: any) => Array.isArray(r) && r.length >= 2).slice(0, 20).map((r: any) => ({ event: r[0], count: r[1] }));
      const s = sessions.results?.[0];
      const extraQueries = {
        processing: `SELECT event, count(), avg(toFloat64OrNull(toString(properties.elapsed_seconds))) FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event IN ('captions_completed','export_completed') GROUP BY event LIMIT 10`,
        features: `SELECT event, properties.panel, properties.preset, count() FROM events WHERE timestamp >= now() - INTERVAL ${days} DAY AND event IN ('panel_opened','preset_selected') GROUP BY event, properties.panel, properties.preset ORDER BY count() DESC LIMIT 20`
      };
      const reports = await Promise.all(Object.entries(extraQueries).map(async ([key, query]) => {
        try { const result = await read(`${host}/api/projects/${e.BOL_POSTHOG_PROJECT_ID}/query/`, e.BOL_POSTHOG_PERSONAL_API_KEY, { method: 'POST', body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }) });
          return { key, status: 'connected', rows: result.results.map((r: any[]) => key === 'processing' ? { event: r[0], samples: r[1], average_seconds: r[2] } : { event: r[0], panel: r[1], preset: r[2], count: r[3] }) }; }
        catch { return { key, status: 'unavailable', rows: [] }; }
      }));
      return { message: 'Consented product events and session summaries.', rows, reports, metrics: Array.isArray(s) && s.length >= 2 ? { sessions: s[0], average_session_seconds: s[1] } : {} };
    }, e),
    provider('sentry', ['BOL_SENTRY_READ_TOKEN', 'BOL_SENTRY_ORG', 'BOL_SENTRY_PROJECT'], async () => {
      if (![e.BOL_SENTRY_ORG!, e.BOL_SENTRY_PROJECT!].every(x => /^[a-zA-Z0-9_-]{1,100}$/.test(x))) throw new Error('Invalid provider');
      const issues = await read(`https://sentry.io/api/0/organizations/${e.BOL_SENTRY_ORG}/issues/?project=${e.BOL_SENTRY_PROJECT}&query=is%3Aunresolved&statsPeriod=${days}d&limit=20`, e.BOL_SENTRY_READ_TOKEN);
      const rows = issues.slice(0, 20).map((i: any) => ({ title: i.title, count: i.count, users: i.userCount, lastSeen: i.lastSeen, level: i.level, firstSeen: i.firstSeen, url: safeLink(i.permalink, ['sentry.io', 'us.sentry.io', 'eu.sentry.io', `${e.BOL_SENTRY_ORG}.sentry.io`], links(e).sentry) }));
      return { message: 'Up to 20 recent unresolved issues; issue events are not necessarily crashes.', metrics: { unresolved_issues_shown: rows.length }, rows };
    }, e),
  ]);
  return { days, updatedAt: new Date().toISOString(), providers, links: links(e) };
}
