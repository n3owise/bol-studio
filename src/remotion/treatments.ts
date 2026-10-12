/**
 * Per-template visual treatment, as data.
 *
 * The canvas renderer decided every one of these with an inline `if
 * (settings.template === ...)` chain scattered through the draw loop, which is
 * why adding a template meant touching eight places. A template is now a row in
 * this table; the layout components read it and nothing else.
 */
export type CaptionLayout = 'stack' | 'rows' | 'single';
export type FontRole = 'display' | 'serif' | 'condensed' | 'montserrat' | 'stix';

export type Treatment = {
  layout: CaptionLayout;
  /** Premiere single text layers animate as one phrase, not separately spoken words. */
  groupText?: boolean;
  /** Arrangement inside the caption; the creator still controls its position. */
  stackAlign?: 'stagger' | 'center' | 'left' | 'right' | 'inline';
  /** Gap between tiers, in units of the main word size. */
  tierGap?: number;
  /** Whole-caption framing, separate from a highlighted-word pill. */
  panel?: 'solid' | 'outline';
  /** Static display angle; entrances remain independently animated. */
  tilt?: number;
  /** Three source text fields keep their centered tiers even without a spotlight. */
  threeTier?: boolean;
  /** Multipliers on the base font size from settings.fontSize. */
  heroScale: number;
  subScale: number;
  heroWeight: number;
  subWeight: number;
  heroFont: FontRole;
  subFont: FontRole;
  heroItalic?: boolean;
  /** Italic on the supporting rows, as composition 2's outer lines are. */
  subItalic?: boolean;
  /**
   * Per-row weight overrides for the stacked lockup. Composition 2 sets its
   * three lines to ExtraBold / SemiBold serif / SemiBold, all at one size — the
   * contrast is weight and face, not scale, so `subWeight` alone cannot express it.
   */
  prefixWeight?: number;
  suffixWeight?: number;
  /** Uppercase the hero word regardless of the global uppercase setting. */
  uppercaseHero?: boolean;
  /** Glow radius as a fraction of the hero font size. */
  glow?: number;
  /** Drop shadow behind every word. */
  shadow?: 'none' | 'soft' | 'hard';
  /** Black outline behind supporting words, for legibility over bright footage. */
  outline?: boolean;
  /** Solid rounded plate behind the hero (or the currently spoken word). */
  pill?: 'none' | 'hero' | 'active';
  /** Ellipse drawn around the hero: a clean loop, or a hand-drawn dashed one. */
  ring?: 'solid' | 'dashed';
  /** Continuous micro-rotation on the hero. */
  jitter?: boolean;
  /** A single hop on the word currently being spoken. */
  hop?: boolean;
  /**
   * Vertical white-to-accent ramp on the hero, matching the Gradient Ramp
   * effect the Premiere presets use. Supporting words never take it — that is
   * what keeps the hero readable as the hero.
   */
  gradientRamp?: boolean;
  /**
   * Which entrance the words use. The nine Premiere presets share one look —
   * Montserrat Black, Color Control, Glow, Gradient Ramp — and differ only in
   * how the type arrives, so the motion is the whole distinction between them.
   */
  enter?:
    | 'rise' | 'pop' | 'drop' | 'spread' | 'swing' | 'wipe' | 'flip' | 'slide' | 'cascade'
    | 'typewriter' | 'zoom' | 'blurIn' | 'stamp' | 'flicker';
  /**
   * How words leave. The page already fades out; this adds the movement, so a
   * caption exits with the same intent it entered with instead of every
   * template dissolving the same way.
   */
  exit?: 'fade' | 'fall' | 'lift' | 'shrink' | 'blur' | 'wipe';
};

const base: Treatment = {
  layout: 'rows',
  heroScale: 1.29,
  subScale: 1,
  heroWeight: 800,
  subWeight: 700,
  heroFont: 'display',
  subFont: 'display',
  shadow: 'soft',
  outline: true,
  pill: 'none',
};

