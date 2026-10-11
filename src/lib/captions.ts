import captionTemplates from './caption-templates.json';
import type { Settings, Word } from './types';
/**
 * The caption picker, shared with the backend: server/app.py validates the
 * template field against this same file. It used to be a literal here and a
 * hardcoded `Literal[...]` in app.py, so adding a template meant editing two
 * languages and forgetting one rejected every save.
 */
export const templates = captionTemplates as { id: string; name: string; tag: string; accent: string; description: string }[];
/**
 * Re-exported so existing editor imports keep working. The implementation lives
 * in ./pages, which is also what the Remotion composition and the exporter use —
 * there is exactly one definition of where a caption page starts and ends.
 */
import { buildPages, groupWords, isSecondaryEmphasis, scoreOf } from './pages';
export { groupWords, buildPages, type CaptionPage } from './pages';
export function dimensions(settings: Settings, sourceWidth = 720, sourceHeight = 1280, resolution = 720) {
  const ratio = settings.aspect === 'original' ? sourceWidth / sourceHeight : settings.aspect === '9:16' ? 9/16 : settings.aspect === '16:9' ? 16/9 : 1;
  return ratio >= 1 ? { width: Math.round(resolution * ratio / 2) * 2, height: resolution } : { width: resolution, height: Math.round(resolution / ratio / 2) * 2 };
}

export function getContrastColor(hexColor: string): '#111318' | '#ffffff' {
  const hex = hexColor.replace('#', '').trim();
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) || 0;
    g = parseInt(hex[1] + hex[1], 16) || 0;
    b = parseInt(hex[2] + hex[2], 16) || 0;
  } else if (hex.length >= 6) {
    r = parseInt(hex.substring(0, 2), 16) || 0;
    g = parseInt(hex.substring(2, 4), 16) || 0;
    b = parseInt(hex.substring(4, 6), 16) || 0;
  }
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 145 ? '#111318' : '#ffffff';
}

/** Keep user text literal instead of treating it as WebVTT cue markup. */
export function escapeVttText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\r\n]+/g, ' ');
}

export function subtitleText(words: Word[], max: number, format: 'srt' | 'vtt') {
  const stamp = (s: number) => { const ms = Math.max(0, Math.round(s*1000)); return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}${format === 'srt' ? ',' : '.'}${String(ms%1000).padStart(3,'0')}`; };
  return (format === 'vtt' ? 'WEBVTT\n\n' : '') + groupWords(words,max).map((g,i) => `${format === 'srt' ? `${i+1}\n` : ''}${stamp(g[0].start)} --> ${stamp(g.at(-1)!.end)}\n${g.map(w => format === 'vtt' ? escapeVttText(w.text) : w.text).join(' ')}\n`).join('\n');
}

export function plainTranscript(words: Word[], max = 12): string {
  if (!words.length) return '';
  return groupWords(words, max).map(g => g.map(w => w.text).join(' ')).join('\n');
}

/**
 * Export word-level timings as spreadsheet-safe CSV. Text that starts with a
 * formula marker (including after whitespace) gets a leading apostrophe. This
 * deliberately changes those CSV fields; JSON retains the original text.
 */
export function csvTranscript(words: Word[]): string {
  const escapeCsv = (val: string) => {
    const safe = /^[\s\u0000-\u001f]*[=+@-]/u.test(val) ? `'${val}` : val;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const header = ['Word', 'Start (s)', 'End (s)', 'Duration (s)', 'Confidence', 'Spotlight', 'Original'];
  const rows = words.map(w => [
    escapeCsv(w.text),
    w.start.toFixed(3),
    w.end.toFixed(3),
    Math.max(0, w.end - w.start).toFixed(3),
    (w.confidence ?? 1).toFixed(2),
    w.spotlight ? 'true' : 'false',
    escapeCsv(w.original || w.text),
  ].join(','));
  return [header.join(','), ...rows].join('\n');
}

