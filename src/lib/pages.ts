import type { Word } from './types';

/**
 * Single source of truth for how words become on-screen caption pages.
 *
 * This module previously existed three times with three different sets of
 * constants: `groupWords` in captions.ts (split at settings.wordsPerLine),
 * `suggest_emphasis` in server/transcription.py (hardcoded 5), and
 * `autoDetectHighlights`. The renderer and the emphasis picker therefore
 * disagreed about where a page started, so the chosen hero word regularly
 * landed on a different page than the one drawn. Everything now calls here.
 */

/** A pause at least this long always ends a page. */
export const PAGE_GAP = 0.22;
/** Pages shorter than this flash on screen; they are merged into a neighbour. */
export const MIN_PAGE_SECONDS = 0.9;
/** How long a page lingers after its last word, before the next page starts. */
export const PAGE_HOLD_SECONDS = 0.12;
/** A word has to reach this to be promoted on its own merits. */
export const HERO_THRESHOLD = 0.55;

export type PageOptions = {
  /**
   * Whether a page must always promote a word.
   *
   * Stacked and single-word lockups are built around one big word, so they
   * promote the best candidate even on a flat line — leaving the hero row empty
   * would collapse the design. Row layouts promote only when a word earns it;
   * forcing one there meant every caption had something shouting in it.
   */
  alwaysPromote?: boolean;
};

export type CaptionPage = {
  id: string;
  words: Word[];
  /**
   * Indices of the words rendered at hero size. Every explicitly spotlighted
   * word is included; with none, at most one automatically chosen word.
   */
  heroIndices: number[];
  /** First hero index, or -1. Anchors the stacked layout. */
  heroIndex: number;
  start: number;
  /** End of the visible page, including hold, clamped to the next page's start. */
  end: number;
};

export const STOP_WORDS = new Set([
  'ke', 'ki', 'ka', 'ko', 'se', 'mein', 'par', 'pe', 'ne', 'aur', 'ya', 'bhi', 'hi', 'to', 'toh',
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'is', 'are', 'was',
  'were', 'it', 'this', 'that', 'these', 'those', 'am', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'but', 'if', 'then', 'else', 'when', 'up', 'down', 'out', 'off', 'over', 'under',
  'ye', 'yeh', 'woh', 'kuch', 'kar', 'raha', 'rahi', 'rahe', 'karna', 'karne'
]);

export const HOOK_WORDS = new Set([
  'step', 'rule', 'secret', 'trick', 'hack', 'point', 'formula', 'part', 'tip', 'lesson', 'method',
  'best', 'worst', 'free', 'viral', 'huge', 'biggest', 'never', 'always', 'stop', 'wait',
  'easy', 'fast', 'simple', 'crazy', 'insane', 'magic', 'important', 'great', 'bold',
  'sabse', 'bada', 'badi', 'bade', 'asli', 'kamaal', 'bawal', 'sach', 'pakka', 'bilkul',
  'shandaar', 'shaandaar', 'dhyaan', 'zaruri', 'zaroori', 'sahi', 'khatarnak', 'ekdam',
  'power', 'super', 'money', 'crore', 'lakh', 'success', 'growth', 'master', 'hero'
]);

const clean = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

const endsSentence = (text: string) => /[.!?।]$/.test(text.trim());

/**
 * Split into pages: pauses, sentence ends, and the words-per-page ceiling.
 *
 * This is also the editor's line model — `splitLineAtWord`, `mergeLines` and the
 * drag-to-line operations all reason about these exact groups — so it stays a
 * pure split. A page that is too short to read is handled by holding it on
 * screen longer in `buildPages`, never by silently undoing the user's own line
 * structure.
 */
