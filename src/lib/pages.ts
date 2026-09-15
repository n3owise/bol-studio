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

/**
 * The most words any caption page may show, whatever the settings say.
 *
 * Past about seven words a page stops being a caption and becomes a paragraph:
 * the viewer reads instead of glancing, and the hero word has nothing left to
 * stand out from. The slider, the server's bound and the page splitter all
 * agree on this number, and `splitRuns` enforces it even when a stored project
 * asks for more, so an old project cannot render a wall of text.
 */
export const MAX_WORDS_PER_PAGE = 7;

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
 * A gap this long is a breath the speaker actually took, and a page always ends
 * there. Shorter gaps are only a hint — the clause breaker weighs them against
 * the words on either side, because a caption that splits mid-phrase reads
 * worse than one that splits a fifth of a second early.
 */
export const HARD_GAP = 0.45;

/** Roughly how many words a line should aim for, when nothing else decides. */
const TARGET_WORDS = 5;

/**
 * Words that lean on what comes after them, so a page must not end on one.
 *
 * "There is something in captions of" strands "of" with nothing to attach to;
 * the reader holds it until the next page arrives.
 */
const BINDS_FORWARD = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'for', 'with', 'from', 'into', 'about',
  'my', 'your', 'our', 'his', 'her', 'their', 'its',
  'very', 'more', 'most', 'such', 'each', 'every',
  'ek', 'bahut', 'bohot', 'sabse', 'apna', 'apne', 'apni', 'mera', 'meri', 'mere',
  'tera', 'teri', 'tere', 'uska', 'uske', 'uski', 'iska', 'iske', 'iski',
  'kitna', 'kitni', 'kitne', 'thoda', 'thodi', 'saare', 'saari', 'sara',
]);

/**
 * Words that lean on what came before them, so a page must not start on one.
 *
 * Hindi postpositions follow their noun — "school ko" is one unit — and a
 * copula closes the clause it belongs to. A page beginning "hain." is the
 * tail of the previous page left behind on its own.
 */
const BINDS_BACKWARD = new Set([
  'ko', 'ka', 'ki', 'ke', 'se', 'mein', 'me', 'par', 'pe', 'ne', 'tak', 'bhi', 'wala', 'wali', 'wale',
  'hai', 'hain', 'tha', 'thi', 'thay', 'hoga', 'hogi', 'honge', 'hota', 'hote', 'hoti',
  'raha', 'rahi', 'rahe', 'gaya', 'gayi', 'gaye', 'diya', 'liya', 'kiya', 'chahiye',
  'sakta', 'sakte', 'sakti', 'hoon', 'hun', 'ho',
]);

/**
 * Words that open a new clause, so a page is better started on one.
 *
 * "big aur" / "baaki saare words" splits the joint in the wrong place: "aur"
 * belongs to what it introduces, not to what it followed.
 */
const CLAUSE_STARTERS = new Set([
  'aur', 'ya', 'lekin', 'magar', 'kyunki', 'kyuki', 'phir', 'toh', 'agar', 'jab', 'tab',
  'isliye', 'matlab', 'ab', 'but', 'and', 'because', 'if', 'when', 'then', 'now',
]);

/**
 * Words that close a clause, so a page is better ended just after one.
 *
 * A postposition finishes its phrase, and a Hindi clause ends on its verb —
 * "dekh lo", "hote hain". Breaking there lands on a joint rather than inside a
 * phrase.
 */
const CLAUSE_ENDERS = new Set([
  'ko', 'ka', 'ki', 'ke', 'se', 'mein', 'me', 'par', 'pe', 'ne', 'tak',
  'hai', 'hain', 'tha', 'thi', 'hoga', 'hogi', 'honge', 'hota', 'hote', 'hoti',
  'lo', 'do', 'diya', 'liya', 'kiya', 'karo', 'gaya', 'gayi', 'gaye', 'chahiye',
  'sakta', 'sakte', 'sakti', 'hoon', 'hun',
]);

/**
 * How bad it is to end a page after `prev` and start the next one on `next`.
 *
 * Negative is good. The numbers are a preference ordering, not a measurement:
 * a real breath (`gap`) and a finished clause pull a break towards them, a
 * word that binds across the boundary pushes it away, and nothing is absolute
 * — a strong signal can outvote a weak one, which is the point. Hinglish ASR
 * punctuation is unreliable enough that a full stop is a strong hint here
 * rather than the hard rule it used to be.
 */
function breakCost(prev: Word, next: Word, gap: number): number {
  const before = clean(prev.text);
  const after = clean(next.text);
  let cost = 0;
  cost -= Math.min(gap, HARD_GAP) * 12;          // a pause is where a break belongs
  if (endsSentence(prev.text)) cost -= 2;
  if (BINDS_FORWARD.has(before)) cost += 7;      // never strand "of", "the", "uske"
  if (BINDS_BACKWARD.has(after)) cost += 7;      // never open on "ko", "hain"
  if (CLAUSE_STARTERS.has(after)) cost -= 5;     // "aur ..." starts the line
  if (CLAUSE_ENDERS.has(before)) cost -= 3;      // "... ko" / "... hote hain" ends it
  return cost;
}

