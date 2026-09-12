import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import {
  appendWord, autoDetectHighlights, dimensions, drawCaptions, ensureValidIntervals, getContrastColor,
  groupWords, insertWord, mergeLines, moveWordToLine, moveWordsToLine, moveWordToNextLine, moveWordToPreviousLine,
  replaceAllOccurrences, splitLineAtWord, subtitleText, templates
} from '../src/lib/captions.ts';
import { defaults, type Word } from '../src/lib/types.ts';
import { ffmpegArguments, registerRenderFonts, validateRenderProject } from '../server/render.ts';

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

test('the shared renderer draws emphasized words larger with bundled fonts', () => {
  registerRenderFonts();
  const canvas = createCanvas(720, 1280), ctx = canvas.getContext('2d');
  const draws: { text: string; size: number }[] = [];
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y, maxWidth) => {
    draws.push({ text, size: Number(/([\d.]+)px/.exec(ctx.font)?.[1]) });
    fillText(text, x, y, maxWidth);
  };
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, 720, 1280,
    [word('hello', 0, .5), word('दुनिया', .5, 1, true)], { ...defaults, motion: 0 }, .25);
  assert.equal(draws.length, 2);
  assert.ok(draws[1].size > draws[0].size * 1.25, 'The emphasized word should have a visibly larger font.');
  assert.ok(canvas.data().some((value, index) => index % 4 === 3 && value > 0), 'A caption frame should contain visible pixels.');
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

test('all templates render and captions clear between groups', () => {
  registerRenderFonts();
  const canvas = createCanvas(720, 1280), ctx = canvas.getContext('2d');
  const words = [word('Apni', 1, 1.5), word('kahaani', 1.5, 2, true)];
  for (const template of templates) {
    drawCaptions(ctx as unknown as CanvasRenderingContext2D, 720, 1280, words, { ...defaults, template: template.id }, 1.2);
    assert.ok(canvas.data().some((value, index) => index % 4 === 3 && value > 0), template.id);
  }
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, 720, 1280, words, defaults, .5);
  assert.ok(canvas.data().every(value => value === 0));
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, 720, 1280, words, defaults, 2.2);
  assert.ok(canvas.data().every(value => value === 0));
});

test('the next caption starts immediately when consecutive groups meet', () => {
  registerRenderFonts();
  const ctx = createCanvas(720, 1280).getContext('2d');
  const words = [word('Pehla', 0, .5), word('Doosra', .5, 1)];
  const drawn: string[] = [];
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y, maxWidth) => { drawn.push(text); fillText(text, x, y, maxWidth); };
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, 720, 1280, words,
    { ...defaults, template: 'kinetic', motion: 0 }, .5);
  assert.deepEqual(drawn, ['Doosra']);
});