export function ensureValidIntervals(words: Word[], duration: number): void {
  for (let i = 0; i < words.length; i++) {
    const prevEnd = i > 0 ? words[i - 1].end : 0;
    if (words[i].start < prevEnd) {
      words[i].start = Number((prevEnd + 0.002).toFixed(3));
    }
    if (words[i].end <= words[i].start) {
      const nextStart = i < words.length - 1 ? words[i + 1].start : duration;
      words[i].end = Number(Math.min(nextStart - 0.002, words[i].start + 0.25).toFixed(3));
      if (words[i].end <= words[i].start) {
        words[i].end = Number((words[i].start + 0.03).toFixed(3));
      }
    }
  }

  // Clip duration upper boundary constraint (server validates: end <= duration + .0001)
  if (words.length > 0 && duration > 0) {
    const lastIdx = words.length - 1;
    if (words[lastIdx].end > duration) {
      const overflow = Number((words[lastIdx].end - duration).toFixed(3));
      for (let i = words.length - 1; i >= 0; i--) {
        words[i].end = Number(Math.max(0.04, words[i].end - overflow).toFixed(3));
        words[i].start = Number(Math.max(0, words[i].start - overflow).toFixed(3));
        if (i < words.length - 1 && words[i].end > words[i + 1].start) {
          words[i].end = Number((words[i + 1].start - 0.002).toFixed(3));
        }
      }
    }
  }
}

export function insertWord(
  words: Word[],
  targetId: string,
  position: 'before' | 'after',
  newText = 'new',
  duration = 60
): { words: Word[]; newWordId: string } {
  const index = words.findIndex(w => w.id === targetId);
  if (index === -1) {
    return appendWord(words, newText, duration);
  }

  const target = words[index];
  const newId = `w-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let start = 0;
  let end = 0;
  const newWords = words.map(w => ({ ...w }));

  if (position === 'after') {
    const next = words[index + 1];
    const maxEnd = next ? next.start - 0.005 : duration;
    const gap = maxEnd - target.end;
    if (gap >= 0.12) {
      start = Number((target.end + 0.005).toFixed(3));
      end = Number(Math.min(maxEnd, start + 0.35).toFixed(3));
    } else {
      const targetDuration = target.end - target.start;
      const keep = Math.max(0.12, targetDuration * 0.55);
      const splitPoint = Number((target.start + keep).toFixed(3));
      newWords[index].end = Number((splitPoint - 0.005).toFixed(3));
      start = splitPoint;
      end = Number(Math.min(maxEnd, start + Math.max(0.12, (maxEnd - start) * 0.8)).toFixed(3));
      if (end <= start) end = Number((start + 0.05).toFixed(3));
    }
  } else {
    const prev = words[index - 1];
    const minStart = prev ? prev.end + 0.005 : 0;
    const gap = target.start - minStart;
    if (gap >= 0.12) {
      end = Number((target.start - 0.005).toFixed(3));
      start = Number(Math.max(minStart, end - 0.35).toFixed(3));
    } else {
      const targetDuration = target.end - target.start;
      const keep = Math.max(0.12, targetDuration * 0.55);
      const splitPoint = Number((target.end - keep).toFixed(3));
      start = Number(Math.max(minStart, splitPoint - Math.max(0.12, (splitPoint - minStart) * 0.8)).toFixed(3));
      end = Number((splitPoint - 0.005).toFixed(3));
      newWords[index].start = splitPoint;
      if (end <= start) end = Number((start + 0.05).toFixed(3));
    }
  }

  start = Number(Math.max(0, start).toFixed(3));
  end = Number(Math.min(duration, Math.max(start + 0.05, end)).toFixed(3));

  const newWord: Word = {
    id: newId,
    text: newText.trim() || 'word',
    original: newText.trim() || 'word',
    start,
    end,
    confidence: 1,
    emphasis: false,
    emphasisScore: 0.5,
  };

  const insertIndex = position === 'after' ? index + 1 : index;
  newWords.splice(insertIndex, 0, newWord);
  ensureValidIntervals(newWords, duration);

  return { words: newWords, newWordId: newId };
}

export function appendWord(
  words: Word[],
  newText = 'new',
  duration = 60
): { words: Word[]; newWordId: string } {
  const newId = `w-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newWords = words.map(w => ({ ...w }));
  let start = 0;
  let end = 0.4;

  if (words.length > 0) {
    const last = words[words.length - 1];
    if (last.end + 0.2 <= duration) {
      start = Number((last.end + 0.01).toFixed(3));
      end = Number(Math.min(duration, start + 0.35).toFixed(3));
    } else {
      const lastDur = last.end - last.start;
      const split = Number((last.start + Math.max(0.1, lastDur * 0.6)).toFixed(3));
      newWords[newWords.length - 1].end = Number((split - 0.005).toFixed(3));
      start = split;
      end = Number(duration.toFixed(3));
    }
  } else {
    start = 0.0;
    end = Number(Math.min(duration, 0.4).toFixed(3));
  }

  newWords.push({
    id: newId,
    text: newText.trim() || 'word',
    original: newText.trim() || 'word',
    start,
    end,
    confidence: 1,
    emphasis: false,
    emphasisScore: 0.5,
  });

  ensureValidIntervals(newWords, duration);
  return { words: newWords, newWordId: newId };
}

