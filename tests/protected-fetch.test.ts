import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, fetchProtectedResource } from '../src/lib/protected-fetch.ts';

test('audio file fetch uses the API origin, bearer token, key and workspace header', async () => {
  const url = 'https://api.example.test/api/projects/project/audio';
  const response = await fetchProtectedResource(url, undefined, {
    headers: () => ({ Authorization: 'Bearer valid', 'X-API-Key': 'key', 'X-Bol-Owner': 'alice' }),
    authEnabled: true, refresh: async () => false, signOut: async () => assert.fail('Valid session signed out'),
  }, async (input, options) => {
    assert.equal(input, url);
    assert.deepEqual(options?.headers, { Authorization: 'Bearer valid', 'X-API-Key': 'key', 'X-Bol-Owner': 'alice' });
    return new Response('audio data', { headers: { 'Content-Type': 'audio/mp4' } });
  });
  assert.equal(await (await response.blob()).text(), 'audio data');
});

test('expired audio request refreshes once and fetches with the new token', async () => {
  let token = 'expired'; let calls = 0; let refreshes = 0;
  const response = await fetchProtectedResource('https://api.example.test/api/projects/p/audio', undefined, {
    headers: () => ({ Authorization: `Bearer ${token}` }), authEnabled: true,
    refresh: async () => { refreshes++; token = 'fresh'; return true; },
    signOut: async () => assert.fail('Refreshed session signed out'),
  }, async (_, options) => {
    calls++;
    assert.equal((options?.headers as any).Authorization, calls === 1 ? 'Bearer expired' : 'Bearer fresh');
    return calls === 1 ? Response.json({ code: 'token_expired' }, { status: 401 }) : new Response('audio');
  });
  assert.equal(await response.text(), 'audio'); assert.equal(calls, 2); assert.equal(refreshes, 1);
});

test('repeated expiration stops after one refresh and does not deliver an error blob', async () => {
  let calls = 0; let refreshes = 0; let signouts = 0;
  await assert.rejects(fetchProtectedResource('https://api.example.test/api/projects/p/audio', undefined, {
    headers: () => ({}), authEnabled: true,
    refresh: async () => { refreshes++; return true; }, signOut: async () => { signouts++; },
  }, async () => { calls++; return Response.json({ code: 'token_expired' }, { status: 401 }); }),
  (error: any) => error instanceof ApiError && error.status === 401);
  assert.equal(calls, 2); assert.equal(refreshes, 1); assert.equal(signouts, 1);
});

test('foreign project refusal remains an error, while ordinary headers are retained', async () => {
  await assert.rejects(fetchProtectedResource('https://api.example.test/api/projects/p/audio', {
    headers: new Headers({ 'Content-Type': 'application/json' }),
  }, {
    headers: extra => ({ ...extra, Authorization: 'Bearer other-user' }), authEnabled: true,
    refresh: async () => assert.fail('404 refreshed a token'), signOut: async () => assert.fail('404 ended session'),
  }, async (_, options) => {
    assert.equal((options?.headers as any)['content-type'], 'application/json');
    return Response.json({ detail: 'Project not found.' }, { status: 404 });
  }), (error: any) => error instanceof ApiError && error.status === 404 && error.message === 'Project not found.');
});
