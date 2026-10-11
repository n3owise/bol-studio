import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeVttText, subtitleText, csvTranscript, matchesCaptionWord, replaceAllOccurrences } from '../src/lib/captions.ts';
import type { Word } from '../src/lib/types.ts';
const word = (text: string, id = text): Word => ({ id, text, original: text, start: 0, end: 1, confidence: 1, emphasis: false, emphasisScore: 0 });
test('VTT preserves literal markup delimiters and prevents injected cue lines', () => {
  assert.equal(escapeVttText('<test>&\n\n00:00:03 --> 00:00:04'), '&lt;test&gt;&amp; 00:00:03 --&gt; 00:00:04');
  assert.match(subtitleText([word('<test>&')], 4, 'vtt'), /&lt;test&gt;&amp;/);
  assert.match(subtitleText([word('<test>&')], 4, 'srt'), /<test>&/);
});
test('CSV neutralizes formula text and original fields while retaining ordinary quoted text', () => {
  for (const text of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '\t =1+1', '\r@SUM(A1)']) {
    const row = csvTranscript([word(text)]).split('\n').slice(1).join('\n');
    assert.ok(row.startsWith(`"'${text}"`), text);
    assert.ok(row.endsWith(`"'${text}"`), text);
  }
  assert.match(csvTranscript([word('say "hi", friend')]), /"say ""hi"", friend"/);
});
test('find and replace share exact word semantics, punctuation and case', () => {
  const words = ['Hello!', 'hello,', 'shelloworld', 'HELLO'].map(text => word(text));
  const count = words.filter(w => matchesCaptionWord(w.text, ' hello ')).length;
  const replaced = replaceAllOccurrences(words, ' hello ', ' bye ');
  assert.equal(count, 3);
  assert.equal(replaced.filter((w, i) => w !== words[i]).length, count);
  assert.deepEqual(replaced.map(w => w.text), ['bye!', 'bye,', 'shelloworld', 'bye']);
  assert.equal(matchesCaptionWord('Hello!', 'hello', true), false);
  assert.equal(matchesCaptionWord('Hello!', 'Hello', true), true);
  assert.equal(replaceAllOccurrences(words, 'Hello', '  '), words);
  assert.equal(matchesCaptionWord('Hello', ' '), false);
});
