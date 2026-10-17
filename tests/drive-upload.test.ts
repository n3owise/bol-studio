import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadResumable } from '../src/lib/drive-upload';
const pause = async () => {};

test('Drive transfer resumes at the confirmed offset and completes in bounded chunks', async () => {
  const original = globalThis.fetch;
  const ranges: string[] = [];
  const progress: number[] = [];
  const size = 9 * 1024 * 1024;
  const file = new File([new Uint8Array(size)], 'clip.mp4');
  let n = 0;
  globalThis.fetch = async (_url, options) => {
    ranges.push((options?.headers as Record<string, string>)['Content-Range']);
    return [new Response(null, { status: 308, headers: { Range: 'bytes=0-262143' } }),
      new Response(null, { status: 308, headers: { Range: 'bytes=0-8650751' } }),
      new Response('{}', { status: 200 })][n++];
  };
  try {
    await uploadResumable('https://drive-upload.test/session', file, value => progress.push(value), pause);
    assert.deepEqual(ranges, [`bytes */${size}`, `bytes 262144-8650751/${size}`, `bytes 8650752-${size - 1}/${size}`]);
    assert.equal(progress.at(-1), 100);
  } finally { globalThis.fetch = original; }
});

test('Lost response queries the committed offset instead of restarting the upload', async () => {
  const original = globalThis.fetch;
  const ranges: string[] = [];
  let n = 0;
  globalThis.fetch = async (_url, options) => {
    ranges.push((options?.headers as Record<string, string>)['Content-Range']);
    if (++n === 2) throw new TypeError('Network interrupted');
    if (n === 1) return new Response(null, { status: 308 });
    if (n === 3) return new Response(null, { status: 308, headers: { Range: 'bytes=0-4' } });
    return new Response('{}', { status: 200 });
  };
  try {
    await uploadResumable('https://drive-upload.test/session', new File(['1234567890'], 'clip'), () => {}, pause);
    assert.deepEqual(ranges, ['bytes */10', 'bytes 0-9/10', 'bytes */10', 'bytes 5-9/10']);
  } finally { globalThis.fetch = original; }
});

test('A stalled upload cannot loop forever when the progress header is missing', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 308 }); };
  try {
    await assert.rejects(uploadResumable('https://drive-upload.test/session', new File(['1234'], 'clip'), () => {}, pause), /progress/);
    assert.ok(calls <= 8);
  } finally { globalThis.fetch = original; }
});
