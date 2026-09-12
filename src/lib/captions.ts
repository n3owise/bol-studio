import type { Settings, Word } from './types';
export const templates = [
  { id: 'welcome-stack', name: 'Hero Entry', tag: 'SIGNATURE · 3-TIER LOCKUP', accent: '#9de52e', description: 'Hero word centered & glowing, with top-left & bottom-right words.' },
  { id: 'karaoke', name: 'Sur Taal', tag: 'SMOOTH · HIGHLIGHT', accent: '#c2a1ff', description: 'Har syllable ke saath smooth flowing highlight.' },
  { id: 'editorial', name: 'Shayari', tag: 'CLEAN · RISE', accent: '#f6d595', description: 'Kam shabdon mein gehra aur shaandaar asar.' },
  { id: 'bounce', name: 'Chulbul Pop', tag: 'PLAYFUL · SPRING', accent: '#ff8bb5', description: 'Words ko thoda playful, bubbly bounce do.' },
  { id: 'kinetic', name: 'Bawaal', tag: 'ONE WORD · ZOOM', accent: '#ff825c', description: 'Har ek lafz ka apna full-screen hero moment.' },
  { id: 'neon', name: 'Chamkeela', tag: 'GLOW · PULSE', accent: '#72e6ff', description: 'Raat ke andhere mein bhi chamakne wala glow.' },
  { id: 'glow-script', name: 'Jadoo Script', tag: 'SCRIPT · GLOW', accent: '#51e6b0', description: 'Rang-birangi handwritten script ka glowing touch.' },
  { id: 'scribble', name: 'Golmaal Orbit', tag: 'DOODLE · MOTION', accent: '#baff4a', description: 'Khaas shabd ke ird-gird hand-drawn ghera.' },
  { id: 'soft-focus', name: 'Sukoon', tag: 'SERIF · LIGHT', accent: '#f0f0f0', description: 'Quiet serif style ek soft, elegant spotlight ke saath.' },
  { id: 'double-trouble', name: 'Jodi No. 1', tag: 'DOUBLE · OUTLINE', accent: '#ff3e36', description: 'Double weight typography, solid punchy rhythm.' },
  { id: 'bubble-highlight', name: 'Tashan Highlight', tag: 'PILL · COLOR', accent: '#54be91', description: 'Key words ko soft colored pill mein highlight karo.' },
  { id: 'mumbai', name: 'Bambaiya', tag: 'CONDENSED · SCRIPT', accent: '#f3f52f', description: 'Bold condensed caps aur street-style handwritten line.' },
  { id: 'editing-school', name: 'Ustaad Box', tag: 'BOX · POP', accent: '#ff9000', description: 'Ek lafz, ek bright popping badge card.' },
  { id: 'kalakar-shadow', name: 'Rangeela Kalakar', tag: 'DEPTH · SHADOW', accent: '#ff9d00', description: 'Warm drop shadow ke saath layered kalakar typography.' },
  { id: 'pop-up', name: 'Patakha Pop', tag: 'WORD · FLASH', accent: '#16d943', description: 'Emphasized shabd seedha screen pe jump karega.' },
];
export function groupWords(words: Word[], max: number): Word[][] {
  const groups: Word[][] = []; let current: Word[] = [];
  for (const word of words) {
    const prev = current.at(-1);
    if (prev && (current.length >= max || word.start - prev.end > .22 || /[.!?।]$/.test(prev.text))) { groups.push(current); current = []; }
    current.push(word);
  }
  if (current.length) groups.push(current);
  return groups;
}
export function dimensions(settings: Settings, sourceWidth = 720, sourceHeight = 1280, resolution = 720) {
  const ratio = settings.aspect === 'original' ? sourceWidth / sourceHeight : settings.aspect === '9:16' ? 9/16 : settings.aspect === '16:9' ? 16/9 : 1;
  return ratio >= 1 ? { width: Math.round(resolution * ratio / 2) * 2, height: resolution } : { width: resolution, height: Math.round(resolution / ratio / 2) * 2 };
}

