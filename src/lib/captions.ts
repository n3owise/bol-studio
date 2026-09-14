import type { Settings, Word } from './types';
export const templates = [
  { id: 'welcome-stack', name: 'Hero Entry', tag: 'SIGNATURE · 3-TIER LOCKUP', accent: '#9de52e', description: 'Hero word centered & glowing, with top-left & bottom-right words.' },
  { id: 'karaoke', name: 'Sur Taal', tag: 'SMOOTH · HIGHLIGHT', accent: '#c2a1ff', description: 'Har syllable ke saath smooth flowing highlight.' },
  { id: 'editorial', name: 'Shayari', tag: 'CLEAN · RISE', accent: '#f6d595', description: 'Kam shabdon mein gehra aur shaandaar asar.' },
  { id: 'bounce', name: 'Chulbul Pop', tag: 'PLAYFUL · SPRING', accent: '#ff8bb5', description: 'Words ko thoda playful, bubbly bounce do.' },
  { id: 'kinetic', name: 'Bawaal', tag: 'ONE WORD · ZOOM', accent: '#ff825c', description: 'Har ek lafz ka apna full-screen hero moment.' },
  { id: 'neon', name: 'Chamkeela', tag: 'GLOW · PULSE', accent: '#72e6ff', description: 'Raat ke andhere mein bhi chamakne wala glow.' },
  { id: 'glow-script', name: 'Jadoo Script', tag: 'SCRIPT · GLOW', accent: '#51e6b0', description: 'Rang-birangi handwritten script ka glowing touch.' },
  { id: 'scribble', name: 'Golmaal Orbit', tag: 'DOODLE · MOTION', accent: '#baff4a', description: 'Khaas shabd ke ird-gird hand-drawn ghera.' },
  { id: 'soft-focus', name: 'Sukoon', tag: 'SERIF · LIGHT', accent: '#f0f0f0', description: 'Quiet serif style ek soft, elegant spotlight ke saath.' },
  { id: 'double-trouble', name: 'Jodi No. 1', tag: 'DOUBLE · OUTLINE', accent: '#ff3e36', description: 'Double weight typography, solid punchy rhythm.' },
  { id: 'bubble-highlight', name: 'Tashan Highlight', tag: 'PILL · COLOR', accent: '#54be91', description: 'Key words ko soft colored pill mein highlight karo.' },
  { id: 'mumbai', name: 'Bambaiya', tag: 'CONDENSED · SCRIPT', accent: '#f3f52f', description: 'Bold condensed caps aur street-style handwritten line.' },
  { id: 'editing-school', name: 'Ustaad Box', tag: 'BOX · POP', accent: '#ff9000', description: 'Ek lafz, ek bright popping badge card.' },
  { id: 'kalakar-shadow', name: 'Rangeela Kalakar', tag: 'DEPTH · SHADOW', accent: '#ff9d00', description: 'Warm drop shadow ke saath layered kalakar typography.' },
  { id: 'pop-up', name: 'Patakha Pop', tag: 'WORD · FLASH', accent: '#16d943', description: 'Emphasized shabd seedha screen pe jump karega.' },
];
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

