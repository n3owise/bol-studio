import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import {
  appendWord, autoDetectHighlights, dimensions, ensureValidIntervals, getContrastColor,
  groupWords, insertWord, mergeLines, moveWordToLine, moveWordsToLine, moveWordToNextLine, moveWordToPreviousLine,
  replaceAllOccurrences, splitLineAtWord, subtitleText, templates
} from '../src/lib/captions.ts';
import { MAX_WORDS_PER_PAGE, buildPages, heroRun } from '../src/lib/pages.ts';
import { treatmentFor, treatments } from '../src/remotion/treatments.ts';
import { defaults, type CanvasTextElement, type Word } from '../src/lib/types.ts';
import { ffmpegArguments, registerRenderFonts, renderCaptionVideo, validateRenderProject } from '../server/render.ts';
import {
  createDefaultTextElement,
  drawTextElements,
  getAnimationTransform,
  transformTextCase,
  TEXT_PRESETS,
  TEXT_TEMPLATES,
} from '../src/lib/text.ts';

const word = (text: string, start: number, end: number, emphasis = false): Word => ({
  id: `${text}-${start}`, text, original: text, start, end, confidence: .95, emphasis, emphasisScore: emphasis ? .9 : .2,
});
const project = (words: Word[] = []) => validateRenderProject({
  duration: 2, width: 1280, height: 720, mediaType: 'video', settings: { ...defaults }, words,
});

test('caption groups respect word limits, pauses and sentence endings', () => {
  const words = [word('Aaj', 0, .2), word('hum', .2, .4), word('seekhenge.', .4, .6),
    word('Ready', .6, .8), word('ho?', .8, 1), word('Chalo', 1, 1.2), word('start', 1.7, 2)];
  assert.deepEqual(groupWords(words, 2).map(g => g.map(w => w.text)),
    [['Aaj', 'hum'], ['seekhenge.'], ['Ready', 'ho?'], ['Chalo'], ['start']]);
  assert.deepEqual(groupWords([], 4), []);
  assert.deepEqual(groupWords([word('नमस्ते।', 0, .5), word('दोस्तों', .5, 1)], 4).map(g => g.length), [1, 1]);
});

test('export dimensions preserve aspect ratio and use even encoder dimensions', () => {
  assert.deepEqual(dimensions(defaults, 1920, 1080, 720), { width: 1280, height: 720 });
  assert.deepEqual(dimensions({ ...defaults, aspect: '9:16' }, 1920, 1080, 1080), { width: 1080, height: 1920 });
  assert.deepEqual(dimensions({ ...defaults, aspect: '1:1' }, 1920, 1080, 720), { width: 720, height: 720 });
  assert.deepEqual(dimensions({ ...defaults, aspect: '16:9' }, 720, 1280, 720), { width: 1280, height: 720 });
  const unusual = dimensions(defaults, 1001, 700, 720);
  assert.equal(unusual.width % 2, 0);
  assert.ok(Math.abs(unusual.width / unusual.height - 1001 / 700) < .002);
});

test('SRT and VTT timestamps carry milliseconds across minute and hour boundaries', () => {
  const words = [word('Hello', 59.9996, 60.4567), word('दुनिया', 3599.9996, 3600.2)];
  assert.equal(subtitleText(words, 4, 'srt'),
    '1\n00:01:00,000 --> 00:01:00,457\nHello\n\n2\n01:00:00,000 --> 01:00:00,200\nदुनिया\n');
  assert.equal(subtitleText([words[0]], 4, 'vtt'), 'WEBVTT\n\n00:01:00.000 --> 00:01:00.457\nHello\n');
});

test('viral spotlight and viral kinetic templates are removed', () => {
  assert.ok(!templates.some(t => t.id === 'spotlight' || t.id === 'punch'));
});

test('groupWords splits groups on speech pauses >= 0.22s while keeping tight words together', () => {
  const words = [
    word('Word1', 0.0, 0.3),
    word('Word2', 0.4, 0.7), // gap = 0.10s (tight)
    word('Word3', 0.95, 1.2), // gap = 0.25s (pause >= 0.22s -> should split)
    word('Word4', 1.25, 1.5), // gap = 0.05s (tight)
  ];
  const groups = groupWords(words, 4);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].map(w => w.text), ['Word1', 'Word2']);
  assert.deepEqual(groups[1].map(w => w.text), ['Word3', 'Word4']);
});

test('invalid export snapshots fail before allocating a video canvas', () => {
  assert.throws(() => validateRenderProject({ ...project(), duration: Infinity }), /duration/);
  assert.throws(() => validateRenderProject({ ...project(), width: 16000, height: 100 }), /aspect/);
  assert.throws(() => validateRenderProject({ ...project(), words: [word('late', 1, 1.5), word('early', .1, .5)] }), /ordered/);
  assert.throws(() => validateRenderProject({ ...project(), settings: { ...defaults, wordsPerLine: 0 } }), /settings/);
});

test('green exports are silent and finite; burned video retains optional audio and contains the source', () => {
  const green = ffmpegArguments(project(), '/tmp/source.mp4', '/tmp/green.mp4', 'green', 720);
  assert.ok(green.includes('-an'));
  // 2s of media at the 60fps caption rate.
  assert.equal(green[green.indexOf('-frames:v') + 1], '120');
  assert.equal(green[green.indexOf('-pix_fmt') + 1], 'yuv420p');
  assert.equal(green.filter(arg => arg === '-i').length, 1);
  const burned = ffmpegArguments(project(), '/tmp/source.mp4', '/tmp/burned.mp4', 'burned', 720);
  assert.ok(burned.includes('1:a:0?'));
  assert.ok(burned[burned.indexOf('-filter_complex') + 1].includes('force_original_aspect_ratio=decrease'));
  const audio = ffmpegArguments({ ...project(), mediaType: 'audio' }, '/tmp/source.wav', '/tmp/audio.mp4', 'burned', 720);
  assert.ok(audio.includes('1:a:0?'));
  assert.ok(!audio.includes('-filter_complex'));
});

test('removing a video layer keeps audio and renders captions over black', () => {
  const disabled = { ...project(), videoEnabled: false };
  assert.doesNotThrow(() => validateRenderProject(disabled));
  const args = ffmpegArguments(disabled, '/tmp/source.mp4', '/tmp/audio-captioned.mp4', 'burned', 720);
  assert.ok(!args.includes('-filter_complex'), 'A removed video layer should skip the source-video filter.');
  assert.equal(args[args.indexOf('-map') + 1], '0:v:0');
  assert.ok(args.includes('1:a:0?'), 'The source audio stream should remain in the captioned export.');
  assert.throws(() => validateRenderProject({ ...disabled, videoEnabled: 'false' }), /boolean/);
});

