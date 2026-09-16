import React, { useLayoutEffect, useRef, useState } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from './theme';
import { treatmentFor, type FontRole } from './treatments';
import { CaptionWord } from './CaptionWord';
import { pickEmoji, heroRun, type CaptionPage as Page } from '../lib/pages';
import type { Settings, Word } from '../lib/types';
import captionFonts from '../lib/caption-fonts.json';

type Props = {
  page: Page;
  settings: Settings;
  width: number;
  height: number;
  /** Length of this page's Sequence, used for the exit fade. */
  pageFrames: number;
};

type Box = { width: number; height: number };
const ZERO: Box = { width: 0, height: 0 };

/**
 * Measure laid-out rows so the lockup can be scaled to fit and positioned by
 * its true centre. `useLayoutEffect` runs before paint, so measurements land in
 * the same commit both in the Player and in a headless render — no
 * `delayRender` handle to leak or time out.
 */
function useRowMeasure(count: number) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [boxes, setBoxes] = useState<Box[]>(() => Array.from({ length: count }, () => ZERO));
  useLayoutEffect(() => {
    const next = Array.from({ length: count }, (_, i) => {
      const el = refs.current[i];
      return el ? { width: el.offsetWidth, height: el.offsetHeight } : ZERO;
    });
    setBoxes(prev => (prev.length === next.length
      && prev.every((b, i) => b.width === next[i].width && b.height === next[i].height) ? prev : next));
  });
  const set = (i: number) => (el: HTMLDivElement | null) => { refs.current[i] = el; };
  return { set, boxes };
}

function rgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';

const FONT_STACKS: Record<FontRole, string> = {
  display: theme.type.display,
  serif: theme.type.serif,
  condensed: theme.type.condensed,
  montserrat: theme.type.montserrat,
  stix: theme.type.stix,
};

const OFFERED_FONTS = new Set(captionFonts.map(f => f.family));

const fontStack = (role: FontRole, custom?: string) =>
  (custom && OFFERED_FONTS.has(custom) ? `"${custom}", ${FONT_STACKS[role]}` : FONT_STACKS[role]);

