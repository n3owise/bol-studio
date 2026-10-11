import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { orderedElements } from '../src/lib/media-scene.ts';
import { openVideoFrames } from '../server/render.ts';
import type { CanvasVisualElement } from '../src/lib/types.ts';

test('scene layers use stable saved z order without mutating the project', () => {
  const elements = [{ id: 'top', zIndex: 5 }, { id: 'a' }, { id: 'b', zIndex: 0 }] as CanvasVisualElement[];
  assert.deepEqual(orderedElements(elements).map(e => e.id), ['a', 'b', 'top']);
  assert.equal(elements[0].id, 'top');
});

test('video frames advance at timeline fps, loop overlays, and hold the final primary frame', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bol-scene-'));
  const path = join(root, 'clip.mp4');
  let loop: Awaited<ReturnType<typeof openVideoFrames>> | undefined;
  let primary: Awaited<ReturnType<typeof openVideoFrames>> | undefined;
  try {
    execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=red:s=32x16:r=24:d=0.5',
      '-f','lavfi','-i','color=blue:s=32x16:r=24:d=0.5','-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0', '-pix_fmt','yuv420p',path]);
    loop = await openVideoFrames(path, 24, 32);
    const sample = async (frame: number) => Array.from((await loop!.at(frame)).getContext('2d').getImageData(8,8,1,1).data);
    assert.ok((await sample(0))[0] > 200);
    assert.ok((await sample(18))[2] > 200);
    assert.ok((await sample(26))[0] > 200);
    primary = await openVideoFrames(path,24,32,false);
    assert.ok((await primary.at(40)).getContext('2d').getImageData(8,8,1,1).data[2] > 200);
  } finally { loop?.close(); primary?.close(); await rm(root,{recursive:true,force:true}); }
});