/**
 * Line edits set an explicit decision on the word, nothing else.
 *
 * These used to work by writing a full stop onto the word's text and, for a
 * merge, dragging every following word's timing backwards to close the pause.
 * That put punctuation into the caption that the speaker never said, moved
 * timings that were measured from the audio, and left the creator's intent
 * indistinguishable from a full stop the recogniser happened to emit — which
 * is why the clause breaker could not tell the two apart. `lineBreak` says it
 * directly: true ends the page here, false keeps the pair together.
 */
export function splitLineAtWord(words: Word[], wordId: string): Word[] {
  const i = words.findIndex(w => w.id === wordId);
  if (i === -1 || i === words.length - 1) return words;
  return words.map((w, idx) => (idx === i ? { ...w, lineBreak: true } : w));
}

export function mergeLines(words: Word[], firstGroupLastWordId: string): Word[] {
  const i = words.findIndex(w => w.id === firstGroupLastWordId);
  if (i === -1 || i === words.length - 1) return words;
  return words.map((w, idx) => (idx === i
    // The trailing full stop is stripped as well: an older project expresses
    // this same merge with punctuation, and leaving it would both re-break the
    // line and keep showing a stop the creator just removed.
    ? { ...w, text: w.text.replace(/[.!?।]+$/, ''), lineBreak: false }
    : w));
}

export function moveWordToPreviousLine(words: Word[], wordId: string, maxWordsPerLine = 4): Word[] {
  const targetIdx = words.findIndex(w => w.id === wordId);
  if (targetIdx <= 0) return words;

  const groups = groupWords(words, maxWordsPerLine);
  const groupIdx = groups.findIndex(g => g.some(w => w.id === wordId));
  if (groupIdx <= 0) return words;

  const prevGroup = groups[groupIdx - 1];
  const prevEndIdx = words.findIndex(w => w.id === prevGroup[prevGroup.length - 1].id);
  if (prevEndIdx === -1) return words;

  return words.map((w, idx) => {
    // Join everything from the end of the previous line up to the target...
    if (idx >= prevEndIdx && idx < targetIdx) {
      return { ...w, text: w.text.replace(/[.!?।]+$/, ''), lineBreak: false };
    }
    // ...and end the line on the target, so what followed it stays behind.
    if (idx === targetIdx && targetIdx < words.length - 1) {
      return { ...w, lineBreak: true };
    }
    return w;
  });
}

export function moveWordToNextLine(words: Word[], wordId: string): Word[] {
  const targetIdx = words.findIndex(w => w.id === wordId);
  if (targetIdx <= 0) return words;

  return words.map((w, idx) => {
    if (idx === targetIdx - 1) return { ...w, lineBreak: true };
    if (idx === targetIdx) return { ...w, text: w.text.replace(/[.!?।]+$/, ''), lineBreak: false };
    return w;
  });
}

