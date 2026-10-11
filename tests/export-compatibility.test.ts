import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { csvTranscript, subtitleText } from '../src/lib/captions.ts';
import type { Word } from '../src/lib/types.ts';
const words = ['नमस्ते', 'hello, "friend"', '<literal>&', '=SUM(A1)', 'line\nbreak'].map((text, i): Word => ({
  id: String(i), text, original: text, start: i * 0.5, end: i * 0.5 + 0.4,
  confidence: 0.9, emphasis: false, emphasisScore: 0,
}));

test('CSV round trips Unicode, quoted commas and embedded newlines through Python csv', () => {
  const result = spawnSync('python3', ['-c', 'import csv,sys,json,io; print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.read())))))'],
    { input: csvTranscript(words), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const rows = JSON.parse(result.stdout);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((row: string[]) => row.length === 7));
  words.forEach((word, i) => {
    assert.equal(rows[i + 1][0], word.text.startsWith('=') ? "'" + word.text : word.text);
    assert.equal(rows[i + 1][6], rows[i + 1][0]);
    assert.equal(Number(rows[i + 1][1]), word.start);
    assert.equal(Number(rows[i + 1][2]), word.end);
  });
});

test('FFmpeg independently parses all generated WebVTT and SRT cues and timings', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bol-subtitle-compat-'));
  try {
    for (const format of ['vtt', 'srt'] as const) {
      const path = join(directory, `captions.${format}`);
      writeFileSync(path, subtitleText(words, 1, format));
      const result = spawnSync('ffprobe', ['-v', 'error', '-show_packets', '-show_data', '-of', 'json', path], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      const packets = JSON.parse(result.stdout).packets;
      assert.equal(packets.length, words.length);
      packets.forEach((packet: { pts_time: string; duration_time: string }, i: number) => {
        assert.equal(Number(packet.pts_time), words[i].start);
        assert.equal(Number(packet.duration_time), 0.4);
      });
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