test('large multi-line phrases remain visible inside landscape safe margins', () => {
  registerRenderFonts();
  const width = 1280, height = 720;
  const ctx = createCanvas(width, height).getContext('2d');
  const words = Array.from({ length: 8 }, (_, i) => word(i % 2 ? 'खूबसूरती' : 'extraordinary', i * .4, (i + 1) * .4, true));
  const bounds: { top: number; bottom: number }[] = [];
  const fillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y, maxWidth) => {
    const transform = ctx.getTransform(), metrics = ctx.measureText(text);
    bounds.push({ top: transform.f - metrics.actualBoundingBoxAscent * transform.d,
      bottom: transform.f + metrics.actualBoundingBoxDescent * transform.d });
    fillText(text, x, y, maxWidth);
  };
  for (const position of [10, 90]) {
    bounds.length = 0;
    drawCaptions(ctx as unknown as CanvasRenderingContext2D, width, height, words,
      { ...defaults, fontSize: 100, wordsPerLine: 8, position, motion: 2 }, .1);
    assert.equal(bounds.length, 8);
    assert.ok(bounds.every(b => b.top >= height * .06 && b.bottom <= height * .94),
      `All eight words should stay within the frame at position ${position}: ${JSON.stringify(bounds)}`);
  }
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
  assert.equal(green[green.indexOf('-frames:v') + 1], '60');
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

test('boxed pill templates (karaoke, bubble-highlight, editing-school) render crisp text with no stroke and clear shadows', () => {
  registerRenderFonts();
  const canvas = createCanvas(720, 1280), ctx = canvas.getContext('2d');
  const words = [word('pehla', 0.0, 0.4), word('doosra', 0.4, 0.8), word('teesra', 0.8, 1.2)];

  // Spies to record strokeText and fillText details
  const strokes: { text: string; lineWidth: number; shadowColor: string }[] = [];
  const fills: { text: string; fillStyle: string; shadowColor: string }[] = [];

  const origStrokeText = ctx.strokeText.bind(ctx);
  const origFillText = ctx.fillText.bind(ctx);

  ctx.strokeText = (text, x, y, maxWidth) => {
    strokes.push({ text, lineWidth: ctx.lineWidth, shadowColor: ctx.shadowColor });
    origStrokeText(text, x, y, maxWidth);
  };
  ctx.fillText = (text, x, y, maxWidth) => {
    fills.push({ text, fillStyle: String(ctx.fillStyle), shadowColor: ctx.shadowColor });
    origFillText(text, x, y, maxWidth);
  };

  // Test karaoke (Word Flow) at time = 0.5 (second word "doosra" is active and inside purple box #c2a1ff)
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, 720, 1280, words, {
    ...defaults,
    template: 'karaoke',
    accent: '#c2a1ff',
    motion: 0,
  }, 0.5);

  // Active word "doosra" should NOT have been stroked (to prevent muddy/bloated text)
  const doosraStrokes = strokes.filter(s => s.text === 'doosra');
  assert.equal(doosraStrokes.length, 0, 'Active word inside karaoke pill must not execute strokeText');

  // Inactive words "pehla" and "teesra" should have strokes for visibility over video
  const pehlaStrokes = strokes.filter(s => s.text === 'pehla');
  assert.ok(pehlaStrokes.length > 0, 'Non-boxed words must maintain outline stroke for video contrast');
  assert.ok(pehlaStrokes[0].lineWidth > 0);

  // Active word "doosra" fillText must use contrast color #111318 and shadow must be transparent
  const doosraFills = fills.filter(f => f.text === 'doosra');
  assert.ok(doosraFills.length > 0);
  assert.equal(doosraFills[0].fillStyle, '#111318', 'Active word inside purple pill must use crisp high-contrast dark text');
  assert.equal(doosraFills[0].shadowColor, 'transparent', 'Active word inside pill must have transparent shadow');

  // Multi-word phrase in karaoke keeps all words visible without zero-alpha artifacting
  assert.equal(fills.length, 3, 'All 3 words in the group must be rendered in karaoke');
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

test('3-tier lockup places hero in center, prefix on top-left, suffix on bottom-right, with progressive reveal', () => {
  registerRenderFonts();
  const width = 720, height = 1280;
  const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
  const words = [
    word('ab', 0.0, 0.4),
    word('ENGLISH', 0.4, 1.0, true),
    word('mein', 1.0, 1.3),
    word('ye', 1.3, 1.6),
  ];

  type DrawRecord = { text: string; x: number; y: number; fill: string; alpha: number };
  const fills: DrawRecord[] = [];
  const origFillText = ctx.fillText.bind(ctx);

  ctx.fillText = (text, x, y, maxWidth) => {
    const t = ctx.getTransform();
    fills.push({
      text: String(text),
      x: t.e + Number(x),
      y: t.f + Number(y),
      fill: String(ctx.fillStyle),
      alpha: Number(ctx.globalAlpha),
    });
    origFillText(text, x, y, maxWidth);
  };

  // 1. At time = 0.2s: motion is active, so only 'ab' has started (alpha > 0), others are alpha = 0
  fills.length = 0;
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, width, height, words, {
    ...defaults,
    template: 'welcome-stack',
    accent: '#9de52e',
    motion: 1,
  }, 0.2);

  assert.equal(fills.length, 4);
  const abDraw = fills.find(f => f.text === 'ab')!;
  const englishDraw = fills.find(f => f.text === 'ENGLISH')!;
  const meinDraw = fills.find(f => f.text === 'mein')!;
  const yeDraw = fills.find(f => f.text === 'ye')!;

  assert.ok(abDraw.alpha > 0, "'ab' should be visible at 0.2s");
  assert.equal(englishDraw.alpha, 0, "'ENGLISH' should not yet be visible at 0.2s");
  assert.equal(meinDraw.alpha, 0, "'mein' should not yet be visible at 0.2s");
  assert.equal(yeDraw.alpha, 0, "'ye' should not yet be visible at 0.2s");

  // 2. Test geometry at time = 1.5s (all words started, motion = 0 for static measurement)
  fills.length = 0;
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, width, height, words, {
    ...defaults,
    template: 'welcome-stack',
    accent: '#9de52e',
    motion: 0,
  }, 1.5);

  assert.equal(fills.length, 4);
  const fAb = fills.find(f => f.text === 'ab')!;
  const fEng = fills.find(f => f.text === 'ENGLISH')!;
  const fMein = fills.find(f => f.text === 'mein')!;
  const fYe = fills.find(f => f.text === 'ye')!;

  assert.equal(fEng.x, width / 2, 'Hero word centered at width / 2');
  assert.equal(fEng.fill, '#9de52e', 'Hero word has accent color #9de52e');

  assert.equal(fAb.fill, '#ffffff', "Prefix word 'ab' is pure white");
  assert.equal(fMein.fill, '#ffffff', "Suffix word 'mein' is pure white");
  assert.equal(fYe.fill, '#ffffff', "Suffix word 'ye' is pure white");

  // Prefix is on top of hero: yPrefix < yHero
  assert.ok(fAb.y < fEng.y, "Prefix 'ab' is above 'ENGLISH'");

  // Suffix is below hero: ySuffix > yHero
  assert.ok(fMein.y > fEng.y, "Suffix 'mein' is below 'ENGLISH'");
  assert.ok(fYe.y > fEng.y, "Suffix 'ye' is below 'ENGLISH'");
});