test('getContrastColor chooses dark text on bright backgrounds and white on dark backgrounds', () => {
  // Light / bright accents (including default karaoke purple #c2a1ff, lime #d4fa41, yellow, white)
  assert.equal(getContrastColor('#c2a1ff'), '#111318');
  assert.equal(getContrastColor('#d4fa41'), '#111318');
  assert.equal(getContrastColor('#ffffff'), '#111318');
  assert.equal(getContrastColor('#fff'), '#111318');
  assert.equal(getContrastColor('#fef08a'), '#111318');
  assert.equal(getContrastColor('#38bdf8'), '#111318');

  // Dark backgrounds
  assert.equal(getContrastColor('#000000'), '#ffffff');
  assert.equal(getContrastColor('#000'), '#ffffff');
  assert.equal(getContrastColor('#111318'), '#ffffff');
  assert.equal(getContrastColor('#1e1b4b'), '#ffffff');
  assert.equal(getContrastColor('#14532d'), '#ffffff');
});

test('insertWord and appendWord create valid, non-overlapping intervals satisfying project validation', () => {
  const initial = [word('first', 0.0, 0.4), word('second', 0.6, 1.0)];
  
  // Insert word between "first" and "second"
  const afterRes = insertWord(initial, initial[0].id, 'after', 'middle', 2.0);
  assert.equal(afterRes.words.length, 3);
  assert.equal(afterRes.words[1].text, 'middle');
  assert.doesNotThrow(() => validateRenderProject(project(afterRes.words)));

  // Insert word before "first"
  const beforeRes = insertWord(afterRes.words, afterRes.words[0].id, 'before', 'intro', 2.0);
  assert.equal(beforeRes.words.length, 4);
  assert.equal(beforeRes.words[0].text, 'intro');
  assert.doesNotThrow(() => validateRenderProject(project(beforeRes.words)));

  // Append word at the end
  const appendRes = appendWord(beforeRes.words, 'outro', 2.0);
  assert.equal(appendRes.words.length, 5);
  assert.equal(appendRes.words.at(-1)!.text, 'outro');
  assert.doesNotThrow(() => validateRenderProject(project(appendRes.words)));
});

test('splitLineAtWord and mergeLines control caption group chunking', () => {
  const words = [word('Hello', 0, 0.3), word('world', 0.35, 0.6), word('next', 0.65, 0.9)];
  
  // Initially grouped together when max is 4
  const g1 = groupWords(words, 4);
  assert.equal(g1.length, 1);

  // Split after 'world'
  const splitWords = splitLineAtWord(words, words[1].id);
  assert.ok(/[.!?।]$/.test(splitWords[1].text));
  const g2 = groupWords(splitWords, 4);
  assert.equal(g2.length, 2);
  assert.deepEqual(g2[0].map(w => w.text), ['Hello', 'world.']);
  assert.deepEqual(g2[1].map(w => w.text), ['next']);

  // Merge back
  const mergedWords = mergeLines(splitWords, splitWords[1].id);
  assert.ok(!/[.!?।]$/.test(mergedWords[1].text));
  const g3 = groupWords(mergedWords, 4);
  assert.equal(g3.length, 1);
});

test('moveWordToNextLine shifts boundary so word starts the next line', () => {
  const words = [word('Hello', 0, 0.3), word('beautiful', 0.35, 0.6), word('world', 0.65, 0.9)];
  
  // Initially single line
  assert.equal(groupWords(words, 4).length, 1);

  // Move "world" to next line -> "beautiful" gets trailing punctuation
  const nextRes = moveWordToNextLine(words, words[2].id);
  const groups = groupWords(nextRes, 4);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].map(w => w.text), ['Hello', 'beautiful.']);
  assert.deepEqual(groups[1].map(w => w.text), ['world']);
});

test('moveWordToPreviousLine shifts boundary so word joins previous line', () => {
  const words = [word('Hello.', 0, 0.3), word('world', 0.35, 0.6), word('again', 0.65, 0.9)];
  
  // Initially two lines: ['Hello.'] and ['world', 'again']
  const initialGroups = groupWords(words, 4);
  assert.equal(initialGroups.length, 2);

  // Move "world" to previous line -> "Hello" loses punctuation, "world" gains punctuation
  const prevRes = moveWordToPreviousLine(words, words[1].id, 4);
  const groups = groupWords(prevRes, 4);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].map(w => w.text), ['Hello', 'world.']);
  assert.deepEqual(groups[1].map(w => w.text), ['again']);
});

test('moveWordToLine drags and drops words onto any line changing caption groups accordingly', () => {
  // Scenario matching user:
  // Line 0: ['lag', 'jaate.']
  // Line 1: ['the.']
  // Line 2: ['Let', 'me', 'show', 'you.']
  const words = [
    word('lag', 10.0, 10.3),
    word('jaate.', 10.35, 10.6),
    word('the.', 10.65, 10.9),
    word('Let', 11.0, 11.2),
    word('me', 11.25, 11.4),
    word('show', 11.45, 11.6),
    word('you.', 11.65, 11.9),
  ];

  const initialGroups = groupWords(words, 5);
  assert.equal(initialGroups.length, 3);
  assert.deepEqual(initialGroups[0].map(w => w.text), ['lag', 'jaate.']);
  assert.deepEqual(initialGroups[1].map(w => w.text), ['the.']);

  // Drag 'the.' onto Line 0 at the end
  const res1 = moveWordToLine(words, words[2].id, 0, 'end', 5);
  const groups1 = groupWords(res1, 5);
  assert.equal(groups1.length, 2);
  assert.deepEqual(groups1[0].map(w => w.text), ['lag', 'jaate', 'the.']);
  assert.deepEqual(groups1[1].map(w => w.text), ['Let', 'me', 'show', 'you.']);

  // Drag 'you.' from Line 1 to Line 0 at start
  const res2 = moveWordToLine(res1, res1.find(w => w.text.startsWith('you'))!.id, 0, 'start', 5);
  const groups2 = groupWords(res2, 5);
  assert.deepEqual(groups2[0].map(w => w.text), ['you', 'lag', 'jaate', 'the.']);

  // Drag 'show' from Line 1 to between 'lag' and 'jaate' in Line 0
  const showWord = res2.find(w => w.text.startsWith('show'))!;
  const jaateWord = res2.find(w => w.text.startsWith('jaate'))!;
  const res3 = moveWordToLine(res2, showWord.id, 0, { targetWordId: jaateWord.id, insert: 'before' }, 6);
  const groups3 = groupWords(res3, 6);
  assert.deepEqual(groups3[0].map(w => w.text), ['you', 'lag', 'show', 'jaate', 'the.']);

  // Verify that words in later lines (e.g. Line 1 'Let', 'me') preserve their audio alignment
  const letWord = res3.find(w => w.text.startsWith('Let'))!;
  const meWord = res3.find(w => w.text.startsWith('me'))!;
  assert.equal(letWord.start, 11.0);
  assert.equal(letWord.end, 11.2);
  assert.equal(meWord.start, 11.25);
  assert.equal(meWord.end, 11.4);
});