function moveSingleWordToLine(
  words: Word[],
  wordId: string,
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5,
  duration = 9999
): Word[] {
  const sourceWord = words.find(w => w.id === wordId);
  if (!sourceWord) return words;

  const groups = groupWords(words, maxWordsPerLine);
  const sourceGroupIdx = groups.findIndex(g => g.some(w => w.id === wordId));
  if (sourceGroupIdx === -1) return words;
  if (targetGroupIdx < 0 || targetGroupIdx >= groups.length) return words;

  const targetGroup = groups[targetGroupIdx];
  if (!targetGroup.length) return words;

  if (typeof targetPosition === 'object' && targetPosition.targetWordId === wordId) {
    return words;
  }

  const newWords = words.map(w => ({ ...w }));
  const sourceIdx = newWords.findIndex(w => w.id === wordId);
  const movingWord = { ...newWords[sourceIdx] };

  let refWordId: string;
  let insertBefore = false;

  if (typeof targetPosition === 'object') {
    refWordId = targetPosition.targetWordId;
    insertBefore = targetPosition.insert === 'before';
  } else if (targetPosition === 'start') {
    refWordId = targetGroup[0].id;
    insertBefore = true;
  } else {
    refWordId = targetGroup[targetGroup.length - 1].id;
    insertBefore = false;
  }

  if (refWordId === wordId) return words;

  const sourceGroupWords = groups[sourceGroupIdx];
  const sourceWordIdxInGroup = sourceGroupWords.findIndex(w => w.id === wordId);

  newWords.splice(sourceIdx, 1);

  if (sourceWordIdxInGroup === sourceGroupWords.length - 1 && sourceGroupWords.length > 1) {
    const priorWordId = sourceGroupWords[sourceGroupWords.length - 2].id;
    const priorWordIdx = newWords.findIndex(w => w.id === priorWordId);
    if (priorWordIdx !== -1) {
      // The word that now ends the source line keeps that line closed.
      newWords[priorWordIdx] = { ...newWords[priorWordIdx], lineBreak: true };
    }
  }

  // Close any gaps in sourceGroup so remaining words do not split into two lines
  if (sourceGroupIdx !== targetGroupIdx && sourceGroupWords.length > 2) {
    const remainingSourceIds = sourceGroupWords.filter(w => w.id !== wordId).map(w => w.id);
    for (let k = 0; k < newWords.length - 1; k++) {
      const curr = newWords[k];
      const nxt = newWords[k + 1];
      if (remainingSourceIds.includes(curr.id) && remainingSourceIds.includes(nxt.id)) {
        const gap = nxt.start - curr.end;
        if (gap > 0.18) {
          const shift = Number((gap - 0.08).toFixed(3));
          for (let m = k + 1; m < newWords.length; m++) {
            if (!remainingSourceIds.includes(newWords[m].id)) break;
            newWords[m].start = Number((newWords[m].start - shift).toFixed(3));
            newWords[m].end = Number((newWords[m].end - shift).toFixed(3));
          }
        }
      }
    }
  }

  const refIdx = newWords.findIndex(w => w.id === refWordId);
  if (refIdx === -1) return words;

  const insertIdx = insertBefore ? refIdx : refIdx + 1;
  newWords.splice(insertIdx, 0, movingWord);

  const prevWord = insertIdx > 0 ? newWords[insertIdx - 1] : null;
  const nextWord = insertIdx < newWords.length - 1 ? newWords[insertIdx + 1] : null;

  const dur = Math.max(0.08, Number((movingWord.end - movingWord.start).toFixed(3)));

  const alreadyBetween = (!prevWord || movingWord.start >= prevWord.end) &&
                         (!nextWord || movingWord.end <= nextWord.start);

  if (alreadyBetween) {
    // Word was already in this slot in speech: preserve its natural timestamps
    if (prevWord && targetGroup.some(w => w.id === prevWord.id)) {
      const gap = movingWord.start - prevWord.end;
      if (gap > 0.18) {
        const shift = gap - 0.08;
        movingWord.start = Number((movingWord.start - shift).toFixed(3));
        movingWord.end = Number((movingWord.end - shift).toFixed(3));
      }
    } else if (nextWord && targetGroup.some(w => w.id === nextWord.id)) {
      const gap = nextWord.start - movingWord.end;
      if (gap > 0.18) {
        const shift = gap - 0.08;
        movingWord.start = Number((movingWord.start + shift).toFixed(3));
        movingWord.end = Number((movingWord.end + shift).toFixed(3));
      }
    }
  } else {
    // Word moved from elsewhere: fit it locally between prevWord and nextWord
    const minStart = prevWord ? Number((prevWord.end + 0.01).toFixed(3)) : 0;
    const maxEnd = nextWord ? Number((nextWord.start - 0.01).toFixed(3)) : (minStart + dur);

    if (maxEnd >= minStart + 0.04) {
      if (insertBefore) {
        movingWord.end = maxEnd;
        movingWord.start = Number(Math.max(minStart, movingWord.end - dur).toFixed(3));
      } else {
        movingWord.start = minStart;
        movingWord.end = Number(Math.min(maxEnd, movingWord.start + dur).toFixed(3));
      }
    } else {
      movingWord.start = minStart;
      movingWord.end = Number((minStart + Math.max(0.04, dur * 0.5)).toFixed(3));
      // Only nudge words in the immediate target group if needed
      if (nextWord && nextWord.start < movingWord.end + 0.01) {
        const shift = Number((movingWord.end + 0.01 - nextWord.start).toFixed(3));
        for (let j = insertIdx + 1; j < newWords.length; j++) {
          if (!targetGroup.some(tw => tw.id === newWords[j].id)) break;
          newWords[j].start = Number((newWords[j].start + shift).toFixed(3));
          newWords[j].end = Number((newWords[j].end + shift).toFixed(3));
        }
      }
    }
  }

  // Close any gaps between adjacent words in target line so they maintain natural caption flow
  for (let k = 0; k < newWords.length - 1; k++) {
    const curr = newWords[k];
    const nxt = newWords[k + 1];
    const isCurrInTarget = targetGroup.some(w => w.id === curr.id) || curr.id === movingWord.id;
    const isNxtInTarget = targetGroup.some(w => w.id === nxt.id) || nxt.id === movingWord.id;
    if (isCurrInTarget && isNxtInTarget) {
      const gap = nxt.start - curr.end;
      if (gap > 0.18) {
        const shift = Number((gap - 0.08).toFixed(3));
        for (let m = k + 1; m < newWords.length; m++) {
          if (!targetGroup.some(w => w.id === newWords[m].id) && newWords[m].id !== movingWord.id) break;
          newWords[m].start = Number((newWords[m].start - shift).toFixed(3));
          newWords[m].end = Number((newWords[m].end - shift).toFixed(3));
        }
      }
    }
  }

  // Ensure all intervals in newWords strictly satisfy start < end and non-overlapping
  ensureValidIntervals(newWords, duration);

  // Hold the target line together: every word inside it is explicitly joined,
  // so neither a stray full stop nor the clause breaker can part the line the
  // creator just built by hand. A trailing stop on an interior word is dropped
  // as well, since it is now mid-line punctuation nobody spoke.
  const targetGroupWordIds = new Set(targetGroup.map(w => w.id).concat(movingWord.id));
  const wordsInTarget = newWords.filter(w => targetGroupWordIds.has(w.id));
  for (let idx = 0; idx < wordsInTarget.length - 1; idx++) {
    wordsInTarget[idx].text = wordsInTarget[idx].text.replace(/[.!?।]+$/, '');
    wordsInTarget[idx].lineBreak = false;
  }

  const isAtEndOfTargetLine = !nextWord || !targetGroup.some(w => w.id === nextWord.id);
  if (isAtEndOfTargetLine) {
    if (nextWord) movingWord.lineBreak = true;
  } else {
    movingWord.lineBreak = false;
  }

  return newWords;
}