test('multiple words in spotlight in a caption line are both rendered with accent color and glow', () => {
  registerRenderFonts();
  const width = 720, height = 1280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const words: Word[] = [
    { id: 'w1', text: 'Yeh', original: 'Yeh', start: 0.1, end: 0.4, confidence: 1, emphasis: false, emphasisScore: 0.2 },
    { id: 'w2', text: 'dil', original: 'dil', start: 0.4, end: 0.8, confidence: 1, emphasis: true, emphasisScore: 0.9, spotlight: true },
    { id: 'w3', text: 'ki', original: 'ki', start: 0.8, end: 1.2, confidence: 1, emphasis: true, emphasisScore: 0.85, spotlight: true },
    { id: 'w4', text: 'baat.', original: 'baat.', start: 1.2, end: 1.6, confidence: 1, emphasis: false, emphasisScore: 0.2 },
  ];

  const fills: { text: string; fill: string; shadow: string }[] = [];
  const origFillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y, maxWidth) => {
    fills.push({
      text: String(text),
      fill: String(ctx.fillStyle),
      shadow: String(ctx.shadowColor),
    });
    origFillText(text, x, y, maxWidth);
  };

  // 1. In welcome-stack template: both spotlight words should be rendered with accent color and glow
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, width, height, words, {
    ...defaults,
    template: 'welcome-stack',
    accent: '#ff0077',
    motion: 0,
  }, 1.4);

  const dilDraw = fills.find(f => f.text === 'DIL');
  const kiDraw = fills.find(f => f.text === 'KI');
  const yehDraw = fills.find(f => f.text === 'Yeh');
  const baatDraw = fills.find(f => f.text === 'baat.');

  assert.ok(dilDraw, 'DIL was rendered');
  assert.ok(kiDraw, 'KI was rendered');
  assert.equal(dilDraw.fill, '#ff0077', 'First spotlight word has accent color');
  assert.equal(kiDraw.fill, '#ff0077', 'Second spotlight word has accent color (not forced to white)');
  assert.equal(dilDraw.shadow, '#ff0077', 'First spotlight word has accent shadow glow');
  assert.equal(kiDraw.shadow, '#ff0077', 'Second spotlight word has accent shadow glow');

  assert.equal(yehDraw?.fill, '#ffffff', 'Non-spotlight prefix word is white');
  assert.equal(baatDraw?.fill, '#ffffff', 'Non-spotlight suffix word is white');

  // 2. In non-stack template (e.g. sukoon / default)
  fills.length = 0;
  drawCaptions(ctx as unknown as CanvasRenderingContext2D, width, height, words, {
    ...defaults,
    template: 'minimal',
    accent: '#00e5ff',
    motion: 0,
  }, 1.4);

  const dilMin = fills.find(f => f.text === 'dil');
  const kiMin = fills.find(f => f.text === 'ki');
  assert.ok(dilMin && kiMin, 'Both words rendered in minimal template');
  assert.equal(dilMin.fill, '#00e5ff', 'First spotlight word has accent in minimal template');
  assert.equal(kiMin.fill, '#00e5ff', 'Second spotlight word has accent in minimal template');
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

  // Verify that rendering welcome-stack matches: Step word has accent color
  const canvas = createCanvas(720, 1280);
  const ctx = canvas.getContext('2d');
  const fills: { text: string; fill: string }[] = [];
  const origFillText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y, maxWidth) => {
    fills.push({ text: String(text), fill: String(ctx.fillStyle) });
    origFillText(text, x, y, maxWidth);
  };

  drawCaptions(ctx as unknown as CanvasRenderingContext2D, 720, 1280, highlighted, {
    ...defaults,
    template: 'welcome-stack',
    accent: '#2ee368',
    motion: 0,
  }, 0.5);

  const heroRender = fills.find(f => f.text === 'STEP');
  assert.ok(heroRender, 'Hero word STEP was rendered');
  assert.equal(heroRender.fill, '#2ee368', 'Hero word on canvas has accent color matching timeline spotlight');
});