test('moveWordToLine cleans internal sentence punctuation so line does not split prematurely', () => {
  const words = [
    word('First', 1.0, 1.3),
    word('Line.', 1.35, 1.6),
    word('Second', 2.0, 2.3),
    word('Line.', 2.35, 2.6),
  ];
  // Drag 'Second' into Line 0 between 'First' and 'Line.'
  const res = moveWordToLine(words, words[2].id, 0, { targetWordId: words[0].id, insert: 'after' }, 5);
  const groups = groupWords(res, 5);
  assert.deepEqual(groups[0].map(w => w.text), ['First', 'Second', 'Line.']);
});

test('replaceAllOccurrences replaces text while preserving trailing punctuation and timing', () => {
  const words = [
    word('Hello,', 0, 0.3),
    word('world!', 0.35, 0.6),
    word('Hello', 0.65, 0.9),
  ];

  const replaced = replaceAllOccurrences(words, 'Hello', 'Namaste');
  assert.equal(replaced[0].text, 'Namaste,');
  assert.equal(replaced[0].start, 0);
  assert.equal(replaced[1].text, 'world!');
  assert.equal(replaced[2].text, 'Namaste');
  assert.equal(replaced[2].end, 0.9);
});

test('moveWordsToLine moves multiple selected words preserving order and valid intervals', () => {
  const words: Word[] = [
    { id: 'w1', text: 'Ek', original: 'Ek', start: 0.1, end: 0.4, confidence: 1, emphasis: false, emphasisScore: 0.5 },
    { id: 'w2', text: 'do', original: 'do', start: 0.4, end: 0.7, confidence: 1, emphasis: false, emphasisScore: 0.5 },
    { id: 'w3', text: 'teen.', original: 'teen.', start: 0.7, end: 1.0, confidence: 1, emphasis: false, emphasisScore: 0.5 },
    { id: 'w4', text: 'Chaar', original: 'Chaar', start: 1.2, end: 1.5, confidence: 1, emphasis: false, emphasisScore: 0.5 },
    { id: 'w5', text: 'paanch.', original: 'paanch.', start: 1.5, end: 1.8, confidence: 1, emphasis: false, emphasisScore: 0.5 },
  ];

  // Move ['w1', 'w2'] ("Ek", "do") to the end of line 2 (targetGroupIdx = 1)
  const moved = moveWordsToLine(words, ['w1', 'w2'], 1, 'end', 6);

  // Grouping should show: line 1 has "teen.", line 2 has "Chaar paanch Ek do"
  const groups = groupWords(moved, 6);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].map(w => w.text), ['teen.']);
  assert.deepEqual(groups[1].map(w => w.text), ['Chaar', 'paanch', 'Ek', 'do']);

  // Timestamps must be strictly non-overlapping
  for (let i = 0; i < moved.length - 1; i++) {
    assert.ok(moved[i].start < moved[i].end, `Word ${moved[i].id} start < end`);
    assert.ok(moved[i].end <= moved[i + 1].start, `Word ${moved[i].id} end <= next start`);
  }
});

test('moveWordToLine drops word in-between with insert: after and allows within-line reordering', () => {
  const words: Word[] = [
    { id: 'w1', text: 'Yeh', original: 'Yeh', start: 0.0, end: 0.3, confidence: 1, emphasis: false, emphasisScore: 0.5 },
    { id: 'w2', text: 'toh', original: 'toh', start: 0.35, end: 0.6, confidence: 1, emphasis: false, emphasisScore: 0.5 },
    { id: 'w3', text: 'kamaal', original: 'kamaal', start: 0.65, end: 0.9, confidence: 1, emphasis: false, emphasisScore: 0.5 },
    { id: 'w4', text: 'hai.', original: 'hai.', start: 0.95, end: 1.2, confidence: 1, emphasis: false, emphasisScore: 0.5 },
  ];

  // Move 'kamaal' (w3) to be after 'Yeh' (w1) in line 0
  const moved = moveWordToLine(words, 'w3', 0, { targetWordId: 'w1', insert: 'after' }, 5);
  const groups = groupWords(moved, 5);
  assert.deepEqual(groups[0].map(w => w.text), ['Yeh', 'kamaal', 'toh', 'hai.']);

  // Timestamps must be valid and non-overlapping
  for (let i = 0; i < moved.length - 1; i++) {
    assert.ok(moved[i].start < moved[i].end, `Word ${moved[i].id} start < end`);
    assert.ok(moved[i].end <= moved[i + 1].start, `Word ${moved[i].id} end <= next start`);
  }
});

test('moveWordToLine moving a middle word does not split the source line', () => {
  const words = [
    word('Yeh', 0.0, 0.3),
    word('toh', 0.35, 0.6),
    word('kamaal', 0.65, 0.9),
    word('hai.', 0.95, 1.2),
    word('Samjhe', 1.5, 1.8),
    word('aap.', 1.85, 2.1),
  ];

  const gInit = groupWords(words, 5);
  assert.equal(gInit.length, 2);
  assert.deepEqual(gInit[0].map(w => w.text), ['Yeh', 'toh', 'kamaal', 'hai.']);
  assert.deepEqual(gInit[1].map(w => w.text), ['Samjhe', 'aap.']);

  // Move 'toh' (words[1]) to line 1 start
  const moved = moveWordToLine(words, words[1].id, 1, 'start', 5);
  const gAfter = groupWords(moved, 5);
  assert.equal(gAfter.length, 2, 'Should remain 2 lines, not split source line into two');
  assert.deepEqual(gAfter[0].map(w => w.text), ['Yeh', 'kamaal', 'hai.']);
  assert.deepEqual(gAfter[1].map(w => w.text), ['toh', 'Samjhe', 'aap.']);
});

