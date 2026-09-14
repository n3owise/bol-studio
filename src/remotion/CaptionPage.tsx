import React, { useLayoutEffect, useRef, useState } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from './theme';
import { treatmentFor } from './treatments';
import { CaptionWord } from './CaptionWord';
import { heroRun, type CaptionPage as Page } from '../lib/pages';
import type { Settings, Word } from '../lib/types';

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

const fontStack = (role: 'display' | 'serif' | 'condensed', custom?: string) => {
  const stack = role === 'serif' ? theme.type.serif : role === 'condensed' ? theme.type.condensed : theme.type.display;
  return custom ? `"${custom}", ${stack}` : stack;
};

export const CaptionPage: React.FC<Props> = ({ page, settings, width, height, pageFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const treatment = treatmentFor(settings.template);
  // 0 = prefix row, 1 = hero row, 2 = suffix row (single/rows layouts use index 1 only).
  const { set, boxes } = useRowMeasure(3);

  const base = settings.fontSize * width / 720;
  const heroSize = base * treatment.heroScale;
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

  const enterFrameFor = (word: Word) => Math.max(0, Math.round((word.start - page.start) * fps));

  const renderWord = (word: Word, role: 'hero' | 'sub', size: number, pill: boolean) => {
    const upper = settings.uppercase || (role === 'hero' && treatment.uppercaseHero);
    // Accent follows the hero and any word the editor explicitly spotlighted.
    // The *automatic* picker is budgeted to one word per page in pages.ts, which
    // is what keeps emphasis rare enough to mean something; an explicit choice is
    // never overruled. Where a moving pill already carries the highlight
    // (karaoke, bounce), it is the accent and the hero stays in the text colour.
    const accented = (role === 'hero' || !!word.spotlight) && treatment.pill !== 'active';
    return (
      <CaptionWord
        key={word.id}
        text={upper ? word.text.toLocaleUpperCase() : word.text}
        enterFrame={enterFrameFor(word)}
        role={role}
        size={size}
        color={accented ? accent : textColor}
        treatment={treatment}
        frameWidth={width}
        motion={settings.motion}
        strokeColor={settings.strokeColor}
        strokeWidth={settings.strokeWidth}
        fontFamily={fontStack(role === 'hero' ? treatment.heroFont : treatment.subFont, settings.fontFamily)}
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

  const isStack = treatment.layout === 'stack' && page.heroIndex >= 0 && page.words.length >= 2;

  // Tuck the supporting rows against the hero, the way the reference lockups do.
  const tuckTop = devanagari ? 0 : heroSize * 0.04;
  const tuckBottom = devanagari ? -heroSize * 0.04 : heroSize * 0.1;

  let content: React.ReactNode;
  let boxWidth: number;
  let boxHeight: number;
  /** Distance from the top of the visual lockup down to the top of the hero row. */
  let heroOffsetY = 0;

  if (isStack) {
    const run = heroRun(page)!;
    const heroes = page.words.slice(run.start, run.end + 1);
    const prefix = page.words.slice(0, run.start);
    const suffix = page.words.slice(run.end + 1);

    // The hero row sits in normal flow and therefore sizes the container; the
    // supporting rows are taken out of flow and hung off its left and right
    // edges. A plain flex column let the widest row size the container, which
    // pushed the prefix away from the hero's left edge.
    content = (
      <div style={{ position: 'relative', width: 'fit-content' }}>
        {prefix.length > 0 && (
          <div ref={set(0)} style={{ ...rowStyle, position: 'absolute', left: 0, bottom: `calc(100% - ${tuckTop}px)` }}>
            {prefix.map(w => renderWord(w, 'sub', subSize, false))}
          </div>
        )}
        <div ref={set(1)} style={rowStyle}>
          {heroes.map(w => renderWord(w, 'hero', heroRowSize, treatment.pill === 'hero'))}
        </div>
        {suffix.length > 0 && (
          <div ref={set(2)} style={{ ...rowStyle, position: 'absolute', right: 0, top: `calc(100% - ${tuckBottom}px)` }}>
            {suffix.map(w => renderWord(w, 'sub', subSize, false))}
          </div>
        )}
      </div>
    );

    const [pre, heroBox, suf] = boxes;
    boxWidth = Math.max(pre.width, heroBox.width, suf.width) || heroBox.width;
    heroOffsetY = Math.max(0, pre.height - tuckTop);
    boxHeight = heroOffsetY + heroBox.height + Math.max(0, suf.height - tuckBottom);
  } else if (treatment.layout === 'single') {
    content = (
      <div ref={set(1)} style={{ ...rowStyle, width: 'fit-content' }}>
        {page.words.map(w => renderWord(w, 'hero', heroSize, treatment.pill !== 'none'))}
      </div>
    );
    boxWidth = boxes[1].width;
    boxHeight = boxes[1].height;
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
    boxWidth = boxes[1].width;
    boxHeight = boxes[1].height;
  }

  const maxWidth = width * theme.layout.maxWidth;
  const fit = boxWidth > maxWidth && boxWidth > 0 ? maxWidth / boxWidth : 1;

  const safe = Math.min(width, height) * theme.layout.safeMargin;
  const scaledHeight = boxHeight * fit;
  const wanted = height * (settings.position / 100);
  const centerY = Math.max(safe + scaledHeight / 2, Math.min(height - safe - scaledHeight / 2, wanted));
  // `top` addresses the hero row, which is where the positioned wrapper starts.
  const top = centerY - scaledHeight / 2 + heroOffsetY * fit;

  const plate: React.CSSProperties | undefined = settings.backgroundColor && (settings.backgroundOpacity ?? 0) > 0
    ? {
        background: rgba(settings.backgroundColor, (settings.backgroundOpacity ?? 80) / 100),
        padding: base * 0.3,
        borderRadius: base * 0.24,
      }
    : undefined;

  const align = isStack || treatment.layout === 'single'
    ? 'center'
    : settings.align === 'left' ? 'flex-start' : settings.align === 'right' ? 'flex-end' : 'center';

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        width,
        top,
        display: 'flex',
        justifyContent: align,
        padding: align === 'center' ? 0 : `0 ${safe}px`,
        opacity: pageOpacity,
      }}
    >
      <div style={{ transform: `scale(${fit})`, transformOrigin: `${align === 'center' ? 'center' : align === 'flex-start' ? 'left' : 'right'} top`, ...plate }}>
        {content}
      </div>
    </div>
  );
};