/** How bad a line of this many words is on its own. */
function lineCost(length: number): number {
  // Short pages are penalised steeply rather than linearly. A clause joint can
  // be found almost anywhere — "Ewa ko" ends a phrase perfectly well — so
  // without this the breaker happily shaves two-word pages off the front of
  // every sentence. A page has to earn being short.
  if (length === 1) return 6;                    // a one-word page reads as a stutter
  if (length === 2) return 3.2;
  return Math.abs(length - TARGET_WORDS) * 0.7;
}

/**
 * Choose the breaks inside one segment so the lines fall on clause joints.
 *
 * Greedy left-to-right filling is what produced "...is something in captions
 * of" and a page holding only "hain." — it takes the first legal break rather
 * than the best one, and by the time the bad break is visible it has already
 * been committed. This weighs every legal arrangement of the segment and keeps
 * the cheapest, so an earlier break is accepted when it pays for itself later.
 */
function breakSegment(words: Word[], maxWords: number): Word[][] {
  const n = words.length;
  if (n <= 1) return n ? [words] : [];

  // best[i] = cheapest way to lay out the first i words, ending a line at i.
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(0);
  best[0] = 0;

  for (let end = 1; end <= n; end++) {
    for (let start = Math.max(0, end - maxWords); start < end; start++) {
      if (best[start] === Infinity) continue;
      // The creator joined these two words; the breaker may not part them.
      if (start > 0 && words[start - 1].lineBreak === false) continue;
      let cost = best[start] + lineCost(end - start);
      if (start > 0) {
        const prev = words[start - 1];
        const next = words[start];
        cost += breakCost(prev, next, Math.max(0, next.start - prev.end));
      }
      if (cost < best[end]) { best[end] = cost; from[end] = start; }
    }
  }

  const bounds: number[] = [];
  for (let at = n; at > 0; at = from[at]) bounds.unshift(at);
  const runs: Word[][] = [];
  let start = 0;
  for (const end of bounds) { runs.push(words.slice(start, end)); start = end; }
  return runs;
}

/**
 * Split into pages at breaths, then at the best clause joints between them.
 *
 * This is also the editor's line model — `splitLineAtWord`, `mergeLines` and the
 * drag-to-line operations all reason about these exact groups — so it stays a
 * pure split. A page that is too short to read is handled by holding it on
 * screen longer in `buildPages`, never by silently undoing the user's own line
 * structure.
 */
function splitRuns(words: Word[], requested: number): Word[][] {
  // The ceiling is enforced here rather than trusted from settings: a project
  // saved before this cap existed, or one whose drag-to-line edits raised its
  // own chunk size, would otherwise still draw a paragraph per page.
  const maxWords = Math.max(1, Math.min(requested, MAX_WORDS_PER_PAGE));
  if (maxWords === 1) return words.map(word => [word]);

  // A real breath, or the creator's own decision, is an unconditional break.
  // Everything finer is decided by breakSegment, which can see both sides of
  // each candidate. `lineBreak === false` is the creator saying these two words
  // belong together, and outranks even a pause.
  const segments: Word[][] = [];
  let current: Word[] = [];
  for (const word of words) {
    const prev = current.at(-1);
    const forced = prev?.lineBreak === true;
    const joined = prev?.lineBreak === false;
    if (prev && (forced || (!joined && word.start - prev.end > HARD_GAP))) {
      segments.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length) segments.push(current);

  return segments.flatMap(segment => breakSegment(segment, maxWords));
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
 * Which single word on a page shows its emoji, if any.
 *
 * The recogniser annotates every word it can match, which is far too many to
 * draw: a line reading "money 💰 fast ⚡ money 💰" is what makes automatic emoji
 * look cheap. One per page keeps it rare enough to land.
 *
 * It is never the hero. The hero is already the loudest thing on the page —
 * it is bigger, it carries the accent colour, and on a stacked template it has
 * a row to itself — so hanging an emoji off it adds nothing and crowds the one
 * element the whole layout is built around. Put it on a supporting word and the
 * page gains a second point of interest instead of doubling the first.
 */
export function pickEmoji(page: CaptionPage): { index: number; emoji: string } | null {
  let bestIndex = -1;
  let bestScore = -Infinity;
  page.words.forEach((word, index) => {
    if (!word.emoji || page.heroIndices.includes(index)) return;
    const score = word.emojiScore ?? 0;
    if (score > bestScore) { bestScore = score; bestIndex = index; }
  });
  if (bestIndex === -1) return null;
  return { index: bestIndex, emoji: page.words[bestIndex].emoji! };
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
  const maxWords = Math.max(1, Math.min(Math.round(wordsPerPage), MAX_WORDS_PER_PAGE));
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