export function moveWordsToLine(
  words: Word[],
  wordIds: string[],
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5,
  duration = 9999
): Word[] {
  const movingWords = words.filter(w => wordIds.includes(w.id));
  if (!movingWords.length) return words;

  if (movingWords.length === 1) {
    return moveSingleWordToLine(words, movingWords[0].id, targetGroupIdx, targetPosition, maxWordsPerLine, duration);
  }

  // If targetPosition targets one of the moving words, abort
  if (typeof targetPosition === 'object' && wordIds.includes(targetPosition.targetWordId)) {
    return words;
  }

  let currentWords = [...words];
  let currentTargetPos = targetPosition;

  for (let i = 0; i < movingWords.length; i++) {
    const wId = movingWords[i].id;
    currentWords = moveSingleWordToLine(currentWords, wId, targetGroupIdx, currentTargetPos, maxWordsPerLine, duration);
    currentTargetPos = { targetWordId: wId, insert: 'after' };
  }

  ensureValidIntervals(currentWords, duration);
  return currentWords;
}

/**
 * Move words out into a line of their own, between two existing lines.
 *
 * Dragging could previously only move a word *into* a line. Aiming at the gap
 * between two of them did nothing useful — the nearest row won — so splitting a
 * long line meant moving words one at a time and then splitting, which is two
 * operations to express one intention.
 *
 * The move itself goes through `moveWordsToLine`, so the timing logic that
 * settles a word into its new neighbours' gap is the tested one rather than a
 * second copy. Only the line break is added here: the word before the run and
 * the last word of the run both close their line, which is exactly what makes
 * the run a line.
 *
 * `afterGroupIdx` of -1 puts the new line above everything.
 */
