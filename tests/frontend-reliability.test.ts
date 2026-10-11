import assert from 'node:assert/strict';
import test from 'node:test';
import { canvasKeyboardChange, editSnapshot, isBrowserZoomKey, playbackFrame } from '../src/lib/frontend-reliability';
import { defaults, type Project } from '../src/lib/types';

test('a drag history snapshot restores original timing and all editable scene fields', () => {
  const before = { id: 'test', name: 'Scene', settings: defaults, videoEnabled: false,
    canvasElements: [], activeMediaAssetId: 'primary',
    words: [{ id: 'w', text: 'Hello', start: .123, end: .789, confidence: .91, original: 'Hello', emphasis: false, emphasisScore: 0 }],
  } as unknown as Project;
  const original = editSnapshot(before);
  const intermediate = { ...before, words: before.words.map(w => ({ ...w, start: .2, end: .866 })) };
  const final = { ...intermediate, words: intermediate.words.map(w => ({ ...w, start: .3, end: .966 })) };
  const restored = { ...final, ...original };
  assert.deepEqual(restored.words, before.words);
  assert.equal(restored.words[0].start, .123);
  assert.equal(restored.words[0].end, .789);
  assert.equal(restored.activeMediaAssetId, 'primary');
  assert.equal(restored.videoEnabled, false);
});

test('120Hz playback schedules at most the 30fps caption rate without rounding into future frames', () => {
  const samples = Array.from({ length: 120 }, (_, i) => playbackFrame(i / 120, 30));
  assert.equal(new Set(samples).size, 30);
  assert.equal(playbackFrame(.032, 30), 0);
  assert.equal(playbackFrame(.034, 30), 1);
});

import { timelineGroupIndices } from '../src/lib/frontend-reliability';

test('keyboard canvas adjustments respect saved geometry bounds and locks', () => {
  const layer = { x: 99, y: 0, scale: 3.5, rotation: -360, locked: false } as import('../src/lib/types').CanvasVisualElement;
  assert.deepEqual(canvasKeyboardChange(layer, 'ArrowRight', true), { x: 100 });
  assert.deepEqual(canvasKeyboardChange(layer, 'ArrowUp'), { y: 0 });
  assert.deepEqual(canvasKeyboardChange(layer, '+'), { scale: 3.5 });
  assert.deepEqual(canvasKeyboardChange({ ...layer, scale: .15 }, '-'), { scale: .15 });
  assert.deepEqual(canvasKeyboardChange(layer, '['), { rotation: -360 });
  assert.deepEqual(canvasKeyboardChange({ ...layer, locked: true }, 'ArrowLeft'), null);
});

test('browser magnification shortcuts pass through while plain timeline zoom keys remain available', () => {
  for (const key of ['+', '=', '-', '0']) {
    assert.equal(isBrowserZoomKey({ ctrlKey: true, metaKey: false, key, code: '' }), true);
    assert.equal(isBrowserZoomKey({ ctrlKey: false, metaKey: true, key, code: '' }), true);
    assert.equal(isBrowserZoomKey({ ctrlKey: false, metaKey: false, key, code: '' }), false);
  }
  for (const code of ['NumpadAdd', 'NumpadSubtract', 'Numpad0'])
    assert.equal(isBrowserZoomKey({ ctrlKey: true, metaKey: false, key: 'Unidentified', code }), true);
  assert.equal(isBrowserZoomKey({ ctrlKey: true, metaKey: false, key: 'z', code: 'KeyZ' }), false);
});

