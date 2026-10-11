import test from 'node:test';
import assert from 'node:assert/strict';
import { saveWithRevision } from '../src/lib/revision-save.ts';
import { defaults, type Project } from '../src/lib/types.ts';
const base = { id: 'project', revision: 1, name: 'Original', words: [], settings: defaults, status: 'ready', mediaType: 'video' } as unknown as Project;
const conflict = new Error('conflict');
test('save uses revision and preserves edits across export progress updates', async () => {
  const bodies: any[] = [];
  const local = { ...base, name: 'My edit' };
  const result = await saveWithRevision(local, base, async body => {
    bodies.push(body); if (bodies.length === 1) throw conflict;
    return { ...local, revision: 3 };
  }, async () => ({ ...base, revision: 2 }), e => e === conflict);
  assert.equal(bodies[0].revision, 1);
  assert.equal(bodies[1].revision, 2);
  assert.equal(bodies[1].name, 'My edit');
  assert.equal(result.revision, 3);
});
test('another tab edit stays saved and local edits are not overwritten', async () => {
  const local = { ...base, name: 'Local edit' }; let attempts = 0;
  await assert.rejects(saveWithRevision(local, base, async () => { attempts++; throw conflict; },
    async () => ({ ...base, name: 'Other tab edit', revision: 2 }), e => e === conflict), /conflict/);
  assert.equal(attempts, 1); assert.equal(local.name, 'Local edit');
});
test('a conflict on the retry stops without an unbounded save loop', async () => {
  let attempts = 0;
  await assert.rejects(saveWithRevision(base, base, async () => { attempts++; throw conflict; },
    async () => ({ ...base, revision: 2 }), e => e === conflict));
  assert.equal(attempts, 2);
});