export const treatments: Record<string, Treatment> = {
  'welcome-stack': {
    ...base, enter: 'rise', exit: 'lift', layout: 'stack', heroScale: 1.85, subScale: 0.88,
    heroWeight: 900, uppercaseHero: true, glow: 0.55, shadow: 'soft',
  },
  karaoke: { ...base, enter: 'rise', exit: 'fade', pill: 'active', heroScale: 1.18 },
  editorial: { ...base, layout: 'stack', stackAlign: 'left', tierGap: 0.12, subFont: 'serif', subWeight: 400, subScale: 0.65, enter: 'typewriter', exit: 'blur', heroFont: 'serif', heroItalic: true, heroScale: 1.8, heroWeight: 500, outline: false, shadow: 'soft' },
  bounce: { ...base, enter: 'pop', exit: 'shrink', pill: 'active', heroScale: 1.24, hop: true },
  kinetic: { ...base, enter: 'zoom', exit: 'shrink', layout: 'single', heroScale: 2.1, subScale: 2.1, heroWeight: 900, uppercaseHero: true, glow: 0.35 },
  neon: { ...base, layout: 'single', enter: 'flicker', exit: 'blur', glow: 0.8, heroScale: 1.3, outline: false, shadow: 'none' },
  'glow-script': { ...base, layout: 'stack', stackAlign: 'center', tierGap: 0.16, subScale: 0.7, enter: 'spread', exit: 'lift', heroFont: 'serif', heroItalic: true, glow: 0.7, heroScale: 2.2, heroWeight: 500, outline: false },
  scribble: { ...base, layout: 'stack', stackAlign: 'inline', subScale: 0.75, enter: 'swing', exit: 'fall', ring: 'dashed', heroScale: 1.55 },
  'soft-focus': { ...base, layout: 'stack', stackAlign: 'right', tierGap: 0.18, subFont: 'serif', subScale: 0.85, enter: 'blurIn', exit: 'lift', heroFont: 'serif', heroItalic: true, heroScale: 1.6, heroWeight: 400, subWeight: 400, outline: false, shadow: 'soft' },
  'double-trouble': { ...base, layout: 'single', enter: 'stamp', exit: 'shrink', heroFont: 'condensed', subFont: 'condensed', ring: 'solid', heroScale: 1.3, uppercaseHero: true },
  'bubble-highlight': { ...base, layout: 'stack', stackAlign: 'center', tierGap: 0.12, panel: 'solid', subScale: 0.75, enter: 'drop', exit: 'fall', pill: 'none', heroScale: 1.65 },
  mumbai: { ...base, stackAlign: 'right', tierGap: 0.08, enter: 'slide', exit: 'wipe', layout: 'stack', heroFont: 'condensed', heroScale: 1.7, subScale: 0.86, uppercaseHero: true, heroWeight: 900, shadow: 'hard' },
  'editing-school': { ...base, layout: 'stack', stackAlign: 'inline', panel: 'outline', subScale: 0.7, enter: 'stamp', exit: 'shrink', pill: 'hero', heroScale: 1.32, uppercaseHero: true },
  'kalakar-shadow': { ...base, stackAlign: 'left', tierGap: 0.08, enter: 'drop', exit: 'fall', layout: 'stack', heroScale: 2.2, subScale: 0.68, shadow: 'hard', heroWeight: 900, uppercaseHero: true },
  'pop-up': { ...base, layout: 'stack', tilt: -4, tierGap: 0.04, subScale: 0.72, enter: 'pop', exit: 'fall', heroScale: 2, jitter: true, uppercaseHero: true },
};

/**
 * The nine Premiere text presets.
 *
 * Read out of the .mogrt files: every one is a single Montserrat Black text
 * layer with the same three effects — Color Control, Glow, Gradient Ramp — at
 * 209/246/282pt on a 3840x2160 comp. Only the animation differs between them,
 * so they share this base and override `enter`.
 */
const mogrtBase: Treatment = {
  ...base,
  layout: 'stack',
  groupText: false,
  heroFont: 'montserrat',
  subFont: 'montserrat',
  heroScale: 1.85,
  subScale: 0.82,
  heroWeight: 900,
  subWeight: 800,
  uppercaseHero: true,
  glow: 0.7,
  gradientRamp: true,
  shadow: 'soft',
  outline: false,
};

const mogrtTreatments: Record<string, Treatment> = {
  'mogrt-rise': { ...mogrtBase, enter: 'rise', exit: 'lift' },
  'mogrt-pop': { ...mogrtBase, enter: 'pop', exit: 'shrink', heroScale: 1.55 },
  'mogrt-drop': { ...mogrtBase, enter: 'drop', exit: 'fall' },
  'mogrt-spread': { ...mogrtBase, enter: 'spread', exit: 'blur', heroScale: 1.35 },
  'mogrt-swing': { ...mogrtBase, enter: 'swing', exit: 'fall' },
  // Parda reveals left to right on the way in. Wiping back out again reads as
  // the reveal running in reverse, so it just fades — no exit movement.
  'mogrt-wipe': { ...mogrtBase, enter: 'wipe', exit: 'fade' },
  'mogrt-flip': { ...mogrtBase, enter: 'flip', exit: 'shrink' },
  'mogrt-slide': { ...mogrtBase, enter: 'slide', exit: 'wipe' },
  // The one multi-line preset: three text fields in Premiere, so a three-tier
  // lockup here, and the only one that mixes italic with a serif accent.
  /**
   * Premiere composition 2, read from its After Effects project:
   *   line 1  Montserrat ExtraBold Italic
   *   line 2  STIX Two Text SemiBold   <- a serif, and the coloured line
   *   line 3  Montserrat SemiBold Italic
   * All three at 282pt, so the lines are the same size and the contrast comes
   * entirely from face, weight and colour. Three Color Control effects drive
   * the three lines independently, which is what `accentSecondary` restores.
   */
  'mogrt-triple': {
    ...mogrtBase,
    layout: 'stack',
    groupText: false,
    threeTier: false,
    enter: 'cascade',
    exit: 'lift',
    heroFont: 'stix',
    heroWeight: 600,
    heroItalic: false,
    uppercaseHero: false,
    heroScale: 1.85,
    subFont: 'montserrat',
    subScale: 0.82,
    subItalic: true,
    prefixWeight: 800,
    suffixWeight: 600,
    glow: 0.45,
  },
};

Object.assign(treatments, mogrtTreatments);

export const treatmentFor = (template: string): Treatment => treatments[template] ?? base;

/** Keep complete Premiere text fields intact; only word-title styles split each word. */
export const captionWordsPerPage = (template: string, wordsPerLine: number) => {
  const treatment = treatmentFor(template);
  return treatment.layout === 'single' && !treatment.groupText ? 1 : wordsPerLine;
};

/**
 * Every treatment field the renderer actually reads. `ring` was declared here
 * and consumed nowhere for a while, which quietly reduced two templates to plain
 * rows; a test asserts this list stays in sync with the components.
 */
export const SUPPORTED_TREATMENT_KEYS = [
  'layout', 'stackAlign', 'tierGap', 'panel', 'tilt', 'groupText', 'threeTier', 'heroScale', 'subScale', 'heroWeight', 'subWeight', 'heroFont', 'subFont',
  'heroItalic', 'uppercaseHero', 'glow', 'shadow', 'outline', 'pill', 'ring', 'jitter', 'hop',
  'gradientRamp', 'enter', 'exit',
] as const;