test('moveWordsToLine supports inserting before or after any word across lines with valid timeline sync', () => {
  const words = [
    word('One', 0.0, 0.3),
    word('Two', 0.35, 0.6),
    word('Three.', 0.65, 0.9),
    word('Alpha', 1.5, 1.8),
    word('Beta.', 1.85, 2.1),
  ];

  // Move 'Two' to line 1 before 'Beta.'
  const moved = moveWordsToLine(words, [words[1].id], 1, { targetWordId: words[4].id, insert: 'before' }, 5);
  const groups = groupWords(moved, 5);
  assert.deepEqual(groups[0].map(w => w.text), ['One', 'Three.']);
  assert.deepEqual(groups[1].map(w => w.text), ['Alpha', 'Two', 'Beta.']);

  // Verify non-overlapping intervals
  for (let i = 0; i < moved.length - 1; i++) {
    assert.ok(moved[i].start < moved[i].end, `Word ${moved[i].text} start < end`);
    assert.ok(moved[i].end <= moved[i + 1].start, `Word ${moved[i].text} end <= next start`);
  }
});

test('autoDetectHighlights assigns spotlight to hero keyword and aligns with timeline', () => {
  const words: Word[] = [
    { id: 'w1', text: 'Yeh', original: 'Yeh', start: 0.0, end: 0.3, confidence: 1, emphasis: false, emphasisScore: 0.4 },
    { id: 'w2', text: 'Step', original: 'Step', start: 0.3, end: 0.6, confidence: 1, emphasis: false, emphasisScore: 0.6 },
    { id: 'w3', text: '1', original: '1', start: 0.6, end: 0.9, confidence: 1, emphasis: false, emphasisScore: 0.5 },
    { id: 'w4', text: 'hai.', original: 'hai.', start: 0.9, end: 1.2, confidence: 1, emphasis: false, emphasisScore: 0.3 },
  ];

  const highlighted = autoDetectHighlights(words, 4);
  assert.equal(highlighted.length, 4);

  // Hook word "Step" should be detected as hero spotlight keyword
  const stepWord = highlighted.find(w => w.text === 'Step');
  assert.ok(stepWord, 'Step word exists');
  assert.equal(stepWord.spotlight, true, 'Hero hook keyword Step is marked with spotlight');
  assert.equal(stepWord.emphasis, false, 'Hero keyword spotlight does not collide with emphasis');

  // Secondary hook "1" should be marked as emphasis
  const oneWord = highlighted.find(w => w.text === '1');
  assert.ok(oneWord, '1 word exists');
  assert.equal(oneWord.emphasis, true, 'Secondary keyword is marked with emphasis');
  assert.equal(oneWord.spotlight, false, 'Secondary keyword is not spotlight');

  // Stop particle "Yeh" is neither spotlight nor emphasized
  const yehWord = highlighted.find(w => w.text === 'Yeh');
  assert.ok(yehWord, 'Yeh word exists');
  assert.equal(yehWord.spotlight, false, 'Stop particle is not spotlight');
  assert.equal(yehWord.emphasis, false, 'Stop particle is not emphasized');

});

test('subtitleText exports clean and compliant SRT and VTT subtitles', () => {
  const words = [
    word('Namaste', 0.0, 0.8),
    word('everyone', 0.8, 1.4),
    word('today', 1.4, 1.9),
    word('we', 1.9, 2.2),
    word('talk', 2.2, 2.6),
    word('branding.', 2.6, 3.2),
  ];

  const srt = subtitleText(words, 3, 'srt');
  assert.ok(srt.includes('1\n00:00:00,000 --> 00:00:01,900\nNamaste everyone today'), 'First subtitle block valid');
  assert.ok(srt.includes('2\n00:00:01,900 --> 00:00:03,200\nwe talk branding.'), 'Second subtitle block valid');

  const vtt = subtitleText(words, 3, 'vtt');
  assert.ok(vtt.startsWith('WEBVTT\n\n'), 'WebVTT header exists');
  assert.ok(vtt.includes('00:00:00.000 --> 00:00:01.900\nNamaste everyone today'), 'VTT cue timing format with period');
});

test('createDefaultTextElement initializes all 5 core text types with valid defaults', () => {
  const types = ['heading', 'subheading', 'body', 'quote', 'label'] as const;
  for (const t of types) {
    const el = createDefaultTextElement(t, 2.0, 15.0);
    assert.equal(el.type, t);
    assert.ok(el.text.length > 0);
    assert.equal(el.x, 50);
    assert.equal(el.y, 50);
    assert.equal(el.start, 2.0);
    assert.ok(el.end > el.start);
    assert.ok(el.fontSize >= 20);
    assert.equal(el.visible, true);
    assert.equal(el.locked, false);
  }
});

test('transformTextCase formats text as uppercase, lowercase, title case, or normal', () => {
  const sample = 'hello WORLD';
  assert.equal(transformTextCase(sample, 'normal'), 'hello WORLD');
  assert.equal(transformTextCase(sample, 'uppercase'), 'HELLO WORLD');
  assert.equal(transformTextCase(sample, 'lowercase'), 'hello world');
  assert.equal(transformTextCase(sample, 'title'), 'Hello World');
});

test('getAnimationTransform calculates smooth alpha and scale for in/out animations', () => {
  const el: CanvasTextElement = {
    ...createDefaultTextElement('heading', 1.0, 10.0),
    start: 1.0,
    end: 5.0,
    animationIn: 'fade',
    animationOut: 'scale',
    animationDuration: 0.5,
  };

  // Middle of in-animation (time = 1.25s, progress = 0.5)
  const animIn = getAnimationTransform(el, 1.25);
  assert.ok(Math.abs(animIn.alpha - 0.5) < 0.05);

  // Middle of steady state (time = 3.0s)
  const animMid = getAnimationTransform(el, 3.0);
  assert.equal(animMid.alpha, 1.0);
  assert.equal(animMid.scale, 1.0);

  // Near end of out-animation (time = 4.75s, remaining = 0.25 / 0.5 = 0.5)
  const animOut = getAnimationTransform(el, 4.75);
  assert.ok(animOut.scale < 0.9);
});

test('drawTextElements renders visible elements and respects layer order & visibility', () => {
  registerRenderFonts();
  const canvas = createCanvas(720, 1280);
  const ctx = canvas.getContext('2d');

  const elements: CanvasTextElement[] = [
    {
      ...createDefaultTextElement('heading', 0, 10),
      text: 'MAIN TITLE',
      start: 1.0,
      end: 4.0,
      visible: true,
      fontSize: 60,
      color: '#ffffff',
    },
    {
      ...createDefaultTextElement('label', 0, 10),
      text: 'HIDDEN LABEL',
      start: 1.0,
      end: 4.0,
      visible: false,
    },
  ];

  // At t = 0.5s: element not yet started -> canvas should be blank
  ctx.clearRect(0, 0, 720, 1280);
  drawTextElements(ctx as unknown as CanvasRenderingContext2D, 720, 1280, elements, 0.5);
  assert.ok(canvas.data().every(v => v === 0), 'Canvas is empty before element start');

  // At t = 2.0s: MAIN TITLE is visible -> canvas has pixels
  ctx.clearRect(0, 0, 720, 1280);
  drawTextElements(ctx as unknown as CanvasRenderingContext2D, 720, 1280, elements, 2.0);
  assert.ok(canvas.data().some((v, idx) => idx % 4 === 3 && v > 0), 'MAIN TITLE rendered visible pixels');

  // At t = 5.0s: element ended -> canvas is empty
  ctx.clearRect(0, 0, 720, 1280);
  drawTextElements(ctx as unknown as CanvasRenderingContext2D, 720, 1280, elements, 5.0);
  assert.ok(canvas.data().every(v => v === 0), 'Canvas is empty after element end');
});