export function subtitleText(words: Word[], max: number, format: 'srt' | 'vtt') {
  const stamp = (s: number) => { const ms = Math.max(0, Math.round(s*1000)); return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}${format === 'srt' ? ',' : '.'}${String(ms%1000).padStart(3,'0')}`; };
  return (format === 'vtt' ? 'WEBVTT\n\n' : '') + groupWords(words,max).map((g,i) => `${format === 'srt' ? `${i+1}\n` : ''}${stamp(g[0].start)} --> ${stamp(g.at(-1)!.end)}\n${g.map(w=>w.text).join(' ')}\n`).join('\n');
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

export function splitLineAtWord(words: Word[], wordId: string): Word[] {
  const i = words.findIndex(w => w.id === wordId);
  if (i === -1) return words;
  return words.map((w, idx) => {
    if (idx !== i) return w;
    const clean = w.text.trim();
    if (/[.!?।]$/.test(clean)) return w;
    return { ...w, text: `${clean}.` };
  });
}

export function mergeLines(words: Word[], firstGroupLastWordId: string): Word[] {
  const i = words.findIndex(w => w.id === firstGroupLastWordId);
  if (i === -1 || i === words.length - 1) return words;
  const newWords = words.map(w => ({ ...w }));
  newWords[i].text = newWords[i].text.replace(/[.!?।]+$/, '');
  const gap = newWords[i + 1].start - newWords[i].end;
  if (gap > 0.22) {
    const shift = gap - 0.12;
    for (let j = i + 1; j < newWords.length; j++) {
      newWords[j].start = Number(Math.max(newWords[j - 1].end + 0.005, newWords[j].start - shift).toFixed(3));
      newWords[j].end = Number(Math.max(newWords[j].start + 0.05, newWords[j].end - shift).toFixed(3));
      if (j < newWords.length - 1 && newWords[j + 1].start - newWords[j].end > 0.4) break;
    }
  }
  return newWords;
}

export function moveWordToPreviousLine(words: Word[], wordId: string, maxWordsPerLine = 4): Word[] {
  const targetIdx = words.findIndex(w => w.id === wordId);
  if (targetIdx <= 0) return words;

  const groups = groupWords(words, maxWordsPerLine);
  const groupIdx = groups.findIndex(g => g.some(w => w.id === wordId));
  if (groupIdx <= 0) return words;

  const prevGroup = groups[groupIdx - 1];
  const lastWordOfPrevGroup = prevGroup[prevGroup.length - 1];
  const prevEndIdx = words.findIndex(w => w.id === lastWordOfPrevGroup.id);
  if (prevEndIdx === -1) return words;

  const newWords = words.map(w => ({ ...w }));

  // Remove line break punctuation between previous group end and current target word
  for (let i = prevEndIdx; i < targetIdx; i++) {
    newWords[i].text = newWords[i].text.replace(/[.!?।]+$/, '');
    const gap = newWords[i + 1].start - newWords[i].end;
    if (gap > 0.22) {
      const shift = gap - 0.12;
      newWords[i + 1].start = Number(Math.max(newWords[i].end + 0.005, newWords[i + 1].start - shift).toFixed(3));
      newWords[i + 1].end = Number(Math.max(newWords[i + 1].start + 0.05, newWords[i + 1].end - shift).toFixed(3));
    }
  }

  // Put a sentence ending on targetIdx so words after it break to the next line
  if (targetIdx < newWords.length - 1) {
    const clean = newWords[targetIdx].text.trim();
    if (!/[.!?।]$/.test(clean)) {
      newWords[targetIdx].text = `${clean}.`;
    }
  }

  return newWords;
}

export function moveWordToNextLine(words: Word[], wordId: string): Word[] {
  const targetIdx = words.findIndex(w => w.id === wordId);
  if (targetIdx <= 0) return words;

  const newWords = words.map(w => ({ ...w }));

  // The word before targetIdx should now end the line with punctuation
  const prevClean = newWords[targetIdx - 1].text.trim();
  if (!/[.!?।]$/.test(prevClean)) {
    newWords[targetIdx - 1].text = `${prevClean}.`;
  }

  // Remove any line break punctuation on the target word itself so it flows into the next line
  newWords[targetIdx].text = newWords[targetIdx].text.replace(/[.!?।]+$/, '');

  return newWords;
}

function moveSingleWordToLine(
  words: Word[],
  wordId: string,
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5
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
      const clean = newWords[priorWordIdx].text.trim();
      if (!/[.!?।]$/.test(clean)) {
        newWords[priorWordIdx].text = `${clean}.`;
      }
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
  ensureValidIntervals(newWords, 9999);

  // Ensure that within the target group, only the final word ends with sentence punctuation,
  // preventing groupWords from splitting the line prematurely.
  const targetGroupWordIds = new Set(targetGroup.map(w => w.id).concat(movingWord.id));
  const wordsInTarget = newWords.filter(w => targetGroupWordIds.has(w.id));
  for (let idx = 0; idx < wordsInTarget.length - 1; idx++) {
    wordsInTarget[idx].text = wordsInTarget[idx].text.replace(/[.!?।]+$/, '');
  }

  const isAtEndOfTargetLine = !nextWord || !targetGroup.some(w => w.id === nextWord.id);
  if (isAtEndOfTargetLine) {
    if (nextWord) {
      const clean = movingWord.text.trim();
      if (!/[.!?।]$/.test(clean)) {
        movingWord.text = `${clean}.`;
      }
    }
  } else {
    movingWord.text = movingWord.text.replace(/[.!?।]+$/, '');
  }

  return newWords;
}

export function moveWordsToLine(
  words: Word[],
  wordIds: string[],
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5
): Word[] {
  const movingWords = words.filter(w => wordIds.includes(w.id));
  if (!movingWords.length) return words;

  if (movingWords.length === 1) {
    return moveSingleWordToLine(words, movingWords[0].id, targetGroupIdx, targetPosition, maxWordsPerLine);
  }

  // If targetPosition targets one of the moving words, abort
  if (typeof targetPosition === 'object' && wordIds.includes(targetPosition.targetWordId)) {
    return words;
  }

  let currentWords = [...words];
  let currentTargetPos = targetPosition;

  for (let i = 0; i < movingWords.length; i++) {
    const wId = movingWords[i].id;
    currentWords = moveSingleWordToLine(currentWords, wId, targetGroupIdx, currentTargetPos, maxWordsPerLine);
    currentTargetPos = { targetWordId: wId, insert: 'after' };
  }

  ensureValidIntervals(currentWords, 9999);
  return currentWords;
}

export function moveWordToLine(
  words: Word[],
  wordId: string,
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5
): Word[] {
  return moveWordsToLine(words, [wordId], targetGroupIdx, targetPosition, maxWordsPerLine);
}

export function replaceAllOccurrences(words: Word[], findText: string, replaceText: string, caseSensitive = false): Word[] {
  const query = findText.trim();
  if (!query) return words;
  return words.map(w => {
    const matchPunct = w.text.match(/([.!?।,;:—\-]+)$/);
    const punct = matchPunct ? matchPunct[1] : '';
    const baseText = punct ? w.text.slice(0, -punct.length) : w.text;

    const matches = caseSensitive
      ? baseText === query
      : baseText.toLowerCase() === query.toLowerCase();

    if (matches) {
      return {
        ...w,
        text: `${replaceText}${punct}`,
      };
    }
    return w;
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