export function getContrastColor(hexColor: string): '#111318' | '#ffffff' {
  const hex = hexColor.replace('#', '').trim();
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) || 0;
    g = parseInt(hex[1] + hex[1], 16) || 0;
    b = parseInt(hex[2] + hex[2], 16) || 0;
  } else if (hex.length >= 6) {
    r = parseInt(hex.substring(0, 2), 16) || 0;
    g = parseInt(hex.substring(2, 4), 16) || 0;
    b = parseInt(hex.substring(4, 6), 16) || 0;
  }
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 145 ? '#111318' : '#ffffff';
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);
const easeOutBack = (value: number) => {
  const t = clamp01(value);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// The browser preview and frame exporter call this exact, time-based renderer.
export function drawCaptions(ctx: CanvasRenderingContext2D, width: number, height: number, words: Word[], settings: Settings, time: number, pregrouped?: Word[][]) {
  ctx.clearRect(0, 0, width, height);
  const groups = pregrouped ?? groupWords(words, settings.template === 'kinetic' ? 1 : settings.wordsPerLine);
  // A short hold fills natural gaps, but must never obscure the following phrase.
  const group = groups.find((g, i) => time >= g[0].start
    && time < Math.min(g[g.length - 1].end + .08, groups[i + 1]?.[0].start ?? Infinity));
  if (!group) return;
  const base = settings.fontSize * width / 720;
  const activeIndex = group.findIndex(w => time >= w.start && time < w.end);
  const entry = Math.min(1, Math.max(0, (time - group[0].start) / .2));
  const ease = 1 - Math.pow(1-entry, 3);
  const font = (size: number, kind: 'sans' | 'serif' | 'condensed' = 'sans', italic = false, weight = 700) => {
    const family = kind === 'serif' ? 'Georgia, "Times New Roman", serif' : kind === 'condensed' ? 'Impact, "Arial Narrow", sans-serif' : '"DM Sans", "Noto Sans Devanagari", sans-serif';
    return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
  };
  const scriptTemplate = settings.template === 'editorial' || settings.template === 'soft-focus' || settings.template === 'glow-script' || settings.template === 'mumbai';
  const uppercaseTemplate = settings.template === 'welcome-stack' || settings.template === 'double-trouble' || settings.template === 'mumbai';

  const spotlightWordsList = group.filter(w => w.spotlight);
  const emphasisWordsList = group.filter(w => w.emphasis);
  const spotlightCount = spotlightWordsList.length;
  const emphasisCount = emphasisWordsList.length;
  const isStackLockup = settings.template === 'welcome-stack';

  if (isStackLockup) {
    let heroWords: Word[] = [];
    let prefixWords: Word[] = [];
    let suffixWords: Word[] = [];

    const spotlightIndices = group.map((w, i) => (w.spotlight ? i : -1)).filter(i => i !== -1);
    const emphasisIndices = group.map((w, i) => (w.emphasis ? i : -1)).filter(i => i !== -1);

    const primaryIndices = spotlightIndices.length > 0 ? spotlightIndices : emphasisIndices;

    if (primaryIndices.length > 0) {
      // Check if primary indices form a contiguous sequence
      const isContiguous = primaryIndices[primaryIndices.length - 1] - primaryIndices[0] === primaryIndices.length - 1;
      if (isContiguous) {
        const startIdx = primaryIndices[0];
        const endIdx = primaryIndices[primaryIndices.length - 1];
        heroWords = group.slice(startIdx, endIdx + 1);
        prefixWords = group.slice(0, startIdx);
        suffixWords = group.slice(endIdx + 1);
      } else {
        // Non-contiguous: center hero is the first primary word, remaining primary words retain styling in prefix/suffix
        const heroIdx = primaryIndices[0];
        heroWords = [group[heroIdx]];
        prefixWords = group.slice(0, heroIdx);
        suffixWords = group.slice(heroIdx + 1);
      }
    } else {
      let maxScore = -1;
      let best = Math.floor((group.length - 1) / 2);
      for (let i = 0; i < group.length; i++) {
        const s = group[i].emphasisScore ?? 0;
        if (s > maxScore) { maxScore = s; best = i; }
      }
      heroWords = [group[best]];
      prefixWords = group.slice(0, best);
      suffixWords = group.slice(best + 1);
    }

    const heroScale = heroWords.length > 1 ? 1.55 : 1.85;
    const subScale = 0.88;
    const heroSize = base * heroScale;
    const subSize = base * subScale;

    const heroFont = font(heroSize, 'sans', false, 900);
    const subFont = font(subSize, 'sans', false, 700);

    ctx.font = subFont;
    const spaceWidth = ctx.measureText(' ').width;

    ctx.font = heroFont;
    const heroSpaceWidth = ctx.measureText(' ').width;

    const heroItems = heroWords.map(w => {
      const text = (settings.uppercase || w.emphasis || w.spotlight) ? w.text.toUpperCase() : w.text;
      const wWidth = ctx.measureText(text).width;
      return { w, text, width: wWidth, centerX: 0 };
    });
    const heroTotalWidth = heroItems.reduce((acc, it) => acc + it.width, 0) + Math.max(0, heroItems.length - 1) * heroSpaceWidth;

    ctx.font = subFont;
    const prefixItems = prefixWords.map(w => {
      const text = (settings.uppercase || w.emphasis || w.spotlight) ? w.text.toUpperCase() : w.text;
      ctx.font = (w.spotlight || w.emphasis) ? font(subSize * 1.05, 'sans', false, 800) : subFont;
      const wWidth = ctx.measureText(text).width;
      return { w, text, width: wWidth, centerX: 0 };
    });
    const prefixTotalWidth = prefixItems.reduce((acc, it) => acc + it.width, 0) + Math.max(0, prefixItems.length - 1) * spaceWidth;

    const suffixItems = suffixWords.map(w => {
      const text = (settings.uppercase || w.emphasis || w.spotlight) ? w.text.toUpperCase() : w.text;
      ctx.font = (w.spotlight || w.emphasis) ? font(subSize * 1.05, 'sans', false, 800) : subFont;
      const wWidth = ctx.measureText(text).width;
      return { w, text, width: wWidth, centerX: 0 };
    });
    const suffixTotalWidth = suffixItems.reduce((acc, it) => acc + it.width, 0) + Math.max(0, suffixItems.length - 1) * spaceWidth;

    const heroCenterX = width / 2;
    const heroLeftX = heroCenterX - heroTotalWidth / 2;
    const heroRightX = heroCenterX + heroTotalWidth / 2;

    let hCurrX = heroLeftX;
    for (const item of heroItems) {
      item.centerX = hCurrX + item.width / 2;
      hCurrX += item.width + heroSpaceWidth;
    }

    let currX = heroLeftX;
    for (const item of prefixItems) {
      item.centerX = currX + item.width / 2;
      currX += item.width + spaceWidth;
    }

    const suffixStartX = heroRightX - suffixTotalWidth;
    let sCurrX = suffixStartX;
    for (const item of suffixItems) {
      item.centerX = sCurrX + item.width / 2;
      sCurrX += item.width + spaceWidth;
    }

    const minX = Math.min(heroLeftX, prefixItems.length ? heroLeftX : heroLeftX, suffixItems.length ? suffixStartX : heroLeftX);
    const maxX = Math.max(heroRightX, prefixItems.length ? heroLeftX + prefixTotalWidth : heroRightX, heroRightX);
    const totalLockupWidth = maxX - minX;
    const maxAllowedWidth = width * 0.86;
    const fitScale = totalLockupWidth > maxAllowedWidth ? maxAllowedWidth / totalLockupWidth : 1;

    const lineGap = heroSize * 0.12;
    const hasPrefix = prefixItems.length > 0;
    const hasSuffix = suffixItems.length > 0;
    const lockupHeight = heroSize + (hasPrefix ? subSize + lineGap : 0) + (hasSuffix ? subSize + lineGap : 0);
    const safeMargin = Math.min(width, height) * 0.06;
    const rawCenterY = height * (settings.position / 100);
    const halfH = lockupHeight / 2;
    const centerY = Math.max(safeMargin + halfH, Math.min(height - safeMargin - halfH, rawCenterY));

    const yHero = centerY + (hasPrefix && !hasSuffix ? lineGap * 0.4 : !hasPrefix && hasSuffix ? -lineGap * 0.4 : 0);
    const yPrefix = yHero - heroSize * 0.52 - lineGap - subSize * 0.48;
    const ySuffix = yHero + heroSize * 0.52 + lineGap + subSize * 0.48;

    ctx.save();
    ctx.translate(heroCenterX, centerY);
    ctx.scale(fitScale, fitScale);
    ctx.translate(-heroCenterX, -centerY);

    // Draw prefix words (top-left aligned)
    for (const item of prefixItems) {
      const pHasStarted = settings.motion === 0 || time >= item.w.start;
      const pLocal = Math.max(0, time - item.w.start);
      const pEntry = settings.motion === 0 ? 1 : Math.min(1, pLocal / 0.16);
      const pPop = settings.motion === 0 ? 1 : 0.88 + 0.12 * easeOutBack(pEntry);
      const pAlpha = pHasStarted ? (settings.motion === 0 ? 1 : Math.min(1, pEntry * 2.5)) : 0;

      ctx.save();
      ctx.translate(item.centerX, yPrefix);
      ctx.scale(pPop, pPop);
      ctx.globalAlpha = pAlpha;
      ctx.font = (item.w.spotlight || item.w.emphasis) ? font(subSize * 1.05, 'sans', false, 800) : subFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#000000dd';
      ctx.lineWidth = subSize * 0.08;
      if (pAlpha > 0) ctx.strokeText(item.text, 0, 0);

      if (item.w.spotlight) {
        ctx.shadowColor = pAlpha > 0 ? settings.accent : 'transparent';
        ctx.shadowBlur = pAlpha > 0 ? subSize * 0.65 : 0;
        ctx.fillStyle = settings.accent;
      } else if (item.w.emphasis) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = settings.accent;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }

    // Draw hero word(s) (centered, big, colorful with radiant ambient glow)
    for (const item of heroItems) {
      const hasStarted = settings.motion === 0 || time >= item.w.start;
      const local = Math.max(0, time - item.w.start);
      const entry = settings.motion === 0 ? 1 : Math.min(1, local / 0.16);
      const popScale = settings.motion === 0 ? 1 : 0.85 + 0.15 * easeOutBack(entry);
      const alpha = hasStarted ? (settings.motion === 0 ? 1 : Math.min(1, entry * 2.5)) : 0;

      ctx.save();
      ctx.translate(item.centerX, yHero);
      ctx.scale(popScale, popScale);
      ctx.globalAlpha = alpha;
      ctx.font = heroFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const isActualSpotlight = !!item.w.spotlight;
      const isActualEmphasis = !!item.w.emphasis;
      const isHighlighted = isActualSpotlight || isActualEmphasis;
      ctx.shadowColor = alpha > 0 ? (isActualSpotlight ? settings.accent : 'rgba(0, 0, 0, 0.4)') : 'transparent';
      ctx.shadowBlur = alpha > 0 ? (isActualSpotlight ? heroSize * 0.65 : heroSize * 0.12) : 0;
      ctx.fillStyle = isHighlighted ? settings.accent : '#ffffff';
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }

    // Draw suffix words (bottom-right aligned)
    for (const item of suffixItems) {
      const sHasStarted = settings.motion === 0 || time >= item.w.start;
      const sLocal = Math.max(0, time - item.w.start);
      const sEntry = settings.motion === 0 ? 1 : Math.min(1, sLocal / 0.16);
      const sPop = settings.motion === 0 ? 1 : 0.88 + 0.12 * easeOutBack(sEntry);
      const sAlpha = sHasStarted ? (settings.motion === 0 ? 1 : Math.min(1, sEntry * 2.5)) : 0;

      ctx.save();
      ctx.translate(item.centerX, ySuffix);
      ctx.scale(sPop, sPop);
      ctx.globalAlpha = sAlpha;
      ctx.font = (item.w.spotlight || item.w.emphasis) ? font(subSize * 1.05, 'sans', false, 800) : subFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#000000dd';
      ctx.lineWidth = subSize * 0.08;
      if (sAlpha > 0) ctx.strokeText(item.text, 0, 0);

      if (item.w.spotlight) {
        ctx.shadowColor = sAlpha > 0 ? settings.accent : 'transparent';
        ctx.shadowBlur = sAlpha > 0 ? subSize * 0.65 : 0;
        ctx.fillStyle = settings.accent;
      } else if (item.w.emphasis) {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = settings.accent;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillText(item.text, 0, 0);
      ctx.restore();
    }

    ctx.restore();
    return;
  }
  const itemFont = (w: Word, size: number) => {
    const isSpecial = w.emphasis || w.spotlight;
    if ((settings.template === 'editorial' || settings.template === 'soft-focus') && isSpecial) return font(size * 1.05, 'serif', true, 400);
    if ((settings.template === 'glow-script' || settings.template === 'mumbai') && isSpecial) return font(size * 1.08, 'serif', true, 400);
    if (settings.template === 'double-trouble') return font(size * .96, 'condensed', true, 700);
    if (settings.template === 'welcome-stack') return font(size, 'sans', false, isSpecial ? 800 : 600);
    return font(size, scriptTemplate && isSpecial ? 'serif' : 'sans', scriptTemplate && isSpecial, isSpecial ? 800 : 700);
  };
  const data = group.map((w, i) => {
    const text = (settings.uppercase || (uppercaseTemplate && !w.emphasis && !w.spotlight)) ? w.text.toLocaleUpperCase() : w.text;
    const emphasisScale = settings.template === 'welcome-stack' ? 1.36 : settings.template === 'editing-school' ? 1.32 : settings.template === 'pop-up' ? 1.34 : 1.29;
    const size = base * ((w.emphasis || w.spotlight) ? emphasisScale : settings.template === 'welcome-stack' ? .82 : 1);
    ctx.font = itemFont(w, size);
    return { w, text, size, width: ctx.measureText(text).width, active: i === activeIndex };
  });
  const gap = base * .24;
  const rows: typeof data[] = [[]]; let rowWidth = 0;
  for (const item of data) {
    if (rows.at(-1)!.length && rowWidth + gap + item.width > width * .84) { rows.push([]); rowWidth = 0; }
    rows.at(-1)!.push(item); rowWidth += item.width + gap;
  }
  const totalHeight = rows.length * base * 1.65;
  // Fit the entire phrase together so long groups stay on-screen in landscape.
  // Padding reserves room for Devanagari marks, strokes, glow, and spring motion.
  const verticalPadding = base * .75;
  const safeMargin = Math.min(width, height) * .06;
  const layoutHeight = totalHeight + verticalPadding * 2;
  const layoutScale = Math.min(1, (height - safeMargin * 2) / layoutHeight);
  const scaledHeight = layoutHeight * layoutScale;
  const yStart = Math.max(safeMargin, Math.min(height - safeMargin - scaledHeight,
    height * settings.position / 100 - scaledHeight / 2));
  ctx.save();
  ctx.translate(width / 2, yStart + verticalPadding * layoutScale);
  ctx.scale(layoutScale, layoutScale);
  ctx.translate(-width / 2, 0);
  ctx.globalAlpha = settings.motion ? Math.min(1, entry * 3) : 1;
  for (let row = 0; row < rows.length; row++) {
    const items = rows[row];
    const totalWidth = items.reduce((s,x) => s + x.width, 0) + (items.length-1)*gap;
    const fit = Math.min(1, width * .86 / totalWidth);
    let x = (width-totalWidth*fit)/2;
    for (const item of items) {
      const { w, text, size, active } = item;
      const local = Math.max(0, time - w.start);
      const spring = Math.exp(-local*14) * Math.sin(local*22);
      const animationScale = settings.motion && active ? 1 + spring * .14 * settings.motion : 1;
      const wordEntry = settings.motion ? easeOutBack(clamp01((time - w.start) / .2)) : 1;
      const isKinetic = settings.template === 'kinetic';
      const wordAlpha = settings.motion
        ? (isKinetic
            ? clamp01((time - w.start) / .07) * clamp01((w.end + .16 - time) / .16)
            : 1)
        : 1;
      if (wordAlpha <= 0) { x += (item.width + gap) * fit; continue; }
      const y = row * base * 1.65 + base * .9;
      ctx.save();
      ctx.globalAlpha *= wordAlpha;
      ctx.translate(x+item.width*fit/2, y + (settings.motion ? (1-ease)*base*.24 + (1-wordEntry)*base*.22 : 0));
      ctx.scale(fit*animationScale*(settings.motion ? .86 + .14 * wordEntry : 1), fit*animationScale*(settings.motion ? .86 + .14 * wordEntry : 1));
      if (settings.template === 'bounce' && active && settings.motion) ctx.translate(0, -Math.sin(Math.min(1,local/.25)*Math.PI)*base*.18);
      if (settings.template === 'kinetic' && settings.motion) ctx.scale(.82+.18*ease, .82+.18*ease);
      if (settings.template === 'pop-up' && (w.emphasis || w.spotlight) && settings.motion) ctx.rotate(Math.sin(local * 11) * .025);
      if (w.spotlight && settings.motion) ctx.scale(1.08, 1.08);
      ctx.font = itemFont(w, size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const accent = settings.accent;
      const isBoxed = (settings.template === 'karaoke' && active)
        || (settings.template === 'bounce' && active)
        || (settings.template === 'bubble-highlight' && (active || w.emphasis || w.spotlight))
        || (settings.template === 'editing-school' && (active || w.emphasis || w.spotlight));

      if (isBoxed) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        const radius = settings.template === 'bounce' ? size * .32 : settings.template === 'editing-school' ? size * .08 : size * .18;
        ctx.roundRect(-item.width / 2 - base * .16, -size * .64, item.width + base * .32, size * 1.28, radius);
        ctx.fill();

        // Text inside solid box: crisp, high contrast, no stroke, no shadow blur
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = getContrastColor(accent);
        ctx.fillText(text, 0, 0);
      } else {
        if (settings.template === 'double-trouble' && (w.emphasis || w.spotlight)) {
          ctx.strokeStyle = accent; ctx.lineWidth = base * .08; ctx.beginPath(); ctx.ellipse(0, 0, item.width / 2 + base * .28, size * .72, -.08, 0, Math.PI * 2); ctx.stroke();
        }
        const shadow = settings.template === 'kalakar-shadow' ? accent : '#000000cc';
        ctx.shadowColor = w.spotlight ? accent : shadow;
        ctx.shadowBlur = w.spotlight ? base * 0.45 : (settings.template === 'glow-script' || settings.template === 'neon' || settings.template === 'soft-focus' ? base * .42 : base * .14);
        ctx.shadowOffsetY = settings.template === 'kalakar-shadow' ? base * .14 : base * .055;
        const noStroke = settings.template === 'editorial' || settings.template === 'soft-focus' || settings.template === 'glow-script' || settings.template === 'mumbai';
        ctx.strokeStyle = settings.template === 'pop-up' && (w.emphasis || w.spotlight) ? '#101511' : '#111318';
        ctx.lineWidth = noStroke ? 0 : base * .08;
        if (ctx.lineWidth > 0) ctx.strokeText(text, 0, 0);
        if (settings.template === 'kalakar-shadow' && (w.emphasis || w.spotlight)) {
          ctx.save(); ctx.shadowColor = '#000000ee'; ctx.shadowBlur = base * .1; ctx.shadowOffsetY = base * .11; ctx.fillStyle = accent; ctx.fillText(text, 0, 0); ctx.restore();
        }
        const highlight = active || w.emphasis || w.spotlight;
        ctx.fillStyle = highlight ? (settings.template === 'soft-focus' ? '#ffffff' : accent) : '#ffffff';
        ctx.fillText(text, 0, 0);
        if ((settings.template === 'editorial' || settings.template === 'soft-focus') && active) {
          ctx.fillStyle = accent; ctx.fillRect(-item.width / 2, size * .62, item.width * Math.min(1, local / .12), base * .055);
        }
        if (settings.template === 'glow-script' && w.emphasis) {
          ctx.shadowColor = accent; ctx.shadowBlur = base * .25; ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1, base * .025);
          ctx.beginPath(); ctx.moveTo(-item.width * .48, size * .58); ctx.bezierCurveTo(-item.width * .12, size * .9, item.width * .2, size * .88, item.width * .52, size * .58); ctx.stroke();
        }
        if (settings.template === 'scribble' && w.emphasis) {
          ctx.shadowColor = accent; ctx.shadowBlur = base * .12; ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1.5, base * .035); ctx.setLineDash([base * .06, base * .075]);
          ctx.beginPath(); ctx.ellipse(0, size * .28, item.width * .72 + base * .1, size * .34, -.08, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      ctx.restore(); x += (item.width+gap)*fit;
    }
  }
  ctx.restore();
}
export function subtitleText(words: Word[], max: number, format: 'srt' | 'vtt') {
  const stamp = (s: number) => { const ms = Math.max(0, Math.round(s*1000)); return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}${format === 'srt' ? ',' : '.'}${String(ms%1000).padStart(3,'0')}`; };
  return (format === 'vtt' ? 'WEBVTT\n\n' : '') + groupWords(words,max).map((g,i) => `${format === 'srt' ? `${i+1}\n` : ''}${stamp(g[0].start)} --> ${stamp(g.at(-1)!.end)}\n${g.map(w=>w.text).join(' ')}\n`).join('\n');
}

export function ensureValidIntervals(words: Word[], duration: number): void {
  for (let i = 0; i < words.length; i++) {
    const prevEnd = i > 0 ? words[i - 1].end : 0;
    if (words[i].start < prevEnd) {
      words[i].start = Number((prevEnd + 0.002).toFixed(3));
    }
    if (words[i].end <= words[i].start) {
      const nextStart = i < words.length - 1 ? words[i + 1].start : duration;
      words[i].end = Number(Math.min(nextStart - 0.002, words[i].start + 0.25).toFixed(3));
      if (words[i].end <= words[i].start) {
        words[i].end = Number((words[i].start + 0.03).toFixed(3));
      }
    }
  }

  // Clip duration upper boundary constraint (server validates: end <= duration + .0001)
  if (words.length > 0 && duration > 0) {
    const lastIdx = words.length - 1;
    if (words[lastIdx].end > duration) {
      const overflow = Number((words[lastIdx].end - duration).toFixed(3));
      for (let i = words.length - 1; i >= 0; i--) {
        words[i].end = Number(Math.max(0.04, words[i].end - overflow).toFixed(3));
        words[i].start = Number(Math.max(0, words[i].start - overflow).toFixed(3));
        if (i < words.length - 1 && words[i].end > words[i + 1].start) {
          words[i].end = Number((words[i + 1].start - 0.002).toFixed(3));
        }
      }
    }
  }
}

export function insertWord(
  words: Word[],
  targetId: string,
  position: 'before' | 'after',
  newText = 'new',
  duration = 60
): { words: Word[]; newWordId: string } {
  const index = words.findIndex(w => w.id === targetId);
  if (index === -1) {
    return appendWord(words, newText, duration);
  }

  const target = words[index];
  const newId = `w-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let start = 0;
  let end = 0;
  const newWords = words.map(w => ({ ...w }));

  if (position === 'after') {
    const next = words[index + 1];
    const maxEnd = next ? next.start - 0.005 : duration;
    const gap = maxEnd - target.end;
    if (gap >= 0.12) {
      start = Number((target.end + 0.005).toFixed(3));
      end = Number(Math.min(maxEnd, start + 0.35).toFixed(3));
    } else {
      const targetDuration = target.end - target.start;
      const keep = Math.max(0.12, targetDuration * 0.55);
      const splitPoint = Number((target.start + keep).toFixed(3));
      newWords[index].end = Number((splitPoint - 0.005).toFixed(3));
      start = splitPoint;
      end = Number(Math.min(maxEnd, start + Math.max(0.12, (maxEnd - start) * 0.8)).toFixed(3));
      if (end <= start) end = Number((start + 0.05).toFixed(3));
    }
  } else {
    const prev = words[index - 1];
    const minStart = prev ? prev.end + 0.005 : 0;
    const gap = target.start - minStart;
    if (gap >= 0.12) {
      end = Number((target.start - 0.005).toFixed(3));
      start = Number(Math.max(minStart, end - 0.35).toFixed(3));
    } else {
      const targetDuration = target.end - target.start;
      const keep = Math.max(0.12, targetDuration * 0.55);
      const splitPoint = Number((target.end - keep).toFixed(3));
      start = Number(Math.max(minStart, splitPoint - Math.max(0.12, (splitPoint - minStart) * 0.8)).toFixed(3));
      end = Number((splitPoint - 0.005).toFixed(3));
      newWords[index].start = splitPoint;
      if (end <= start) end = Number((start + 0.05).toFixed(3));
    }
  }

  start = Number(Math.max(0, start).toFixed(3));
  end = Number(Math.min(duration, Math.max(start + 0.05, end)).toFixed(3));

  const newWord: Word = {
    id: newId,
    text: newText.trim() || 'word',
    original: newText.trim() || 'word',
    start,
    end,
    confidence: 1,
    emphasis: false,
    emphasisScore: 0.5,
  };

  const insertIndex = position === 'after' ? index + 1 : index;
  newWords.splice(insertIndex, 0, newWord);
  ensureValidIntervals(newWords, duration);

  return { words: newWords, newWordId: newId };
}

export function appendWord(
  words: Word[],
  newText = 'new',
  duration = 60
): { words: Word[]; newWordId: string } {
  const newId = `w-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newWords = words.map(w => ({ ...w }));
  let start = 0;
  let end = 0.4;

  if (words.length > 0) {
    const last = words[words.length - 1];
    if (last.end + 0.2 <= duration) {
      start = Number((last.end + 0.01).toFixed(3));
      end = Number(Math.min(duration, start + 0.35).toFixed(3));
    } else {
      const lastDur = last.end - last.start;
      const split = Number((last.start + Math.max(0.1, lastDur * 0.6)).toFixed(3));
      newWords[newWords.length - 1].end = Number((split - 0.005).toFixed(3));
      start = split;
      end = Number(duration.toFixed(3));
    }
  } else {
    start = 0.0;
    end = Number(Math.min(duration, 0.4).toFixed(3));
  }

  newWords.push({
    id: newId,
    text: newText.trim() || 'word',
    original: newText.trim() || 'word',
    start,
    end,
    confidence: 1,
    emphasis: false,
    emphasisScore: 0.5,
  });

  ensureValidIntervals(newWords, duration);
  return { words: newWords, newWordId: newId };
}

export function splitLineAtWord(words: Word[], wordId: string): Word[] {
  const i = words.findIndex(w => w.id === wordId);
  if (i === -1) return words;
  return words.map((w, idx) => {
    if (idx !== i) return w;
    const clean = w.text.trim();
    if (/[.!?।]$/.test(clean)) return w;
    return { ...w, text: `${clean}.` };
  });
}

export function mergeLines(words: Word[], firstGroupLastWordId: string): Word[] {
  const i = words.findIndex(w => w.id === firstGroupLastWordId);
  if (i === -1 || i === words.length - 1) return words;
  const newWords = words.map(w => ({ ...w }));
  newWords[i].text = newWords[i].text.replace(/[.!?।]+$/, '');
  const gap = newWords[i + 1].start - newWords[i].end;
  if (gap > 0.22) {
    const shift = gap - 0.12;
    for (let j = i + 1; j < newWords.length; j++) {
      newWords[j].start = Number(Math.max(newWords[j - 1].end + 0.005, newWords[j].start - shift).toFixed(3));
      newWords[j].end = Number(Math.max(newWords[j].start + 0.05, newWords[j].end - shift).toFixed(3));
      if (j < newWords.length - 1 && newWords[j + 1].start - newWords[j].end > 0.4) break;
    }
  }
  return newWords;
}

export function moveWordToPreviousLine(words: Word[], wordId: string, maxWordsPerLine = 4): Word[] {
  const targetIdx = words.findIndex(w => w.id === wordId);
  if (targetIdx <= 0) return words;

  const groups = groupWords(words, maxWordsPerLine);
  const groupIdx = groups.findIndex(g => g.some(w => w.id === wordId));
  if (groupIdx <= 0) return words;

  const prevGroup = groups[groupIdx - 1];
  const lastWordOfPrevGroup = prevGroup[prevGroup.length - 1];
  const prevEndIdx = words.findIndex(w => w.id === lastWordOfPrevGroup.id);
  if (prevEndIdx === -1) return words;

  const newWords = words.map(w => ({ ...w }));

  // Remove line break punctuation between previous group end and current target word
  for (let i = prevEndIdx; i < targetIdx; i++) {
    newWords[i].text = newWords[i].text.replace(/[.!?।]+$/, '');
    const gap = newWords[i + 1].start - newWords[i].end;
    if (gap > 0.22) {
      const shift = gap - 0.12;
      newWords[i + 1].start = Number(Math.max(newWords[i].end + 0.005, newWords[i + 1].start - shift).toFixed(3));
      newWords[i + 1].end = Number(Math.max(newWords[i + 1].start + 0.05, newWords[i + 1].end - shift).toFixed(3));
    }
  }

  // Put a sentence ending on targetIdx so words after it break to the next line
  if (targetIdx < newWords.length - 1) {
    const clean = newWords[targetIdx].text.trim();
    if (!/[.!?।]$/.test(clean)) {
      newWords[targetIdx].text = `${clean}.`;
    }
  }

  return newWords;
}

export function moveWordToNextLine(words: Word[], wordId: string): Word[] {
  const targetIdx = words.findIndex(w => w.id === wordId);
  if (targetIdx <= 0) return words;

  const newWords = words.map(w => ({ ...w }));

  // The word before targetIdx should now end the line with punctuation
  const prevClean = newWords[targetIdx - 1].text.trim();
  if (!/[.!?।]$/.test(prevClean)) {
    newWords[targetIdx - 1].text = `${prevClean}.`;
  }

  // Remove any line break punctuation on the target word itself so it flows into the next line
  newWords[targetIdx].text = newWords[targetIdx].text.replace(/[.!?।]+$/, '');

  return newWords;
}

function moveSingleWordToLine(
  words: Word[],
  wordId: string,
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5
): Word[] {
  const sourceWord = words.find(w => w.id === wordId);
  if (!sourceWord) return words;

  const groups = groupWords(words, maxWordsPerLine);
  const sourceGroupIdx = groups.findIndex(g => g.some(w => w.id === wordId));
  if (sourceGroupIdx === -1) return words;
  if (targetGroupIdx < 0 || targetGroupIdx >= groups.length) return words;

  const targetGroup = groups[targetGroupIdx];
  if (!targetGroup.length) return words;

  if (typeof targetPosition === 'object' && targetPosition.targetWordId === wordId) {
    return words;
  }

  const newWords = words.map(w => ({ ...w }));
  const sourceIdx = newWords.findIndex(w => w.id === wordId);
  const movingWord = { ...newWords[sourceIdx] };

  let refWordId: string;
  let insertBefore = false;

  if (typeof targetPosition === 'object') {
    refWordId = targetPosition.targetWordId;
    insertBefore = targetPosition.insert === 'before';
  } else if (targetPosition === 'start') {
    refWordId = targetGroup[0].id;
    insertBefore = true;
  } else {
    refWordId = targetGroup[targetGroup.length - 1].id;
    insertBefore = false;
  }

  if (refWordId === wordId) return words;

  const sourceGroupWords = groups[sourceGroupIdx];
  const sourceWordIdxInGroup = sourceGroupWords.findIndex(w => w.id === wordId);

  newWords.splice(sourceIdx, 1);

  if (sourceWordIdxInGroup === sourceGroupWords.length - 1 && sourceGroupWords.length > 1) {
    const priorWordId = sourceGroupWords[sourceGroupWords.length - 2].id;
    const priorWordIdx = newWords.findIndex(w => w.id === priorWordId);
    if (priorWordIdx !== -1) {
      const clean = newWords[priorWordIdx].text.trim();
      if (!/[.!?।]$/.test(clean)) {
        newWords[priorWordIdx].text = `${clean}.`;
      }
    }
  }

  const refIdx = newWords.findIndex(w => w.id === refWordId);
  if (refIdx === -1) return words;

  const insertIdx = insertBefore ? refIdx : refIdx + 1;
  newWords.splice(insertIdx, 0, movingWord);

  const prevWord = insertIdx > 0 ? newWords[insertIdx - 1] : null;
  const nextWord = insertIdx < newWords.length - 1 ? newWords[insertIdx + 1] : null;

  const dur = Math.max(0.08, Number((movingWord.end - movingWord.start).toFixed(3)));

  const alreadyBetween = (!prevWord || movingWord.start >= prevWord.end) &&
                         (!nextWord || movingWord.end <= nextWord.start);

  if (alreadyBetween) {
    // Word was already in this slot in speech: preserve its natural timestamps
    if (prevWord && targetGroup.some(w => w.id === prevWord.id)) {
      const gap = movingWord.start - prevWord.end;
      if (gap > 0.18) {
        const shift = gap - 0.08;
        movingWord.start = Number((movingWord.start - shift).toFixed(3));
        movingWord.end = Number((movingWord.end - shift).toFixed(3));
      }
    } else if (nextWord && targetGroup.some(w => w.id === nextWord.id)) {
      const gap = nextWord.start - movingWord.end;
      if (gap > 0.18) {
        const shift = gap - 0.08;
        movingWord.start = Number((movingWord.start + shift).toFixed(3));
        movingWord.end = Number((movingWord.end + shift).toFixed(3));
      }
    }
  } else {
    // Word moved from elsewhere: fit it locally between prevWord and nextWord
    const minStart = prevWord ? Number((prevWord.end + 0.01).toFixed(3)) : 0;
    const maxEnd = nextWord ? Number((nextWord.start - 0.01).toFixed(3)) : (minStart + dur);

    if (maxEnd >= minStart + 0.04) {
      if (insertBefore) {
        movingWord.end = maxEnd;
        movingWord.start = Number(Math.max(minStart, movingWord.end - dur).toFixed(3));
      } else {
        movingWord.start = minStart;
        movingWord.end = Number(Math.min(maxEnd, movingWord.start + dur).toFixed(3));
      }
    } else {
      movingWord.start = minStart;
      movingWord.end = Number((minStart + Math.max(0.04, dur * 0.5)).toFixed(3));
      // Only nudge words in the immediate target group if needed
      if (nextWord && nextWord.start < movingWord.end + 0.01) {
        const shift = Number((movingWord.end + 0.01 - nextWord.start).toFixed(3));
        for (let j = insertIdx + 1; j < newWords.length; j++) {
          if (!targetGroup.some(tw => tw.id === newWords[j].id)) break;
          newWords[j].start = Number((newWords[j].start + shift).toFixed(3));
          newWords[j].end = Number((newWords[j].end + shift).toFixed(3));
        }
      }
    }
  }

  // Ensure all intervals in newWords strictly satisfy start < end and non-overlapping
  ensureValidIntervals(newWords, 9999);

  if (prevWord) {
    const isPrevInTarget = targetGroup.some(w => w.id === prevWord.id);
    if (isPrevInTarget) {
      prevWord.text = prevWord.text.replace(/[.!?।]+$/, '');
    }
  }

  const isAtEndOfTargetLine = !nextWord || !targetGroup.some(w => w.id === nextWord.id);
  if (isAtEndOfTargetLine) {
    if (nextWord) {
      const clean = movingWord.text.trim();
      if (!/[.!?।]$/.test(clean)) {
        movingWord.text = `${clean}.`;
      }
    }
  } else {
    movingWord.text = movingWord.text.replace(/[.!?।]+$/, '');
  }

  return newWords;
}

export function moveWordsToLine(
  words: Word[],
  wordIds: string[],
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5
): Word[] {
  const movingWords = words.filter(w => wordIds.includes(w.id));
  if (!movingWords.length) return words;

  if (movingWords.length === 1) {
    return moveSingleWordToLine(words, movingWords[0].id, targetGroupIdx, targetPosition, maxWordsPerLine);
  }

  // If targetPosition targets one of the moving words, abort
  if (typeof targetPosition === 'object' && wordIds.includes(targetPosition.targetWordId)) {
    return words;
  }

  let currentWords = [...words];
  let currentTargetPos = targetPosition;

  for (let i = 0; i < movingWords.length; i++) {
    const wId = movingWords[i].id;
    currentWords = moveSingleWordToLine(currentWords, wId, targetGroupIdx, currentTargetPos, maxWordsPerLine);
    currentTargetPos = { targetWordId: wId, insert: 'after' };
  }

  ensureValidIntervals(currentWords, 9999);
  return currentWords;
}

export function moveWordToLine(
  words: Word[],
  wordId: string,
  targetGroupIdx: number,
  targetPosition: 'start' | 'end' | { targetWordId: string; insert: 'before' | 'after' },
  maxWordsPerLine = 5
): Word[] {
  return moveWordsToLine(words, [wordId], targetGroupIdx, targetPosition, maxWordsPerLine);
}

export function replaceAllOccurrences(words: Word[], findText: string, replaceText: string, caseSensitive = false): Word[] {
  const query = findText.trim();
  if (!query) return words;
  return words.map(w => {
    const matchPunct = w.text.match(/([.!?।,;:—\-]+)$/);
    const punct = matchPunct ? matchPunct[1] : '';
    const baseText = punct ? w.text.slice(0, -punct.length) : w.text;

    const matches = caseSensitive
      ? baseText === query
      : baseText.toLowerCase() === query.toLowerCase();

    if (matches) {
      return {
        ...w,
        text: `${replaceText}${punct}`,
      };
    }
    return w;
  });
}

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

/**
 * Automatically detects and synchronizes Spotlight (⚡ hero word) and Emphasize (★ power words)
 * across caption groups so the video lyrics display and bottom timeline track match 100%.
 */
export function autoDetectHighlights(words: Word[], wordsPerLine = 4): Word[] {
  if (!words || words.length === 0) return [];
  const groups = groupWords(words, wordsPerLine);

  return groups.flatMap(group => {
    if (group.length === 0) return [];

    // If this group already has explicit spotlight keywords set by the user, preserve them cleanly
    const hasExistingSpotlight = group.some(w => w.spotlight);
    if (hasExistingSpotlight) {
      return group.map(w => ({
        ...w,
        spotlight: !!w.spotlight,
        emphasis: !w.spotlight && !!w.emphasis,
      }));
    }

    // Score words to select the primary Spotlight hero word for this line
    let bestScore = -Infinity;
    let bestIndex = -1;

    group.forEach((w, idx) => {
      const clean = w.text.replace(/\W/g, '').toLowerCase();
      const hasNumber = /\d/.test(w.text);
      const isHook = HOOK_WORDS.has(clean) || hasNumber;
      const isStop = STOP_WORDS.has(clean);

      let score = w.emphasisScore ?? 0.5;
      if (w.emphasis) score += 0.35;
      if (isHook) score += 0.45;
      if (clean.length >= 4) score += 0.1;
      if (isStop) score -= 0.65;

      // Slight preference for content words away from very end punctuation
      const centerDist = Math.abs(idx - (group.length - 1) / 2);
      score -= centerDist * 0.05;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = idx;
      }
    });

    if (bestIndex === -1) {
      bestIndex = Math.floor((group.length - 1) / 2);
    }

    return group.map((w, idx) => {
      if (idx === bestIndex) {
        return {
          ...w,
          spotlight: true,
          emphasis: false,
        };
      }
      const clean = w.text.replace(/\W/g, '').toLowerCase();
      const hasNumber = /\d/.test(w.text);
      const isHook = HOOK_WORDS.has(clean) || hasNumber;
      const isStop = STOP_WORDS.has(clean);
      const isSecondaryEmphasis = !isStop && (w.emphasis || (w.emphasisScore ?? 0) >= 0.72 || isHook);
      return {
        ...w,
        spotlight: false,
        emphasis: isSecondaryEmphasis,
      };
    });
  });
}