test('validateRenderProject accepts project snapshots containing textElements', () => {
  const p = validateRenderProject({
    duration: 5,
    width: 1280,
    height: 720,
    mediaType: 'video',
    settings: { ...defaults },
    words: [word('Test', 0, 1)],
    textElements: [
      createDefaultTextElement('heading', 0, 5),
      createDefaultTextElement('label', 1, 4),
    ],
  });
  assert.equal(p.textElements?.length, 2);
});

test('validateRenderProject accepts project snapshots containing canvasElements', () => {
  const p = validateRenderProject({
    duration: 5,
    width: 1280,
    height: 720,
    mediaType: 'video',
    settings: { ...defaults },
    words: [word('Test', 0, 1)],
    canvasElements: [
      {
        id: 'el-1',
        assetId: 'asset-1',
        name: 'logo.png',
        type: 'image',
        url: '/api/projects/p1/assets/asset-1/file',
        x: 50,
        y: 50,
        scale: 1.0,
        start: 0,
        end: 5,
        visible: true,
        locked: false,
        greenScreen: { enabled: true, color: '#00ff00', tolerance: 50, spillReduction: true, smoothEdges: true },
      },
    ],
  });
  assert.equal(p.canvasElements?.length, 1);
  assert.equal(p.canvasElements?.[0].name, 'logo.png');

  // Rejects non-array or >500 items
  assert.throws(() => {
    validateRenderProject({
      duration: 5,
      width: 1280,
      height: 720,
      mediaType: 'video',
      settings: { ...defaults },
      words: [word('Test', 0, 1)],
      canvasElements: 'invalid' as any,
    });
  }, /invalid canvas elements list/);
});

test('chroma key algorithm processes color keying, tolerance, and despill', async () => {
  const { hexToRgb, rgbToHex, processChromaKeyData } = await import('../src/lib/chromakey.ts');
  assert.deepEqual(hexToRgb('#00ff00'), [0, 255, 0]);
  assert.deepEqual(hexToRgb('#ffffff'), [255, 255, 255]);
  assert.equal(rgbToHex(0, 255, 0), '#00ff00');

  // Create an artificial ImageData (4 pixels)
  // Pixel 0: pure green [0, 255, 0, 255] -> should be keyed out (alpha = 0)
  // Pixel 1: pure red [255, 0, 0, 255] -> should remain fully opaque
  // Pixel 2: dark green [0, 200, 0, 255] -> within tolerance threshold
  // Pixel 3: white [255, 255, 255, 255] -> should remain fully opaque
  const data = new Uint8ClampedArray([
    0, 255, 0, 255,
    255, 0, 0, 255,
    0, 200, 0, 255,
    255, 255, 255, 255,
  ]);
  const imgData = { data, width: 2, height: 2 } as ImageData;

  processChromaKeyData(imgData, {
    enabled: true,
    color: '#00ff00',
    tolerance: 50,
    spillReduction: true,
    smoothEdges: false,
  });

  // Pixel 0 (pure green) must be keyed out to alpha 0
  assert.equal(data[3], 0, 'Pure green pixel has alpha 0');
  // Pixel 1 (pure red) must retain alpha 255
  assert.equal(data[7], 255, 'Red pixel retains alpha 255');
  // Pixel 3 (white) must retain alpha 255
  assert.equal(data[15], 255, 'White pixel retains alpha 255');
});







// --- caption pagination and hero selection -----------------------------------

test('buildPages holds a page too short to read, without changing the line split', () => {
  const words = [
    word('chalo', 0, .35), word('shuru', .36, .7), word('karte', .72, 1.05), word('hain', 1.06, 1.4),
    word('ab', 1.9, 2.05),          // lone word, then a long silence
    word('dekho', 3.9, 4.4),
  ];
  const pages = buildPages(words, 5);
  const stray = pages.find(p => p.words.length === 1 && p.words[0].text === 'ab');
  assert.ok(stray, 'the user-visible line split is preserved');
  assert.ok(stray.end - stray.start >= 0.9 - 1e-6, 'the short page is held on screen long enough to read');
  assert.deepEqual(groupWords(words, 5).map(g => g.map(w => w.text)),
    [['chalo', 'shuru', 'karte', 'hain'], ['ab'], ['dekho']],
    'grouping itself is unchanged');
});

test('buildPages keeps the hero off both ends so the 3-tier lockup has all three rows', () => {
  const mk = (text: string, start: number, end: number, score: number): Word =>
    ({ ...word(text, start, end), emphasisScore: score });
  // Highest score sits on the last word; the lockup still needs a suffix row.
  const words = [mk('aur', 0, .3, .2), mk('aaj', .32, .6, .3), mk('main', .62, .9, .35),
    mk('aapko', .92, 1.3, .4), mk('BATAUNGA', 1.32, 1.9, .97)];
  const [page] = buildPages(words, 5);
  assert.ok(page.heroIndex >= 1 && page.heroIndex <= page.words.length - 2,
    `hero index ${page.heroIndex} leaves room above and below`);
});

test('buildPages never marks more than one hero per page', () => {
  const mk = (text: string, start: number, end: number, score: number): Word =>
    ({ ...word(text, start, end), emphasisScore: score, emphasis: score > .8 });
  const words = [mk('sab', 0, .3, .9), mk('kuch', .32, .6, .95), mk('badal', .62, .95, .93),
    mk('gaya', .97, 1.4, .91)];
  const pages = buildPages(words, 5);
  for (const page of pages) {
    assert.equal(page.heroIndex >= 0 ? 1 : 0, 1, 'exactly one hero');
  }
});

test('buildPages clamps a page to the next page start so captions never overlap', () => {
  const words = [word('ek', 0, .4), word('do', .45, .9), word('teen', 1.0, 1.5), word('chaar', 1.55, 2.0)];
  const pages = buildPages(words, 2);
  for (let i = 0; i < pages.length - 1; i++) {
    assert.ok(pages[i].end <= pages[i + 1].start + 1e-9,
      `page ${i} ends before page ${i + 1} begins`);
  }
});

