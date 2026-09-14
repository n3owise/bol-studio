import { Easing } from 'remotion';

/**
 * Single source of truth for caption motion and typography.
 *
 * Timings are expressed in seconds and converted with `useVideoConfig().fps`
 * at the call site, so the same composition is correct at 30, 60 or 120 fps.
 * Nothing below may be inlined into a component.
 */
export const theme = {
  ease: {
    /** Entrances. Fast attack, long glide — the curve motion designers default to. */
    out: Easing.bezier(0.22, 1, 0.36, 1),
    /** Moves and settles. */
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    /** Exits only. */
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    /** Hero word landing: overshoots once, settles, never wobbles. */
    hero: { damping: 13, stiffness: 170, mass: 0.65 },
    /** Supporting words: no visible overshoot. */
    sub: { damping: 22, stiffness: 190, mass: 0.5 },
  },
  /** Entrance envelopes, in seconds. The hero is slower and travels further. */
  timing: {
    heroIn: 0.22,
    subIn: 0.14,
    /**
     * The Premiere presets are display animations: they travel further and take
     * longer than a plain caption entrance, which is what makes each one
     * readable as its own preset rather than a variation of the last.
     */
    presetIn: 0.42,
    /** Exits are faster than entrances. */
    pageOut: 0.13,
  },
  motion: {
    /** Peak blur at frame 0 of a word's entrance, in px at a 720px-wide frame. */
    heroBlur: 9,
    subBlur: 5,
    /** Vertical travel, in px at a 720px-wide frame. */
    heroRise: 14,
    subRise: 9,
    heroFrom: 0.62,
    subFrom: 0.84,
  },
  type: {
    display: '"DM Sans", "Noto Sans Devanagari", system-ui, sans-serif',
    serif: 'Georgia, "Noto Serif Devanagari", "Noto Sans Devanagari", "Times New Roman", serif',
    condensed: 'Oswald, "Archivo Narrow", "Noto Sans Devanagari", "Arial Narrow", sans-serif',
    montserrat: '"Montserrat", "Noto Sans Devanagari", "DM Sans", system-ui, sans-serif',
    /** The serif on the middle line of Premiere composition 2. */
    stix: '"STIX Two Text", "Noto Serif Devanagari", "Noto Sans Devanagari", Georgia, serif',
    /** Heavy grotesques ship loose; display sizes need tightening. */
    heroTracking: '-0.035em',
    subTracking: '-0.01em',
    heroLineHeight: 0.86,
    subLineHeight: 1.04,
    /** Devanagari carries matras above and below; a Latin-tight line clips them. */
    heroLineHeightIndic: 1.12,
    subLineHeightIndic: 1.3,
  },
  colors: {
    text: '#ffffff',
    stroke: 'rgba(0, 0, 0, 0.87)',
    heroShadow: 'rgba(0, 0, 0, 0.45)',
  },
  layout: {
    /** Fraction of frame width the lockup may occupy before it is scaled down. */
    maxWidth: 0.86,
    /** Keep captions clear of platform UI. */
    safeMargin: 0.06,
    /** Gap between the three tiers, as a fraction of hero size. */
    tierGap: 0.1,
  },
} as const;

/** Reference frame width all px motion constants are authored against. */
export const BASE_WIDTH = 720;
