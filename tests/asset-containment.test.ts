import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCanvasAssetPath } from '../server/render.ts';
import type { Project } from '../src/lib/types.ts';

test('canvas images use the manifest and stay inside the project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bol-assets-'));
  const id = '11111111-1111-4111-8111-111111111111';
  const project = { mediaAssets: [{ id, mediaType: 'image', filename: 'renamed.png', sourceFile: `assets/${id}.png` }] } as unknown as Project;
  try {
    await mkdir(join(root, 'assets'));
    const image = join(root, 'assets', `${id}.png`);
    await writeFile(image, 'image');
    assert.equal(await resolveCanvasAssetPath(project, root, id), await realpath(image));
    assert.equal(await resolveCanvasAssetPath(project, root, '../../secret'), null);
    assert.equal(await resolveCanvasAssetPath(project, root, '22222222-2222-4222-8222-222222222222'), null);
    await rm(image);
    await writeFile(join(root, 'secret.png'), 'secret');
    await symlink(join(root, 'secret.png'), image);
    assert.equal(await resolveCanvasAssetPath(project, root, id), null);
    await rm(join(root, 'assets'), { recursive: true });
    await mkdir(join(root, 'elsewhere'));
    await writeFile(join(root, 'elsewhere', `${id}.png`), 'image');
    await symlink(join(root, 'elsewhere'), join(root, 'assets'));
    assert.equal(await resolveCanvasAssetPath(project, root, id), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