export function moveWordsToNewLine(
  words: Word[],
  wordIds: string[],
  afterGroupIdx: number,
  maxWordsPerLine = 5,
  duration = 9999
): Word[] {
  const moving = words.filter(w => wordIds.includes(w.id));
  if (!moving.length) return words;

  const groups = groupWords(words, maxWordsPerLine);
  if (afterGroupIdx >= groups.length) return words;

  const moved = afterGroupIdx < 0
    ? moveWordsToLine(words, wordIds, 0, 'start', maxWordsPerLine, duration)
    : moveWordsToLine(words, wordIds, afterGroupIdx, 'end', maxWordsPerLine, duration);

  const movingIds = new Set(wordIds);
  const first = moved.findIndex(w => movingIds.has(w.id));
  let last = first;
  while (last + 1 < moved.length && movingIds.has(moved[last + 1].id)) last += 1;
  if (first === -1) return moved;

  return moved.map((word, index) => {
    if (index === first - 1) return { ...word, lineBreak: true };   // close the line above
    if (index === last) return { ...word, lineBreak: true };        // close the new line
    if (movingIds.has(word.id)) return { ...word, lineBreak: false }; // hold the run together
    return word;
  });
}

export function moveWordToLine(
  words: Word[],
  wordId: string,
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5,
  duration = 9999
): Word[] {
  return moveWordsToLine(words, [wordId], targetGroupIdx, targetPosition, maxWordsPerLine, duration);
}

/** Match a complete spoken word, allowing its trailing punctuation. */
export function matchesCaptionWord(text: string, findText: string, caseSensitive = false): boolean {
  const query = findText.trim();
  if (!query) return false;
  const base = text.replace(/[.!?।,;:—\-]+$/, '');
  return caseSensitive ? base === query : base.toLowerCase() === query.toLowerCase();
}

export function replaceAllOccurrences(words: Word[], findText: string, replaceText: string, caseSensitive = false): Word[] {
  const replacement = replaceText.trim();
  if (!findText.trim() || !replacement) return words;
  return words.map(w => {
    if (!matchesCaptionWord(w.text, findText, caseSensitive)) return w;
    const punct = w.text.match(/([.!?।,;:—\-]+)$/)?.[1] ?? '';
    return { ...w, text: `${replacement}${punct}` };
  });
}

export { STOP_WORDS, HOOK_WORDS } from './pages';

/**
 * Automatically detects and synchronizes Spotlight (⚡ hero word) and Emphasize (★ power words)
 * across caption groups so the video lyrics display and bottom timeline track match 100%.
 */
export function autoDetectHighlights(words: Word[], wordsPerLine = 4): Word[] {
  if (!words || words.length === 0) return [];

  return buildPages(words, wordsPerLine).flatMap(page => {
    const group = page.words;
    if (group.length === 0) return [];

    // An explicit spotlight is the creator's decision; only fill in the stars.
    if (group.some(w => w.spotlight)) {
      return group.map(w => ({ ...w, spotlight: !!w.spotlight, emphasis: !w.spotlight && !!w.emphasis }));
    }

    // Same ranking the renderer uses, so the star the editor shows is the word
    // that actually grows on screen.
    let bestScore = -Infinity;
    let bestIndex = -1;
    group.forEach((w, idx) => {
      const centreBias = Math.abs(idx - (group.length - 1) / 2) * 0.05;
      const score = scoreOf(w) - centreBias;
      if (score > bestScore) { bestScore = score; bestIndex = idx; }
    });
    if (bestIndex === -1) bestIndex = Math.floor((group.length - 1) / 2);

    return group.map((w, idx) => (idx === bestIndex
      ? { ...w, spotlight: true, emphasis: false }
      : { ...w, spotlight: false, emphasis: isSecondaryEmphasis(w) }));
  });
}
