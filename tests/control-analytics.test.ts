import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, overview, boundedJson } from '../server/control/analytics';
const authEnv = { BOL_SUPABASE_URL: 'https://example.supabase.co', BOL_SUPABASE_ANON_KEY: 'public', BOL_ADMIN_USER_IDS: '4bc02d90-cb3d-4a91-95e5-da923e706f66' };
test('control plane requires Supabase verification, not claimed metadata', async () => {
  let requests = 0;
  const fake = async () => { requests++; return Response.json({ id: '4bc02d90-cb3d-4a91-95e5-da923e706f66' }); };
  assert.equal(await identity(undefined, authEnv, fake as typeof fetch), null);
  assert.equal(requests, 0);
  assert.deepEqual(await identity('Bearer token', authEnv, fake as typeof fetch), { allowed: true, userId: authEnv.BOL_ADMIN_USER_IDS });
  assert.equal((await identity('Bearer token', authEnv, (async () => Response.json({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', user_metadata: { admin: true } })) as typeof fetch))?.allowed, false);
  assert.equal(await identity('Bearer expired', authEnv, (async () => new Response('', { status: 401 })) as typeof fetch), null);
});
test('missing reporting credentials never produce fabricated metrics', async () => {
  const result = await overview(7, {});
  assert.ok(result.providers.every(p => p.status === 'setup_needed' && Object.keys(p.metrics).length === 0));
  await assert.rejects(overview(100, {}));
});
test('PostHog reporting is bounded and isolates provider failures', async () => {
  let count = 0;
  const fake = async (url: string, init?: RequestInit) => {
    assert.equal(url, 'https://us.posthog.com/api/projects/662131/query/');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer private');
    assert.equal(init?.redirect, 'error');
    const body = JSON.parse(init!.body as string); assert.match(body.query.query, /INTERVAL 30 DAY/); count++;
    return Response.json({ results: body.query.query.includes('avg(duration)') ? [[2, 15]] : [['captions_completed', 3]] });
  };
  const result = await overview(30, { BOL_POSTHOG_PERSONAL_API_KEY: 'private', BOL_POSTHOG_PROJECT_ID: '662131' }, fake as typeof fetch);
  assert.equal(count, 2); assert.deepEqual(result.providers[1].metrics, { sessions: 2, average_session_seconds: 15 });
  assert.equal(result.providers[0].status, 'setup_needed');
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('provider response limit aborts excessive payloads', async () => {
  await assert.rejects(boundedJson('https://example.com', {}, (async () => new Response('x'.repeat(2_000_001))) as typeof fetch), /too large/);
});
test('Sentry query uses project-scoped organization endpoint for both periods', async () => {
  for (const days of [7, 30]) {
    const result = await overview(days, { BOL_SENTRY_READ_TOKEN: 'private', BOL_SENTRY_ORG: 'bol-studio', BOL_SENTRY_PROJECT: 'javascript-react' }, (async (url: string) => {
      const u = new URL(url); assert.equal(u.pathname, '/api/0/organizations/bol-studio/issues/');
      assert.equal(u.searchParams.get('project'), 'javascript-react'); assert.equal(u.searchParams.get('statsPeriod'), `${days}d`);
      return Response.json([{ title: 'Test', count: '1', permalink: 'https://sentry.io/organizations/bol-studio/issues/1/' }]);
    }) as typeof fetch);
    assert.equal(result.providers[2].status, 'connected');
  }
});
test('Vercel total visitors use one production group, avoiding summed distinct visitors', async () => {
  const result = await overview(7, { BOL_VERCEL_ANALYTICS_TOKEN: 'private', BOL_VERCEL_PROJECT_ID: 'prj_test', BOL_VERCEL_TEAM_ID: 'team_test' }, (async (url: string) => {
    const u = new URL(url); assert.equal(u.searchParams.get('teamId'), 'team_test');
    const dimension = u.searchParams.get('by'); assert.ok(['environment','deviceType'].includes(dimension!));
    return Response.json({data:dimension === 'environment' ? [{environment:'production',visitors:1,pageviews:5}] : [{deviceType:'desktop',visitors:1,pageviews:5}]});
  }) as typeof fetch);
  assert.deepEqual(result.providers[0].metrics,{visitors:1,pageviews:5});
});