test('every template resolves to a layout treatment', () => {
  for (const t of templates) {
    const treatment = treatmentFor(t.id);
    assert.ok(['stack', 'rows', 'single'].includes(treatment.layout), `${t.id} has a layout`);
    const distinguished = treatment.heroScale > treatment.subScale
      || treatment.layout === 'single'
      || treatment.heroFont !== treatment.subFont
      || treatment.heroWeight !== treatment.subWeight
      || !!treatment.pill || !!treatment.ring || !!treatment.gradientRamp;
    assert.ok(distinguished,
      `${t.id} sets its hero apart somehow — by size, face, weight, or a mark. `
      + 'Premiere composition 2 keeps all three lines at one size and carries the '
      + 'contrast in face and colour, so size alone is not the test.');
  }
});

test('exports are rendered at 60fps so word entrances are not stepped', () => {
  const args = ffmpegArguments(project([word('a', 0, .5)]), 'in.mp4', 'out.mp4', 'burned', 720);
  const rate = args[args.indexOf('-r') + 1];
  assert.equal(rate, '60');
  assert.equal(args[args.indexOf('-framerate') + 1], '60');
});

test('the automatic picker promotes only one word per page', () => {
  const mk = (text: string, start: number, end: number, score: number): Word =>
    ({ ...word(text, start, end, true), emphasisScore: score, spotlight: false });
  const words = [mk('sab', 0, .3, .9), mk('kuch', .32, .6, .95), mk('badal', .62, .95, .93), mk('gaya', .97, 1.4, .91)];
  const [page] = buildPages(words, 5);
  assert.equal(page.heroIndices.length, 1,
    'however many words carry the emphasis flag, automatic emphasis stays rare');
});

test('every word the editor spotlights is promoted, not just the first', () => {
  const mk = (text: string, start: number, end: number, spotlight: boolean): Word =>
    ({ ...word(text, start, end), emphasisScore: .5, spotlight, emphasis: spotlight });
  const words = [mk('ye', 0, .25, false), mk('bahut', .27, .6, true), mk('zaroori', .62, 1.0, true),
    mk('hai', 1.02, 1.3, false)];
  const [page] = buildPages(words, 5);
  assert.deepEqual(page.heroIndices, [1, 2], 'both spotlighted words are heroes');
  const run = heroRun(page);
  assert.deepEqual(run, { start: 1, end: 2 }, 'and they share the centre row of the lockup');
});

test('spotlights that sit apart keep the first contiguous run as the centre row', () => {
  const mk = (text: string, start: number, end: number, spotlight: boolean): Word =>
    ({ ...word(text, start, end), emphasisScore: .5, spotlight, emphasis: spotlight });
  const words = [mk('ek', 0, .25, true), mk('do', .27, .5, false), mk('teen', .52, .8, true), mk('chaar', .82, 1.2, false)];
  const [page] = buildPages(words, 5);
  assert.deepEqual(page.heroIndices, [0, 2], 'both stay promoted');
  assert.deepEqual(heroRun(page), { start: 0, end: 0 }, 'only the contiguous run anchors the lockup');
});

test('a user spotlight is honoured even at the edge of a page', () => {
  const mk = (text: string, start: number, end: number, spotlight: boolean): Word =>
    ({ ...word(text, start, end), emphasisScore: .5, spotlight });
  const words = [mk('chalo', 0, .3, false), mk('shuru', .32, .6, false), mk('karo', .62, 1.0, true)];
  const [page] = buildPages(words, 5);
  assert.equal(page.heroIndex, 2, 'the clamp that protects the auto pick never overrides an explicit choice');
});

test('a ceiling split that strands the strongest word is nudged, a pause split is not', () => {
  const mk = (text: string, start: number, end: number, score: number): Word =>
    ({ ...word(text, start, end), emphasisScore: score });
  // Five tight words; the last is the strongest, so it should move to the next page.
  const nudged = buildPages([
    mk('aur', 0, .2, .2), mk('aaj', .22, .45, .3), mk('main', .47, .7, .3),
    mk('aapko', .72, .95, .35), mk('BATAUNGA', .97, 1.5, .98),
    mk('sab', 1.52, 1.8, .3), mk('kuch', 1.82, 2.2, .3),
  ], 5);
  assert.ok(nudged[1].words.some(w => w.text === 'BATAUNGA'), 'the strongest word moved off the page edge');
  assert.ok(nudged[1].heroIndex >= 1, 'and now has a row above it');

  // The same shape, but a real pause at the boundary: the split must survive.
  const kept = buildPages([
    mk('aur', 0, .2, .2), mk('aaj', .22, .45, .3), mk('main', .47, .7, .3),
    mk('aapko', .72, .95, .35), mk('BATAUNGA', .97, 1.5, .98),
    mk('sab', 2.4, 2.7, .3), mk('kuch', 2.72, 3.1, .3),
  ], 5);
  assert.equal(kept[0].words.at(-1)!.text, 'BATAUNGA', 'a pause boundary is never moved');
});

test('caption defaults are shared with the backend, not restated', () => {
  const shared = JSON.parse(readFileSync(new URL('../src/lib/caption-defaults.json', import.meta.url), 'utf8'));
  assert.deepEqual({ ...defaults }, shared, 'types.ts defaults come straight from the shared file');
});

test('no template declares a treatment the renderer ignores', () => {
  const componentSource = readFileSync(new URL('../src/remotion/CaptionWord.tsx', import.meta.url), 'utf8')
    + readFileSync(new URL('../src/remotion/CaptionPage.tsx', import.meta.url), 'utf8');
  const declared = new Set<string>();
  for (const t of templates) for (const key of Object.keys(treatmentFor(t.id))) declared.add(key);

  const ignored = [...declared].filter(key => !componentSource.includes(`treatment.${key}`));
  assert.deepEqual(ignored, [],
    'every treatment field a template sets must be read by a component — `ring` was declared and '
    + 'consumed nowhere, which silently reduced scribble and double-trouble to plain rows');
});

test('every template in the picker has its own treatment, not the fallback', () => {
  for (const t of templates) {
    assert.ok(Object.prototype.hasOwnProperty.call(treatments, t.id),
      `${t.id} has an explicit treatment`);
  }
});

