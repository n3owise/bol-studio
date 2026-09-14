import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme, BASE_WIDTH } from './theme';
import type { Treatment } from './treatments';
import { getContrastColor } from '../lib/captions';

export type WordRole = 'hero' | 'sub';

type Props = {
  text: string;
  /** Frame, relative to the page, on which this word is spoken. */
  enterFrame: number;
  role: WordRole;
  /** Rendered font size in px. */
  size: number;
  color: string;
  treatment: Treatment;
  /** Frame width, used to scale motion constants authored at BASE_WIDTH. */
  frameWidth: number;
  /** 0 disables all animation; 1 is the designed amount. */
  motion: number;
  strokeColor?: string;
  strokeWidth?: number;
  fontFamily: string;
  pill?: boolean;
  pillColor?: string;
  /** Devanagari matras sit above and below the line and need more room. */
  devanagari?: boolean;
};

/**
 * One word, entering on the frame it is actually spoken.
 *
 * Four channels move together — opacity, blur, rise and scale. The lone fade
 * the canvas renderer used is what made captions read as "web animation"
 * rather than something cut in an editor; blur in particular is most of the
 * perceived smoothness, and the scale comes off a spring so the hero lands
 * with a real overshoot instead of the old invisible 1.5%.
 */
export const CaptionWord: React.FC<Props> = ({
  text, enterFrame, role, size, color, treatment, frameWidth, motion,
  strokeColor, strokeWidth, fontFamily, pill, pillColor, devanagari,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isHero = role === 'hero';
  const k = frameWidth / BASE_WIDTH;
  const d = frame - enterFrame;

  const still = motion <= 0;
  const durationInFrames = Math.max(2, Math.round((isHero ? theme.timing.heroIn : theme.timing.subIn) * fps));
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  const opacity = still ? (d >= 0 ? 1 : 0) : interpolate(
    d, [0, durationInFrames * 0.4], [0, 1], { easing: theme.ease.out, ...clamp },
  );

  const blurPx = still ? 0 : interpolate(
    d,
    [0, durationInFrames * 0.55, durationInFrames],
    [(isHero ? theme.motion.heroBlur : theme.motion.subBlur) * k * motion, 1.4 * k * motion, 0],
    { easing: theme.ease.out, ...clamp },
  );

  const rise = still ? 0 : interpolate(
    d, [0, durationInFrames], [(isHero ? theme.motion.heroRise : theme.motion.subRise) * k * motion, 0],
    { easing: theme.ease.out, ...clamp },
  );

  const progress = still ? 1 : spring({
    frame: d,
    fps,
    config: isHero ? theme.spring.hero : theme.spring.sub,
    durationInFrames: Math.round(durationInFrames * 1.7),
  });
  const from = isHero ? theme.motion.heroFrom : theme.motion.subFrom;
  const scale = still ? 1 : interpolate(progress, [0, 1], [1 - (1 - from) * motion, 1]);

  // How far through its entrance the word is, used to sweep the ring on.
  const drawn = still ? 1 : interpolate(
    d, [0, durationInFrames * 1.4], [0, 1], { easing: theme.ease.out, ...clamp },
  );

  // A single hop on the word being spoken. Without it `bounce` rendered
  // identically to `karaoke` — same pill, same everything.
  const hop = treatment.hop && pill && !still
    ? -Math.sin(Math.min(1, d / (0.25 * fps)) * Math.PI) * size * 0.18
    : 0;

  // Idle micro-rotation for templates that ask for it; frame-derived, so it is
  // identical in preview and in the render.
  const jitter = treatment.jitter && isHero && !still ? Math.sin(d / fps * 11) * 1.4 : 0;

  const glow = treatment.glow && isHero
    ? `0 0 ${size * treatment.glow * 0.18}px ${color}, 0 0 ${size * treatment.glow * 0.5}px ${color}88`
    : '';
  const shadow = treatment.shadow === 'hard'
    ? `${size * 0.03}px ${size * 0.045}px 0 rgba(24,12,0,0.5), ${size * 0.06}px ${size * 0.09}px 0 rgba(24,12,0,0.28)`
    : treatment.shadow === 'soft'
      ? `0 ${size * 0.03}px ${size * 0.08}px ${theme.colors.heroShadow}`
      : '';
  const textShadow = [glow, shadow].filter(Boolean).join(', ') || undefined;

  const stroke = treatment.outline && !pill
    ? `${(strokeWidth ?? (isHero ? 0 : 2.2)) * k}px ${strokeColor ?? theme.colors.stroke}`
    : undefined;

  // A ring is drawn around the hero word for the templates that ask for one.
  // It sweeps on with the word rather than appearing whole.
  const ring = treatment.ring && isHero ? (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        left: `${-size * 0.16}px`,
        top: `${-size * 0.1}px`,
        width: `calc(100% + ${size * 0.32}px)`,
        height: `calc(100% + ${size * 0.2}px)`,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <ellipse
        cx="50"
        cy="50"
        rx="49"
        ry="46"
        fill="none"
        stroke={color}
        strokeWidth={Math.max(2, size * 0.055)}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"

        pathLength={100}
        style={{
          strokeDasharray: treatment.ring === 'dashed' ? `${size * 0.09} ${size * 0.075}` : '100',
          strokeDashoffset: treatment.ring === 'dashed' ? 0 : 100 * (1 - drawn),
          opacity: treatment.ring === 'dashed' ? drawn : 1,
          transform: `rotate(${-4 + jitter}deg)`,
          transformOrigin: 'center',
        }}
      />
    </svg>
  ) : null;

  const inner = (
    <span
      style={{
        display: 'inline-block',
        opacity,
        filter: blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
        transform: `translate3d(0, ${(rise + hop).toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${jitter.toFixed(2)}deg)`,
        willChange: 'transform, opacity, filter',
        fontFamily,
        fontSize: size,
        fontWeight: isHero ? treatment.heroWeight : treatment.subWeight,
        fontStyle: isHero && treatment.heroItalic ? 'italic' : 'normal',
        lineHeight: devanagari
          ? (isHero ? theme.type.heroLineHeightIndic : theme.type.subLineHeightIndic)
          : (isHero ? theme.type.heroLineHeight : theme.type.subLineHeight),
        letterSpacing: isHero ? theme.type.heroTracking : theme.type.subTracking,
        // A pill is a solid plate of the accent; its text has to be legible on
        // whatever accent the creator picked, not a hardcoded near-black.
        color: pill ? getContrastColor(pillColor ?? '#ffffff') : color,
        WebkitTextStroke: stroke,
        paintOrder: 'stroke fill',
        textShadow: pill ? undefined : textShadow,
        background: pill ? pillColor : undefined,
        borderRadius: pill ? size * 0.18 : undefined,
        padding: pill ? `${size * 0.06}px ${size * 0.16}px` : undefined,
        whiteSpace: 'pre',
      }}
    >
      {text}
    </span>
  );

  if (!ring) return inner;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      {ring}
      {inner}
    </span>
  );
};
