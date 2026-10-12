import test from 'node:test';
import assert from 'node:assert/strict';
import { captionWordsPerPage, treatmentFor } from '../src/remotion/treatments';
import { buildPages } from '../src/lib/pages';
import type { Word } from '../src/lib/types';

test('MOGRT emphasized stacks keep timed words together while word titles split them', () => {
  const words: Word[] = ['ab', 'hero', 'aaya'].map((text, index) => ({
    id: String(index), text, original: text, start: index * .3, end: (index + 1) * .3,
    confidence: 1, emphasis: false, emphasisScore: index === 1 ? .9 : .1,
  }));
  for (const id of ['mogrt-rise', 'mogrt-pop', 'mogrt-drop', 'mogrt-spread', 'mogrt-swing', 'mogrt-wipe', 'mogrt-flip', 'mogrt-slide']) {
    const pages = buildPages(words, captionWordsPerPage(id, 5), { alwaysPromote: true, autoHighlight: true });
    assert.equal(pages.length, 1, `${id} must keep prefix, hero and suffix in one caption group`);
    assert.equal(pages[0].words.map(word => word.text).join(' '), 'ab hero aaya');
    assert.equal(treatmentFor(id).groupText, false);
  }
  assert.equal(buildPages(words, captionWordsPerPage('kinetic', 5)).length, 3);
});

test('MOGRT uses the emphasized layout and web styles offer contrasting layouts', () => {
  assert.equal(treatmentFor('mogrt-triple').threeTier, false);
  assert.equal(treatmentFor('mogrt-triple').layout, 'stack');
  assert.equal(treatmentFor('editorial').layout, 'stack');
  assert.equal(treatmentFor('neon').layout, 'single');
  assert.equal(treatmentFor('karaoke').layout, 'rows');
});
