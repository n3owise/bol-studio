import { Easing } from 'remotion';

/**
 * One theme for the landing page's motion pieces, taken from DESIGN.md: the
 * dark ground, the single green accent and the two type faces. Components read
 * colours, easings and springs from here and never inline their own.
 */
export const reelTheme = {
  colors: {
    bg: '#050507',
    bgAlt: '#111215',
    surface: '#191b22',
    accent: '#2ee368',
    accentText: '#052e16',
    teal: '#22d3c5',
    text: '#f4f4f6',
    textDim: '#a1a1aa',
    glow: 'rgba(46, 227, 104, 0.45)',
  },
  fonts: {
    display: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
} as const;

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
