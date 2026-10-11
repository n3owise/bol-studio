import assert from 'node:assert/strict';
import test from 'node:test';
import { fitDecodedVideo, renderResourceLimits, validateRenderResources } from '../server/render-resources';

test('8K landscape and tall media decode within the output canvas rather than source size', () => {
  assert.deepEqual(fitDecodedVideo(7680, 4320, 1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(fitDecodedVideo(4320, 7680, 1920, 1080), { width: 607, height: 1080 });
  assert.deepEqual(fitDecodedVideo(640, 360, 1920, 1080), { width: 640, height: 360 });
});

test('simultaneous decoder admission includes primary and rejects excess layers with an action', () => {
  const video = { width: 320, height: 180, startFrame: 0, endFrame: 30 };
  assert.throws(() => validateRenderResources(1920, 1080, Array.from({ length: 9 }, (_, i) => ({ id: String(i), ...video }))), /9 simultaneous.*Reduce overlapping/);
  assert.equal(validateRenderResources(1920, 1080, Array.from({ length: 8 }, (_, i) => ({ id: String(i), ...video }))).maxDecoders, 8);
});

test('sequential clips reuse admission; one-frame overlap counts both videos', () => {
  const videos = Array.from({ length: 50 }, (_, i) => ({ id: String(i), width: 1920, height: 1080, startFrame: i * 30, endFrame: (i + 1) * 30 }));
  assert.equal(validateRenderResources(1920, 1080, videos, { decoders: 1, pixels: 5000000 }).maxDecoders, 1);
  videos[0].endFrame++;
  assert.throws(() => validateRenderResources(1920, 1080, videos, { decoders: 1, pixels: 5000000 }), /2 simultaneous/);
});

test('pixel admission includes output frame, primary frame, and active overlay dimensions', () => {
  const base = { width: 3840, height: 2160, startFrame: 0, endFrame: 60 };
  assert.throws(() => validateRenderResources(3840, 2160, [{ id: 'primary', ...base }, { id: 'overlay', ...base }]), /RGBA frame pixels.*lower export resolution/);
  assert.equal(validateRenderResources(3840, 2160, [{ id: 'primary', ...base }]).maxPixels, 16588800);
});

test('resource limits are configurable and malformed configuration fails closed', () => {
  assert.deepEqual(renderResourceLimits({ BOL_MAX_RENDER_VIDEO_DECODERS: '3', BOL_MAX_RENDER_DECODED_PIXELS: '4000000' }), { decoders: 3, pixels: 4000000, visualAssets: 64 });
  for (const value of ['0', '-1', 'Infinity', 'garbage', '1.5']) assert.throws(() => renderResourceLimits({ BOL_MAX_RENDER_VIDEO_DECODERS: value }), /positive integer/);
});

import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { renderCaptionVideo, openVideoFrames } from '../server/render';
import { defaults, type Project } from '../src/lib/types';

test('renderer rejects overlapping decoder excess before invoking a configured encoder', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bol-render-budget-'));
  const input = join(directory, 'source.bin'), output = join(directory, 'export.mp4');
  const previous = process.env.FFMPEG_PATH;
  try {
    execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=red:s=32x16:r=24:d=0.25','-f','mp4',input]);
    process.env.FFMPEG_PATH = '/nonexistent-budget-check-encoder';
    const project = { duration: .25, width: 32, height: 16, mediaType: 'video', settings: defaults, words: [],
      canvasElements: Array.from({ length: 9 }, (_, i) => ({ id: String(i), assetId: 'primary', type: 'video', name: 'Video', x: 50, y: 50, scale: 1 })),
    } as unknown as Project;
    await assert.rejects(renderCaptionVideo({ project, input, output, mode: 'burned', resolution: 720, fps: 24 }), /10 simultaneous video decoders/);
    await assert.rejects(access(output));
  } finally {
    if (previous === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test('actual FFmpeg tall video stream fits both decoded dimensions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bol-tall-budget-'));
  const input = join(directory, 'clip.mp4');
  let decoder: Awaited<ReturnType<typeof openVideoFrames>> | undefined;
  try {
    execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=red:s=32x128:r=24:d=0.25',input]);
    decoder = await openVideoFrames(input, 24, 32, false, 16);
    assert.equal(decoder.canvas.width, 4); assert.equal(decoder.canvas.height, 16);
    const frame = await decoder.at(0);
    assert.ok(frame.getContext('2d').getImageData(1,1,1,1).data[0] > 200);
  } finally { await decoder?.close(); await rm(directory, { recursive: true, force: true }); }
});


test('image admission counts native decoded dimensions of every preloaded placement', () => {
  assert.throws(() => validateRenderResources(1920, 1080, [], undefined, [{ width: 8192, height: 8192 }]), /RGBA frame pixels/);
  assert.throws(() => validateRenderResources(1920, 1080, [], undefined, Array.from({ length: 65 }, () => ({ width: 16, height: 16 }))), /65 visual assets.*Remove unused/);
  assert.equal(validateRenderResources(1920, 1080, [], undefined, [{ width: 1024, height: 1024 }]).maxPixels, 3122176);
});

import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

test('renderer CLI emits a fixed safe resource code before encoder startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bol-cli-budget-'));
  const input = join(directory, 'source.bin'), output = join(directory, 'export.mp4'), snapshot = join(directory, 'project.json');
  try {
    execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=red:s=32x16:r=24:d=0.25','-f','mp4',input]);
    await writeFile(snapshot, JSON.stringify({ duration: .25, width: 32, height: 16, mediaType: 'video', settings: defaults, words: [],
      canvasElements: Array.from({ length: 9 }, (_, i) => ({ id: String(i), assetId: 'primary', type: 'video', name: 'Private caption name', x: 50, y: 50, scale: 1 })),
    }));
    try {
      await promisify(execFile)(process.execPath, ['--import','tsx','server/render.ts',snapshot,input,output,'burned','720','24'], { env: { ...process.env, FFMPEG_PATH: '/missing-encoder-must-not-run' } });
      assert.fail('CLI must reject the scene');
    } catch (error) {
      const result = error as Error & { stdout: string; code: number; stderr: string };
      assert.equal(result.code, 1);
      assert.deepEqual(JSON.parse(result.stdout.trim()), { errorCode: 'render_resource_limit' });
      assert.ok(!result.stdout.includes('Private caption'));
      assert.match(result.stderr, /10 simultaneous video decoders/);
    }
    await assert.rejects(access(output));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
