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
  /** Per-row weight override, for lockups whose lines differ in weight. */
  weight?: number;
  /** Per-row italic override. */
  italic?: boolean;
  /**
   * The creator's typography adjustments, layered over the template's.
   *
   * `lineHeightScale` multiplies and `trackingAdd` is added, so 1 and 0 leave
   * the template exactly as designed — including its separate Devanagari line
   * height, which a raw override would have discarded.
   */
  lineHeightScale?: number;
  trackingAdd?: number;
  underline?: boolean;
  strikethrough?: boolean;
  /** 0 while the page is on screen, ramping to 1 across its closing frames. */
  exitProgress?: number;
};

/**
 * One text object, entering on its first spoken frame. Premiere presets pass
 * the complete source text field; other templates pass individual words.
 *
 * Four channels move together — opacity, blur, rise and scale. The lone fade
 * the canvas renderer used is what made captions read as "web animation"
 * rather than something cut in an editor; blur in particular is most of the
 * perceived smoothness, and the scale comes off a spring so the hero lands
 * with a real overshoot instead of the old invisible 1.5%.
 */
export const CaptionWord: React.FC<Props> = ({
  text, enterFrame, role, size, color, treatment, frameWidth, motion,
  strokeColor, strokeWidth, fontFamily, pill, pillColor, devanagari, weight, italic,
  lineHeightScale = 1, trackingAdd = 0, underline, strikethrough,
  exitProgress = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isHero = role === 'hero';
  const k = frameWidth / BASE_WIDTH;
  const d = frame - enterFrame;

  const still = motion <= 0;
  const durationInFrames = Math.max(2, Math.round((isHero ? theme.timing.heroIn : theme.timing.subIn) * fps));
  const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

  const opacity = still
    ? (d >= 0 ? 1 : 0)
    : d < 0
      ? 0
      : interpolate(
          d, [0, Math.max(1, durationInFrames * 0.35)], [0, 1],
          { easing: theme.ease.out, ...clamp },
        );

  const blurPx = still || d < 0 ? 0 : interpolate(
    d,
    [0, durationInFrames * 0.55, durationInFrames],
    [(isHero ? theme.motion.heroBlur : theme.motion.subBlur) * k * motion, 1.4 * k * motion, 0],
    { easing: theme.ease.out, ...clamp },
  );

  const rise = still || d < 0 ? 0 : interpolate(
    d, [0, durationInFrames], [(isHero ? theme.motion.heroRise : theme.motion.subRise) * k * motion, 0],
    { easing: theme.ease.out, ...clamp },
  );

  const progress = still || d < 0 ? 1 : spring({
    frame: d,
    fps,
    config: isHero ? theme.spring.hero : theme.spring.sub,
    durationInFrames: Math.round(durationInFrames * 1.7),
  });
  const from = isHero ? theme.motion.heroFrom : theme.motion.subFrom;
  const scale = still || d < 0 ? 1 : interpolate(progress, [0, 1], [1 - (1 - from) * motion, 1]);

  // How far through its entrance the word is, used to sweep the ring on.
  const drawn = still || d < 0 ? (d < 0 ? 0 : 1) : interpolate(
    d, [0, durationInFrames * 1.4], [0, 1], { easing: theme.ease.out, ...clamp },
  );

  // A single hop on the word being spoken. Without it `bounce` rendered
  // identically to `karaoke` — same pill, same everything.
  const hop = treatment.hop && pill && !still && d >= 0
    ? -Math.sin(Math.min(1, d / (0.25 * fps)) * Math.PI) * size * 0.18
    : 0;

  // The nine Premiere presets share one look and differ only in how the type
  // arrives, so the entrance variant is the whole distinction between them.
  // `p` runs 0 to 1 across a slightly longer window than the base entrance, so
  // these reads as a deliberate move rather than a flick.
  const enterFrames = Math.max(2, Math.round(theme.timing.presetIn * fps));
  const p = still || d < 0 ? (d < 0 ? 0 : 1) : interpolate(
    d, [0, enterFrames], [0, 1], { easing: theme.ease.out, ...clamp },
  );
  const away = 1 - p;                      // 1 at the start of the entrance, 0 once landed
  // Typing runs at a steady rate. Easing it out makes the last characters
  // arrive almost together, which reads as a wipe rather than as typing.
  const typed = still || d < 0 ? (d < 0 ? 0 : 1) : Math.min(1, d / enterFrames);
  const m = still ? 0 : motion;
  const variant = treatment.enter;

  const enterY = !variant ? 0
    : variant === 'rise' ? away * size * 0.6 * m
    : variant === 'drop' ? -away * size * 0.66 * m
    : variant === 'swing' ? away * size * 0.24 * m
    : variant === 'cascade' ? away * size * 0.42 * m
    : 0;

  const enterX = !variant ? 0
    : variant === 'slide' ? -away * size * 0.9 * m
    : 0;

  const enterRotate = !variant ? 0
    : variant === 'swing' ? -away * 14 * m
    : variant === 'drop' ? away * 4 * m
    : 0;

  // A 3D flip needs perspective on an ancestor, applied on the wrapper below.
  const enterRotateX = variant === 'flip' ? away * 88 * m : 0;

  const enterScale = !variant ? 1
    : variant === 'pop' ? 1 - away * 0.72 * m
    : variant === 'spread' ? 1 + away * 0.08 * m
    // zoom and stamp arrive oversized and settle down onto the line.
    : variant === 'zoom' ? 1 + away * 0.75 * m
    : variant === 'stamp' ? 1 + away * 0.95 * m
    : variant === 'blurIn' ? 1 + away * 0.06 * m
    : 1;

  // Extra blur for the entrances that are built around focus pulling in.
  const enterBlur = !variant ? 0
    : variant === 'blurIn' ? away * 18 * k * m
    : variant === 'stamp' ? away * 6 * k * m
    : 0;

  // A neon tube striking: two quick blips before it holds.
  const flicker = variant === 'flicker' && !still && d >= 0 && p < 1
    ? (p < 0.18 ? 0.25 : p < 0.3 ? 0.9 : p < 0.42 ? 0.35 : p < 0.55 ? 1 : 0.75)
    : 1;

  // Letters start apart and close into their tracking.
  // Expand the painted word, not its layout width: animated letter spacing
  // remeasured the lockup every frame and moved otherwise stationary rows.
  const spreadScale = variant === 'spread' ? 1 + away * 0.48 * m : 1;

  // A left-to-right reveal, no movement at all.
  const enterClip = variant === 'wipe' && p < 1
    ? `inset(-35% ${(away * 100).toFixed(2)}% -35% -12%)`
    : variant === 'typewriter' && typed < 1
      // Quantised to character boundaries: a smooth sweep reads as a wipe, a
      // stepped one reads as typing.
      ? `inset(-35% ${(100 - Math.ceil(typed * text.length) / Math.max(1, text.length) * 100).toFixed(2)}% -35% -8%)`
      : undefined;

  // Idle micro-rotation for templates that ask for it; frame-derived, so it is
  // identical in preview and in the render.
  const jitter = treatment.jitter && isHero && !still && d >= 0 ? Math.sin(d / fps * 11) * 1.4 : 0;

  // Only the hero takes the ramp. Applying it to every word was what made
  // whole captions read as one flat colour with no hierarchy left.
  // Leaving. The page fade handles opacity; these add the movement, so a
  // caption exits with the same intent it entered with.
  const x = Math.min(1, Math.max(0, exitProgress));
  const exitKind = treatment.exit;
  const exitY = !exitKind || still ? 0
    : exitKind === 'fall' ? x * size * 0.4 * m
    : exitKind === 'lift' ? -x * size * 0.32 * m
    : 0;
  const exitScale = !exitKind || still ? 1
    : exitKind === 'shrink' ? 1 - x * 0.3 * m
    : exitKind === 'lift' ? 1 + x * 0.06 * m
    : 1;
  const exitRotate = exitKind === 'fall' && !still ? x * 5 * m : 0;
  const exitBlur = exitKind === 'blur' && !still ? x * 10 * k * m : 0;
  const exitClip = exitKind === 'wipe' && !still && x > 0
    ? `inset(-35% -12% -35% ${(x * 100).toFixed(2)}%)`
    : undefined;

  const isGradient = !!treatment.gradientRamp && isHero && !pill;
  const gradientBg = isGradient
    ? `linear-gradient(180deg, #ffffff 0%, ${color} 35%, ${color} 100%)`
    : undefined;

  const glow = treatment.glow && isHero && d >= 0
    ? `0 0 ${size * treatment.glow * 0.18}px ${color}, 0 0 ${size * treatment.glow * 0.5}px ${color}88`
    : '';
  const shadow = treatment.shadow === 'hard'
    ? `${size * 0.03}px ${size * 0.045}px 0 rgba(24,12,0,0.5), ${size * 0.06}px ${size * 0.09}px 0 rgba(24,12,0,0.28)`
    : treatment.shadow === 'soft'
      ? `0 ${size * 0.03}px ${size * 0.08}px ${theme.colors.heroShadow}`
      : '';
  const textShadow = isGradient || pill ? undefined : ([glow, shadow].filter(Boolean).join(', ') || undefined);

  const glowFilter = isGradient && treatment.glow && d >= 0
    ? `drop-shadow(0 0 ${size * treatment.glow * 0.16}px ${color}) drop-shadow(0 0 ${size * treatment.glow * 0.42}px ${color}88)`
    : '';
  const blurTotal = blurPx + enterBlur + exitBlur;
  const totalFilter = [
    blurTotal > 0.05 ? `blur(${blurTotal.toFixed(2)}px)` : '',
    glowFilter,
  ].filter(Boolean).join(' ') || undefined;

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
        opacity: opacity * flicker,
        filter: totalFilter,
        transform: [
          `translate3d(${enterX.toFixed(2)}px, ${(rise + enterY + hop + exitY).toFixed(2)}px, 0)`,
          `scale(${(scale * enterScale * exitScale).toFixed(4)})`,
          `scaleX(${spreadScale.toFixed(4)})`,
          enterRotateX ? `rotateX(${enterRotateX.toFixed(2)}deg)` : '',
          `rotate(${(jitter + enterRotate + exitRotate).toFixed(2)}deg)`,
        ].filter(Boolean).join(' '),
        transformOrigin: variant === 'swing' ? 'left bottom' : variant === 'flip' ? 'center bottom' : 'center',
        clipPath: exitClip ?? enterClip,
        willChange: 'transform, opacity, filter',
        fontFamily,
        fontSize: size,
        fontWeight: weight ?? (isHero ? treatment.heroWeight : treatment.subWeight),
        fontStyle: (italic ?? (isHero ? treatment.heroItalic : treatment.subItalic)) ? 'italic' : 'normal',
        lineHeight: (devanagari
          ? (isHero ? theme.type.heroLineHeightIndic : theme.type.subLineHeightIndic)
          : (isHero ? theme.type.heroLineHeight : theme.type.subLineHeight)) * lineHeightScale,
        // Keep layout tracking fixed; entrance transforms cannot displace
        // neighboring words. The creator's offset still adjusts the template.
        letterSpacing: `calc(${isHero ? theme.type.heroTracking : theme.type.subTracking} + ${trackingAdd}em)`,
        textDecorationLine: [underline && 'underline', strikethrough && 'line-through']
          .filter(Boolean).join(' ') || undefined,
        textDecorationThickness: (underline || strikethrough) ? `${Math.max(1, size * 0.045)}px` : undefined,
        color: isGradient ? undefined : (pill ? getContrastColor(pillColor ?? '#ffffff') : color),
        ...(isGradient
          ? {
              backgroundImage: gradientBg,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }
          : {}),
        WebkitTextStroke: stroke,
        paintOrder: 'stroke fill',
        textShadow,
        backgroundColor: pill ? pillColor : undefined,
        borderRadius: pill ? size * 0.18 : undefined,
        padding: pill ? `${size * 0.06}px ${size * 0.16}px` : undefined,
        whiteSpace: 'pre',
      }}
    >
      {text}
    </span>
  );

  const needsWrapper = !!ring || variant === 'flip';
  if (!needsWrapper) return inner;
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        perspective: variant === 'flip' ? size * 3.2 : undefined,
      }}
    >
      {ring}
      {inner}
    </span>
  );
};