function splitRuns(words: Word[], maxWords: number): Word[][] {
  const runs: Word[][] = [];
  let current: Word[] = [];
  for (const word of words) {
    const prev = current.at(-1);
    if (prev && (current.length >= maxWords || word.start - prev.end > PAGE_GAP || endsSentence(prev.text))) {
      runs.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length) runs.push(current);
  return runs;
}

/**
 * Ranking used to choose the word that carries a page.
 *
 * `autoDetectHighlights` in captions.ts calls this too. It previously kept its
 * own copy of this formula and its own word lists, so the editor's auto-detect
 * button could promote a different word than the renderer actually enlarged.
 */
export function scoreOf(word: Word): number {
  const text = clean(word.text);
  if (STOP_WORDS.has(text)) return -Infinity;
  const isHook = HOOK_WORDS.has(text) || /\d/.test(word.text);
  let score = word.emphasisScore ?? 0.5;
  if (word.emphasis) score += 0.35;
  if (isHook) score += 0.45;
  if (text.length >= 4) score += 0.1;
  return score;
}

/** A word worth a secondary star, once the page already has its hero. */
export function isSecondaryEmphasis(word: Word): boolean {
  const text = clean(word.text);
  if (STOP_WORDS.has(text)) return false;
  return !!word.emphasis || (word.emphasisScore ?? 0) >= 0.72 || HOOK_WORDS.has(text) || /\d/.test(word.text);
}

/**
 * Which words are rendered at hero size.
 *
 * An explicit `spotlight` is an editorial decision, so every spotlighted word is
 * honoured — mark two and you get two. Only the *automatic* pick is budgeted to
 * one per page, because an unbudgeted detector will happily shout half a
 * sentence and then nothing reads as emphasised at all.
 *
 * With no spotlight, the auto pick is kept off both ends of a page of three or
 * more: the three-tier lockup needs words above *and* below its hero.
 */
function pickHeroes(words: Word[], alwaysPromote: boolean): number[] {
  if (!words.length) return [];
  const explicit = words.flatMap((w, i) => (w.spotlight ? [i] : []));
  if (explicit.length) return explicit;

  let index = -1;
  let best = -Infinity;
  words.forEach((word, i) => {
    const score = scoreOf(word);
    if (score > best) { best = score; index = i; }
  });

  if (best < HERO_THRESHOLD) {
    if (!alwaysPromote) return [];
    // A lockup built around a hero still needs one, even on a flat line.
    if (index === -1) index = Math.floor(words.length / 2);
  }
  return [words.length >= 3 ? Math.max(1, Math.min(index, words.length - 2)) : index];
}

/**
 * The contiguous run of hero words that forms the centre row of a stacked
 * lockup. Spotlights that sit apart from it stay in the supporting rows, where
 * they keep the accent colour but not the hero size.
 */
export function heroRun(page: CaptionPage): { start: number; end: number } | null {
  if (!page.heroIndices.length) return null;
  const start = page.heroIndices[0];
  let end = start;
  while (page.heroIndices.includes(end + 1)) end += 1;
  return { start, end };
}

/**
 * Nudge a split made purely by the words-per-page ceiling, when it would strand
 * the page's strongest word on an edge.
 *
 * Splits caused by a pause, a sentence end, or the user's own line edits are
 * left alone — those carry meaning. An arbitrary "we hit five words" cut does
 * not, and moving it by one word is what lets the three-tier lockup put the
 * emphatic word in the middle instead of clamping to a weaker neighbour.
 */
function rebalanceCountSplits(runs: Word[][], maxWords: number): Word[][] {
  if (maxWords < 3) return runs;
  const out = runs.map(run => [...run]);
  for (let i = 0; i < out.length - 1; i++) {
    const run = out[i];
    const next = out[i + 1];
    if (run.length !== maxWords) continue;                       // not a ceiling cut
    const last = run.at(-1)!;
    if (next[0].start - last.end > PAGE_GAP || endsSentence(last.text)) continue;
    if (scoreOf(last) < 0.7) continue;                           // nothing worth moving for
    if (scoreOf(last) <= Math.max(...run.slice(0, -1).map(scoreOf))) continue;
    if (run.length - 1 < 2 || next.length + 1 > maxWords) continue;
    next.unshift(run.pop()!);                                    // give it a row above and below
  }
  return out;
}

export function buildPages(words: Word[], wordsPerPage: number, options: PageOptions = {}): CaptionPage[] {
  if (!words.length) return [];
  const maxWords = Math.max(1, Math.round(wordsPerPage));
  const runs = maxWords === 1 ? splitRuns(words, 1) : rebalanceCountSplits(splitRuns(words, maxWords), maxWords);

  return runs.map((run, i) => {
    const start = run[0].start;
    const nextStart = runs[i + 1]?.[0].start ?? Infinity;
    // Hold a page long enough to read. A two-word page after a pause used to
    // flash for a couple of frames; it now lingers into the silence that
    // follows it, but never into the next page.
    const wanted = Math.max(run.at(-1)!.end + PAGE_HOLD_SECONDS, start + MIN_PAGE_SECONDS);
    return {
      id: run[0].id ?? `page-${i}`,
      words: run,
      ...(() => {
        const heroIndices = maxWords === 1 ? [0] : pickHeroes(run, !!options.alwaysPromote);
        return { heroIndices, heroIndex: heroIndices[0] ?? -1 };
      })(),
      start,
      end: Math.max(start + 1 / 60, Math.min(wanted, nextStart)),
    };
  });
}

/**
 * Back-compatible shape for callers that only need the word groups.
 * Kept so existing editor code (line merges, search, navigation) is unchanged.
 */
export function groupWords(words: Word[], maxWords: number): Word[][] {
  return buildPages(words, maxWords).map(page => page.words);
}

/** Which page is on screen at `time`, or -1. */
export function pageAt(pages: CaptionPage[], time: number): number {
  return pages.findIndex(page => time >= page.start && time < page.end);
}