test('export supports 4K (2160p) resolution and custom frame rates (24, 25, 30, 50, 60 fps)', () => {
  const p = project([word('test', 0, 1)]);
  
  // Test 4K landscape (16:9 source): 3840x2160
  const dim4kLandscape = dimensions(p.settings, 1280, 720, 2160);
  assert.equal(dim4kLandscape.width, 3840);
  assert.equal(dim4kLandscape.height, 2160);

  // Test 4K portrait (9:16 source): 2160x3840
  const dim4kPortrait = dimensions(p.settings, 720, 1280, 2160);
  assert.equal(dim4kPortrait.width, 2160);
  assert.equal(dim4kPortrait.height, 3840);

  // Test ffmpeg arguments with 4K and 24 fps on landscape project
  const args24 = ffmpegArguments(p, 'in.mp4', 'out.mp4', 'burned', 2160, 24);
  assert.equal(args24[args24.indexOf('-r') + 1], '24');
  assert.equal(args24[args24.indexOf('-framerate') + 1], '24');
  assert.equal(args24[args24.indexOf('-video_size') + 1], '3840x2160');
  assert.ok(args24.some(arg => arg.includes('fps=24')));

  // Test ffmpeg arguments with 50 fps
  const args50 = ffmpegArguments(p, 'in.mp4', 'out.mp4', 'burned', 1080, 50);
  assert.equal(args50[args50.indexOf('-r') + 1], '50');
  assert.equal(args50[args50.indexOf('-framerate') + 1], '50');
  assert.ok(args50.some(arg => arg.includes('fps=50')));
});

test('renderCaptionVideo rejects unsupported resolutions and frame rates', async () => {
  const p = project([word('hi', 0, 1)]);
  await assert.rejects(
    () => renderCaptionVideo({ project: p, input: 'in.mp4', output: 'out.mp4', mode: 'burned', resolution: 480, fps: 30 }),
    /Export resolution must be 720, 1080, or 2160/
  );
  await assert.rejects(
    () => renderCaptionVideo({ project: p, input: 'in.mp4', output: 'out.mp4', mode: 'burned', resolution: 1080, fps: 45 }),
    /Export frame rate must be 24, 25, 30, 50, or 60 fps/
  );
});

test('validateRenderProject accepts positionX and align, rejects out-of-bound values', () => {
  const base = project([word('test', 0, 1)]);
  const valid = validateRenderProject({
    ...base,
    settings: { ...base.settings, positionX: 50, align: 'center' },
  });
  assert.equal(valid.settings.positionX, 50);
  assert.equal(valid.settings.align, 'center');

  assert.throws(() => validateRenderProject({
    ...base,
    settings: { ...base.settings, positionX: -10 },
  }), /settings/);
  assert.throws(() => validateRenderProject({
    ...base,
    settings: { ...base.settings, positionX: 150 },
  }), /settings/);
});

test('a lockup always has a hero, even when every score is low', () => {
  const lowScoreWords = [
    { ...word('a', 0, 0.3), emphasisScore: 0.1 },
    { ...word('b', 0.3, 0.6), emphasisScore: 0.1 },
    { ...word('c', 0.6, 0.9), emphasisScore: 0.1 },
  ];
  // Stacked and single lockups are built around one big word, so they promote
  // even on a flat line. Row layouts deliberately do not — see the flat-line
  // test above — because forcing one there made every caption shout.
  const pages = buildPages(lowScoreWords, 3, { alwaysPromote: true });
  assert.equal(pages.length, 1);
  assert.ok(pages[0].heroIndex >= 0, 'the hero row is never left empty');
  assert.ok(pages[0].heroIndices.length >= 1);
});



// --- the Premiere preset family ---------------------------------------------

test('every mogrt preset has its own entrance, since that is all that separates them', () => {
  const mogrt = templates.filter(t => t.id.startsWith('mogrt-'));
  assert.equal(mogrt.length, 9, 'all nine Premiere presets are registered');
  const enters = mogrt.map(t => treatmentFor(t.id).enter);
  assert.ok(enters.every(Boolean), 'each declares an entrance variant');
  assert.equal(new Set(enters).size, mogrt.length,
    'no two presets share an entrance — they share everything else, so identical motion would make them the same template');
});

test('the mogrt family keeps the look the .mogrt files actually specify', () => {
  for (const t of templates.filter(x => x.id.startsWith('mogrt-'))) {
    const tr = treatmentFor(t.id);
    // Read from each .mogrt's After Effects project: eight presets are a single
    // Montserrat Black layer; composition 2 is three lines whose middle one is
    // STIX Two Text SemiBold.
    if (t.id === 'mogrt-triple') {
      assert.equal(tr.heroFont, 'stix', 'composition 2 sets its middle line in STIX Two Text');
      assert.equal(tr.heroWeight, 600, 'at SemiBold');
      assert.equal(tr.subFont, 'montserrat', 'with Montserrat on the outer lines');
      assert.equal(tr.prefixWeight, 800, 'line 1 is ExtraBold Italic');
      assert.equal(tr.suffixWeight, 600, 'line 3 is SemiBold Italic');
      assert.equal(tr.heroScale, tr.subScale, 'all three lines share one size, as in the AE comp');
    } else {
      assert.equal(tr.heroFont, 'montserrat', `${t.id} uses Montserrat, as the AE text layer does`);
      assert.equal(tr.heroWeight, 900, `${t.id} is Black weight`);
    }
    assert.ok(tr.gradientRamp, `${t.id} carries the Gradient Ramp effect`);
    assert.ok((tr.glow ?? 0) > 0, `${t.id} carries the Glow effect`);
  }
});

test('gradient and glow stay on the hero so supporting words keep their own colour', () => {
  const source = readFileSync(new URL('../src/remotion/CaptionWord.tsx', import.meta.url), 'utf8');
  const gradient = source.match(/const isGradient = ([^;]+);/)?.[1] ?? '';
  const glow = source.match(/const glow = ([^\n]+)/)?.[1] ?? '';
  assert.ok(/isHero/.test(gradient),
    'the ramp is gated on the hero — applying it to every word flattens a caption to one colour');
  assert.ok(/isHero/.test(glow), 'the glow is gated on the hero too');
});

test('the hero colour and the supporting-word colour are separate settings', () => {
  const page = readFileSync(new URL('../src/remotion/CaptionPage.tsx', import.meta.url), 'utf8');
  assert.ok(/accented\s*\n?\s*\? accent/.test(page),
    'an accented word takes the accent and nothing else decides its colour');
  assert.ok(/settings\.accentSecondary/.test(page),
    'the third line of a stacked lockup can carry its own colour, as composition 2 does');
  const editor = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.ok(!/textColor: color, accent: color/.test(editor),
    'the colour picker must not write the same value into both fields');
});