test('long transcript overview and zoomed windows keep timeline rendering bounded and retain active caption', () => {
  const groups = Array.from({ length: 10000 }, (_, i) => [{ id: String(i), start: i, end: i + .8 }] as Project['words']);
  const overview = timelineGroupIndices(groups, 0, 10000, 4321.2);
  assert.ok(overview.length <= 200);
  assert.ok(overview.includes(4321));
  assert.equal(overview[0], 0);
  assert.equal(overview.at(-1), 9999);
  const zoomed = timelineGroupIndices(groups, 4320, 4330, 4321.2);
  assert.deepEqual(zoomed, Array.from({ length: 11 }, (_, i) => 4320 + i));
  const started = performance.now();
  for (let i = 0; i < 300; i++) timelineGroupIndices(groups, 0, 10000, i + .2);
  const elapsedMs = performance.now() - started;
  console.log(`10,000 caption groups, 300 visibility updates: ${elapsedMs.toFixed(1)}ms; maximum DOM group count 200`);
  assert.ok(elapsedMs < 2000, 'visibility computation should stay comfortably below a frame budget');
});

import { activeCaptionIndex, captionTimeIndex } from '../src/lib/frontend-reliability';

test('indexed playback preserves first-group precedence, gaps, empty groups and exclusive ends', () => {
  const groups = [[], [{ start: 3, end: 8 }], [{ start: 1, end: 4 }], [{ start: 8, end: 9 }]] as Project['words'][];
  const index = captionTimeIndex(groups);
  for (const time of [-1, 0, 1, 2, 3, 3.99, 4, 7.99, 8, 9, 20]) {
    const expected = groups.findIndex(g => g.length > 0 && g[0].start <= time && time < g.at(-1)!.end);
    assert.equal(activeCaptionIndex(index, time), expected, `time ${time}`);
  }
  assert.equal(activeCaptionIndex(index, NaN), -1);
  assert.equal(activeCaptionIndex(captionTimeIndex(groups, .08), 9.04), 3);
});

test('indexed lookup agrees with linear lookup for shuffled and nested intervals', () => {
  const groups = Array.from({ length: 200 }, (_, i) => [{ start: (i * 37) % 101, end: (i * 37) % 101 + (i % 11) + .5 }]) as Project['words'][];
  const index = captionTimeIndex(groups, .08);
  for (let time = 0; time < 115; time += .125)
    assert.equal(activeCaptionIndex(index, time), groups.findIndex(g => g[0].start <= time && time < g[0].end + .08));
});

import { timelineGroupWindow, timelineWindowIndices, timeIntervalIndex } from '../src/lib/frontend-reliability';

test('memoized timeline membership preserves legacy dense sampling and last overlapping group at exact ends', () => {
  const groups = Array.from({ length: 10000 }, (_, i) => [{ start: i, end: i + 1 }]) as Project['words'][];
  const window = timelineGroupWindow(groups, 0, 10000);
  const index = captionTimeIndex(groups);
  for (const time of [0, 1, 4321.2, 9999, 10000, 10001]) {
    let active = -1;
    for (let i = 0; i < groups.length; i++) if (groups[i][0].start <= time && time <= groups[i][0].end) active = i;
    assert.equal(activeCaptionIndex(index, time, { inclusiveEnd: true, preferLast: true }), active);
    const actual = timelineWindowIndices(window, active);
    assert.ok(actual.length <= 200);
    if (active >= 0) assert.ok(actual.includes(active));
    assert.equal(actual[0], 0);
    assert.equal(actual.at(-1), 9999);
  }
  assert.equal(timelineWindowIndices(window, -1), window.sampled, 'gap playback reuses cached nodes');
  const outside = timelineGroupWindow(groups, 100, 110);
  assert.equal(timelineWindowIndices(outside, 500), outside.sampled);
});

test('page lookup uses display boundaries independently of word timing', () => {
  const pages = [{start: 0, end: 1.4}, {start: 1.5, end: 3}];
  const index = timeIntervalIndex(pages.map((page, index) => ({ ...page, index })));
  assert.equal(activeCaptionIndex(index, 1.3), 0);
  assert.equal(activeCaptionIndex(index, 1.4), -1);
  assert.equal(activeCaptionIndex(index, 1.5), 1);
  assert.equal(activeCaptionIndex(index, 3), -1);
});