export const CaptionPage: React.FC<Props> = ({ page, settings, width, height, pageFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const treatment = treatmentFor(settings.template);
  // 0 = prefix row, 1 = hero row, 2 = suffix row (single/rows layouts use index 1 only).
  const { set, boxes } = useRowMeasure(3);

  const base = settings.fontSize * width / 720;
  // The template's proportion unless the creator has set the highlighted word's
  // size outright. Both sizes used to come from one value, so raising the
  // caption size raised the highlighted word with it.
  const heroSize = (settings.heroFontSize ?? settings.fontSize * treatment.heroScale) * width / 720;
  // Two or three spotlighted words side by side at full hero size overflow the
  // frame, and the fit-to-width scale then shrinks the whole lockup until the
  // hero stops reading as a hero. Step the size down instead.
  const heroCount = Math.max(1, page.heroIndices.length);
  const heroRowSize = heroCount > 1 ? heroSize * (heroCount === 2 ? 0.78 : 0.66) : heroSize;
  const subSize = base * treatment.subScale;
  const textColor = settings.textColor || theme.colors.text;
  const accent = settings.accent;

  // Exits are faster than entrances, and the whole page leaves together —
  // animating words out individually reads as fussy.
  const outFrames = Math.max(2, Math.round(theme.timing.pageOut * fps));
  const pageOpacity = settings.motion <= 0 ? 1 : interpolate(
    frame, [pageFrames - outFrames, pageFrames], [1, 0],
    { easing: theme.ease.in, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  // Words move on the way out as well as the way in. The exit runs a little
  // longer than the opacity fade so the movement is visible rather than being
  // over before the page has finished dimming.
  const exitFrames = Math.max(3, Math.round(outFrames * 1.6));
  const exitProgress = settings.motion <= 0 ? 0 : interpolate(
    frame, [pageFrames - exitFrames, pageFrames], [0, 1],
    { easing: theme.ease.in, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const enterFrameFor = (word: Word) => Math.max(0, Math.round((word.start - page.start) * fps));

  // At most one emoji a page, never on the hero — see pickEmoji.
  const emojiPick = pickEmoji(page);

  /**
   * Apply the creator's casing.
   *
   * `textCase` wins over the older `uppercase` flag and the template's own
   * uppercaseHero, because it is the more specific instruction — someone who
   * asked for sentence case did not mean "except on templates that shout".
   * Sentence and title case are applied per word, which is all the renderer
   * sees; a true sentence case would need the line, and a caption line is
   * rarely a sentence.
   */
  const applyCase = (text: string, upper: boolean) => {
    switch (settings.textCase) {
      case 'upper': return text.toLocaleUpperCase();
      case 'lower': return text.toLocaleLowerCase();
      case 'title': return text.replace(/^\p{L}/u, c => c.toLocaleUpperCase());
      case 'sentence': return text.toLocaleLowerCase();
      case 'none': return text;
      default: return upper ? text.toLocaleUpperCase() : text;
    }
  };

  const renderWord = (
    word: Word,
    role: 'hero' | 'sub',
    size: number,
    pill: boolean,
    row: 'prefix' | 'hero' | 'suffix' = role === 'hero' ? 'hero' : 'prefix',
  ) => {
    const upper = settings.uppercase || (role === 'hero' && treatment.uppercaseHero);
    // Two colours, two jobs: `accent` marks the hero and anything the editor
    // spotlighted, `textColor` carries every supporting word. A gradient
    // template ramps the hero towards the accent but leaves the rest alone.
    // Colouring every word from one value is what flattened whole captions into
    // a single shade with no hierarchy left.
    const accented = (role === 'hero' || !!word.spotlight) && treatment.pill !== 'active';
    // Composition 2 colours each of its three lines separately. The middle line
    // takes the accent; the third line may take its own colour when one is set,
    // and otherwise matches the first.
    const wordColor = accented
      ? accent
      : (row === 'suffix' && settings.accentSecondary) ? settings.accentSecondary : textColor;
    const rowWeight = row === 'prefix' ? treatment.prefixWeight
      : row === 'suffix' ? treatment.suffixWeight
        : undefined;
    const shown = applyCase(word.text, !!upper);
    // Appended to the word rather than placed as its own element: it then
    // inherits the word's entrance, exit and fit-to-width scaling for free, and
    // cannot drift out of sync with the text it belongs to.
    const withEmoji = emojiPick && page.words[emojiPick.index]?.id === word.id
      ? `${shown} ${emojiPick.emoji}`
      : shown;
    return (
      <CaptionWord
        key={word.id}
        text={withEmoji}
        enterFrame={enterFrameFor(word)}
        role={role}
        size={size}
        color={wordColor}
        treatment={treatment}
        frameWidth={width}
        motion={settings.motion}
        strokeColor={settings.strokeColor}
        strokeWidth={settings.strokeWidth}
        fontFamily={fontStack(role === 'hero' ? treatment.heroFont : treatment.subFont, settings.fontFamily)}
        weight={settings.bold ? 900 : rowWeight}
        exitProgress={exitProgress}
        italic={settings.italic ?? (role === 'hero' ? treatment.heroItalic : treatment.subItalic)}
        lineHeightScale={settings.lineHeight ?? 1}
        trackingAdd={settings.letterSpacing ?? 0}
        underline={settings.underline}
        strikethrough={settings.strikethrough}
        pill={pill}
        pillColor={accent}
        devanagari={devanagari}
      />
    );
  };

  const wordGap = base * 0.26;
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: wordGap,
    whiteSpace: 'nowrap',
  };

  // Row tucks were tuned against Latin x-heights. Devanagari needs the rows
  // further apart or the matras of one row collide with the next.
  const devanagari = page.words.some(w => /[\u0900-\u097F]/.test(w.text));

  const now = page.start + frame / fps;
  const activeIndex = page.words.findIndex(w => now >= w.start && now < w.end);

  const isStack = treatment.layout === 'stack' && page.words.length >= 1;

  // Tuck the supporting rows against the hero, the way the reference lockups do.
  const tuckTop = devanagari ? 0 : heroSize * 0.04;
  const tuckBottom = devanagari ? -heroSize * 0.04 : heroSize * 0.1;

  let content: React.ReactNode;
  let boxWidth: number;
  let boxHeight: number;

  if (isStack) {
    const run = heroRun(page) ?? { start: 0, end: 0 };
    const heroes = page.words.slice(run.start, run.end + 1);
    const prefix = page.words.slice(0, run.start);
    const suffix = page.words.slice(run.end + 1);
    const hasPrefix = prefix.length > 0;
    const hasSuffix = suffix.length > 0;

    // 1. Spotlight word is the big word.
    // 2. Remaining words on the left side of timeline -> top-left of spotlight word.
    // 3. Words coming after spotlight word -> bottom-right of spotlight word.
    // 4. Words read left-to-right, and the entire lockup is centered horizontally.
    content = (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 'max-content',
        }}
      >
        {hasPrefix && (
          <div
            ref={set(0)}
            style={{
              ...rowStyle,
              alignSelf: 'flex-start',
              marginBottom: -tuckTop,
            }}
          >
            {prefix.map(w => renderWord(w, 'sub', subSize, false, 'prefix'))}
          </div>
        )}
        <div
          ref={set(1)}
          style={{
            ...rowStyle,
            alignSelf: !hasPrefix && hasSuffix ? 'flex-start' : hasPrefix && !hasSuffix ? 'flex-end' : 'center',
          }}
        >
          {heroes.map(w => renderWord(w, 'hero', heroRowSize, treatment.pill === 'hero'))}
        </div>
        {hasSuffix && (
          <div
            ref={set(2)}
            style={{
              ...rowStyle,
              alignSelf: 'flex-end',
              marginTop: -tuckBottom,
            }}
          >
            {suffix.map(w => renderWord(w, 'sub', subSize, false, 'suffix'))}
          </div>
        )}
      </div>
    );

    const [pre, heroBox, suf] = boxes;
    boxWidth = Math.max(pre.width, heroBox.width, suf.width) || heroBox.width || (base * 5);
    const preH = hasPrefix ? Math.max(0, pre.height - tuckTop) : 0;
    const sufH = hasSuffix ? Math.max(0, suf.height - tuckBottom) : 0;
    boxHeight = preH + heroBox.height + sufH || (base * 2);
  } else if (treatment.layout === 'single') {
    content = (
      <div ref={set(1)} style={{ ...rowStyle, width: 'fit-content' }}>
        {page.words.map(w => renderWord(w, 'hero', heroSize, treatment.pill !== 'none'))}
      </div>
    );
    boxWidth = boxes[1].width || (base * 4);
    boxHeight = boxes[1].height || base;
  } else {
    const justify = settings.align === 'left' ? 'flex-start' : settings.align === 'right' ? 'flex-end' : 'center';
    content = (
      <div
        ref={set(1)}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: wordGap, rowGap: base * 0.35,
          justifyContent: justify, maxWidth: width * theme.layout.maxWidth,
        }}
      >
        {page.words.map((w, i) => {
          const isHero = page.heroIndices.includes(i);
          const pill = treatment.pill === 'hero' ? isHero : treatment.pill === 'active' ? i === activeIndex : false;
          return renderWord(w, isHero ? 'hero' : 'sub', isHero ? heroRowSize : subSize, pill);
        })}
      </div>
    );
    boxWidth = boxes[1].width || (base * 5);
    boxHeight = boxes[1].height || base;
  }

  const posX = settings.positionX ?? 50;
  const posY = settings.position ?? 70;

  const maxWidth = width * theme.layout.maxWidth;
  const fit = boxWidth > maxWidth && boxWidth > 0 ? maxWidth / boxWidth : 1;

  const safe = Math.min(width, height) * theme.layout.safeMargin;
  const scaledWidth = boxWidth * fit;
  const scaledHeight = boxHeight * fit;

  const targetCenterX = width * (posX / 100);
  const targetCenterY = height * (posY / 100);
  const centerX = Math.max(safe + scaledWidth / 2, Math.min(width - safe - scaledWidth / 2, targetCenterX));
  const centerY = Math.max(safe + scaledHeight / 2, Math.min(height - safe - scaledHeight / 2, targetCenterY));

  const plate: React.CSSProperties | undefined = settings.backgroundColor && (settings.backgroundOpacity ?? 0) > 0
    ? {
        background: rgba(settings.backgroundColor, (settings.backgroundOpacity ?? 80) / 100),
        padding: base * 0.3,
        borderRadius: base * 0.24,
      }
    : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left: centerX,
        top: centerY,
        transform: `translate(-50%, -50%) scale(${fit})`,
        transformOrigin: 'center center',
        opacity: pageOpacity,
        pointerEvents: 'none',
        ...plate,
      }}
    >
      {content}
    </div>
  );
};