test('exports default to 60fps, with lower rates available on request', () => {
  const dflt = ffmpegArguments(project([word('a', 0, .5)]), 'in.mp4', 'out.mp4', 'burned', 720);
  assert.equal(dflt[dflt.indexOf('-r') + 1], '60', 'no explicit rate means 60');
  const chosen = ffmpegArguments(project([word('a', 0, .5)]), 'in.mp4', 'out.mp4', 'burned', 720, 30);
  assert.equal(chosen[chosen.indexOf('-r') + 1], '30', 'an explicit rate is still honoured');
});

test('every template has both an entrance and an exit', () => {
  for (const t of templates) {
    const tr = treatmentFor(t.id);
    assert.ok(tr.enter, `${t.id} declares how its words arrive`);
    assert.ok(tr.exit, `${t.id} declares how they leave — captions used to all dissolve identically`);
  }
});

test('entrances are varied across the picker, not one motion reused everywhere', () => {
  const enters = templates.map(t => treatmentFor(t.id).enter);
  assert.ok(new Set(enters).size >= 10,
    `only ${new Set(enters).size} distinct entrances across ${templates.length} templates`);
  const exits = templates.map(t => treatmentFor(t.id).exit);
  assert.ok(new Set(exits).size >= 5, `only ${new Set(exits).size} distinct exits`);
});

test('the Premiere presets sort to the top of the picker', () => {
  const firstNine = templates.slice(0, 9).map(t => t.id);
  assert.ok(firstNine.every(id => id.startsWith('mogrt-')),
    `the nine Premiere presets lead the list, got ${firstNine.join(', ')}`);
  assert.ok(!templates.slice(9).some(id => id.id.startsWith('mogrt-')), 'and none trail behind');
});

test('every font role can render Devanagari', () => {
  const source = readFileSync(new URL('../src/remotion/theme.ts', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('type: {'), source.indexOf('colors: {'));
  for (const role of ['display', 'serif', 'condensed', 'montserrat', 'stix']) {
    const stack = block.match(new RegExp(`${role}: '([^']+)'`))?.[1] ?? '';
    assert.ok(/Devanagari/.test(stack),
      `the ${role} stack falls back to Devanagari — Montserrat, Oswald and STIX carry none, `
      + 'so Hindi silently drops to a system face at the wrong weight without it');
  }
});

test('every colour role the renderer reads has a control in the editor', () => {
  const editor = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  for (const [field, label] of [['textColor', 'TEXT COLOR'], ['accent', 'ACCENT'], ['accentSecondary', 'THIRD LINE']]) {
    assert.ok(new RegExp(`updateSettings\\(\\{[^}]*${field}`).test(editor),
      `${label} is settable from the app — ${field} was readable by the renderer and the API `
      + 'but had no control, so it could only be set by hand-editing JSON');
  }
});

test('the third-line control is limited to layouts that have a third line', () => {
  const editor = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.ok(/isStackedTemplate && \(/.test(editor), 'the third-line picker is gated on a stacked layout');
  assert.ok(/layout === 'stack'/.test(editor), 'and that gate reads the treatment, not a hardcoded id list');
});

test('a flat line promotes nothing in a row layout, but still fills a lockup', () => {
  const flat = (text: string, start: number, end: number): Word =>
    ({ ...word(text, start, end), emphasisScore: 0.3 });
  // Nothing here clears the bar: no numbers, no hooks, no acoustic emphasis.
  const words = [flat('to', 0, .3), flat('phir', .32, .6), flat('kya', .62, .95), flat('hua', .97, 1.4)];

  const rows = buildPages(words, 5);
  assert.deepEqual(rows[0].heroIndices, [],
    'a row layout leaves a flat line alone — forcing a hero made every caption shout');

  const lockup = buildPages(words, 5, { alwaysPromote: true });
  assert.equal(lockup[0].heroIndices.length, 1,
    'a stacked lockup still promotes one, or its hero row would be empty');
});

test('an emphatic word is promoted in a row layout too', () => {
  const mk = (text: string, start: number, end: number, score: number): Word =>
    ({ ...word(text, start, end), emphasisScore: score });
  const words = [mk('ye', 0, .3, .3), mk('bilkul', .32, .7, .95), mk('sahi', .72, 1.1, .3)];
  assert.equal(buildPages(words, 5)[0].heroIndices.length, 1,
    'the threshold gates weak lines, it does not disable promotion');
});

test('the always-promote rule is keyed off the layout, not a template list', () => {
  const track = readFileSync(new URL('../src/remotion/CaptionTrack.tsx', import.meta.url), 'utf8');
  assert.ok(/alwaysPromote = layout !== 'rows'/.test(track),
    'stacked and single lockups promote; row layouts earn it');
});

test('every offerable caption font is bundled for the headless renderer', () => {
  const fonts = JSON.parse(readFileSync(new URL('../src/lib/caption-fonts.json', import.meta.url), 'utf8'));
  const track = readFileSync(new URL('../src/remotion/CaptionTrack.tsx', import.meta.url), 'utf8');
  for (const f of fonts as { family: string }[]) {
    const pkg = f.family.toLowerCase().replace(/\s+/g, '-');
    assert.ok(track.includes(`@fontsource/${pkg}/`),
      `${f.family} is imported into the Remotion bundle — the headless renderer cannot reach `
      + 'the browser’s fonts, so anything missing falls back and the export stops matching the preview');
  }
});

test('an unlisted font family never reaches the CSS font stack', () => {
  const page = readFileSync(new URL('../src/remotion/CaptionPage.tsx', import.meta.url), 'utf8');
  assert.ok(/OFFERED_FONTS\.has\(custom\)/.test(page),
    'the family is interpolated into a CSS font-family, so it is checked against the offered list first');
});

test('buildPages never puts more than MAX_WORDS_PER_PAGE words on a page, whatever the settings ask for', () => {
  // A continuous run with no pause and no sentence end: the only thing that can
  // split it is the ceiling. The generate panel's slider used to reach 12 and
  // wrote straight into wordsPerLine, so a caption could be half a paragraph.
  const words = Array.from({ length: 24 }, (_, i) => ({
    id: `w${i}`, text: `word${i}`, original: `word${i}`,
    start: i * 0.2, end: i * 0.2 + 0.18, confidence: 1, emphasis: false, emphasisScore: 0.4,
  }));

  for (const requested of [7, 8, 12, 99]) {
    const pages = buildPages(words, requested);
    const longest = Math.max(...pages.map(p => p.words.length));
    assert.ok(longest <= MAX_WORDS_PER_PAGE,
      `asked for ${requested} words per page, got a page of ${longest}`);
  }

  // Below the ceiling the setting is still honoured exactly.
  assert.equal(Math.max(...buildPages(words, 3).map(p => p.words.length)), 3);
});
