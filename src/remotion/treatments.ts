/**
 * Per-template visual treatment, as data.
 *
 * The canvas renderer decided every one of these with an inline `if
 * (settings.template === ...)` chain scattered through the draw loop, which is
 * why adding a template meant touching eight places. A template is now a row in
 * this table; the layout components read it and nothing else.
 */
export type CaptionLayout = 'stack' | 'rows' | 'single';
export type FontRole = 'display' | 'serif' | 'condensed';

export type Treatment = {
  layout: CaptionLayout;
  /** Multipliers on the base font size from settings.fontSize. */
  heroScale: number;
  subScale: number;
  heroWeight: number;
  subWeight: number;
  heroFont: FontRole;
  subFont: FontRole;
  heroItalic?: boolean;
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
    ...base, layout: 'stack', heroScale: 1.85, subScale: 0.88,
    heroWeight: 900, uppercaseHero: true, glow: 0.55, shadow: 'soft',
  },
  karaoke: { ...base, pill: 'active', heroScale: 1.18 },
  editorial: { ...base, heroFont: 'serif', heroItalic: true, heroScale: 1.32, heroWeight: 500, outline: false, shadow: 'soft' },
  bounce: { ...base, pill: 'active', heroScale: 1.24, hop: true },
  kinetic: { ...base, layout: 'single', heroScale: 2.1, subScale: 2.1, heroWeight: 900, uppercaseHero: true, glow: 0.35 },
  neon: { ...base, glow: 0.8, heroScale: 1.3, outline: false, shadow: 'none' },
  'glow-script': { ...base, heroFont: 'serif', heroItalic: true, glow: 0.7, heroScale: 1.36, heroWeight: 500, outline: false },
  scribble: { ...base, ring: 'dashed', heroScale: 1.3 },
  'soft-focus': { ...base, heroFont: 'serif', heroItalic: true, heroScale: 1.22, heroWeight: 400, subWeight: 400, outline: false, shadow: 'soft' },
  'double-trouble': { ...base, heroFont: 'condensed', subFont: 'condensed', ring: 'solid', heroScale: 1.3, uppercaseHero: true },
  'bubble-highlight': { ...base, pill: 'hero', heroScale: 1.2 },
  mumbai: { ...base, layout: 'stack', heroFont: 'condensed', heroScale: 1.7, subScale: 0.86, uppercaseHero: true, heroWeight: 900, shadow: 'hard' },
  'editing-school': { ...base, pill: 'hero', heroScale: 1.32, uppercaseHero: true },
  'kalakar-shadow': { ...base, layout: 'stack', heroScale: 1.75, subScale: 0.88, shadow: 'hard', heroWeight: 900, uppercaseHero: true },
  'pop-up': { ...base, heroScale: 1.34, jitter: true, uppercaseHero: true },
};

export const treatmentFor = (template: string): Treatment => treatments[template] ?? base;

/**
 * Every treatment field the renderer actually reads. `ring` was declared here
 * and consumed nowhere for a while, which quietly reduced two templates to plain
 * rows; a test asserts this list stays in sync with the components.
 */
export const SUPPORTED_TREATMENT_KEYS = [
  'layout', 'heroScale', 'subScale', 'heroWeight', 'subWeight', 'heroFont', 'subFont',
  'heroItalic', 'uppercaseHero', 'glow', 'shadow', 'outline', 'pill', 'ring', 'jitter', 'hop',
] as const;
