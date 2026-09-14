import type { CanvasTextElement, CanvasTextType, TextAnimationIn, TextAnimationOut, TextCase } from './types.ts';

export type TextPreset = {
  id: string;
  name: string;
  style: Partial<CanvasTextElement>;
};

export type TextTemplateCategory = 'All' | 'Titles' | 'Subtitles' | 'Labels' | 'Quotes';

export type TextTemplate = {
  id: string;
  name: string;
  category: TextTemplateCategory;
  previewText: string;
  style: Partial<CanvasTextElement>;
};

export const AVAILABLE_FONTS = [
  'Inter',
  'DM Sans',
  'Space Grotesk',
  'Roboto',
  'Montserrat',
  'Open Sans',
  'Lato',
  'Georgia',
  'Impact',
  'Arial',
];

export const TEXT_PRESETS: TextPreset[] = [
  {
    id: 'default',
    name: 'Default',
    style: {
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      color: '#FFFFFF',
      backgroundColor: undefined,
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowEnabled: false,
    },
  },
  {
    id: 'bold',
    name: 'Bold',
    style: {
      fontWeight: '800',
      fontStyle: 'normal',
      textDecoration: 'none',
      color: '#FFFFFF',
      backgroundColor: undefined,
      backgroundOpacity: 0,
      strokeWidth: 0,
      shadowEnabled: true,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 8,
      shadowX: 2,
      shadowY: 4,
      textCase: 'uppercase',
    },
  },
  {
    id: 'outline',
    name: 'Outline',
    style: {
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      color: '#FFFFFF',
      backgroundColor: undefined,
      backgroundOpacity: 0,
      strokeColor: '#000000',
      strokeWidth: 4,
      shadowEnabled: false,
    },
  },
  {
    id: 'highlight',
    name: 'Highlight',
    style: {
      fontWeight: 'bold',
      fontStyle: 'normal',
      textDecoration: 'none',
      color: '#000000',
      backgroundColor: '#2EE368',
      backgroundOpacity: 100,
      strokeWidth: 0,
      shadowEnabled: false,
    },
  },
];

export const TEXT_TEMPLATES: TextTemplate[] = [
  {
    id: 'modern-title',
    name: 'Modern',
    category: 'Titles',
    previewText: 'MODERN',
    style: {
      fontFamily: 'DM Sans',
      fontWeight: '800',
      textCase: 'uppercase',
      color: '#FFFFFF',
      letterSpacing: 3,
      shadowEnabled: true,
      shadowColor: 'rgba(0,0,0,0.7)',
      shadowBlur: 6,
      shadowX: 0,
      shadowY: 3,
    },
  },
  {
    id: 'bold-impact',
    name: 'Bold Impact',
    category: 'Titles',
    previewText: 'IMPACT',
    style: {
      fontFamily: 'Space Grotesk',
      fontWeight: '800',
      textCase: 'uppercase',
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 4,
      shadowEnabled: true,
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 10,
      shadowX: 3,
      shadowY: 5,
    },
  },
  {
    id: 'minimalist-sub',
    name: 'Minimalist',
    category: 'Subtitles',
    previewText: 'Episode 04',
    style: {
      fontFamily: 'Inter',
      fontWeight: 'normal',
      textCase: 'normal',
      color: '#E0E0E0',
      letterSpacing: 1,
      strokeWidth: 0,
      shadowEnabled: false,
    },
  },
  {
    id: 'kinetic-pop',
    name: 'Kinetic Pop',
    category: 'Titles',
    previewText: 'POP!',
    style: {
      fontFamily: 'Space Grotesk',
      fontWeight: '800',
      textCase: 'uppercase',
      color: '#FFFFFF',
      backgroundColor: '#000000',
      backgroundOpacity: 85,
      animationIn: 'pop',
      animationOut: 'scale',
      animationDuration: 0.35,
    },
  },
  {
    id: 'sports-action',
    name: 'Sports Action',
    category: 'Titles',
    previewText: 'GAME ON',
    style: {
      fontFamily: 'Space Grotesk',
      fontWeight: '800',
      fontStyle: 'italic',
      textCase: 'uppercase',
      color: '#FFFFFF',
      rotation: -2,
      shadowEnabled: true,
      shadowColor: 'rgba(0,0,0,0.85)',
      shadowBlur: 8,
      shadowX: 4,
      shadowY: 4,
    },
  },
  {
    id: 'sticker-tag',
    name: 'Sticker Tag',
    category: 'Labels',
    previewText: 'NEW',
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 'bold',
      textCase: 'uppercase',
      color: '#000000',
      backgroundColor: '#FFFFFF',
      backgroundOpacity: 100,
      strokeWidth: 0,
      letterSpacing: 2,
    },
  },
  {
    id: 'badge-accent',
    name: 'Badge Accent',
    category: 'Labels',
    previewText: 'SALE',
    style: {
      fontFamily: 'DM Sans',
      fontWeight: 'bold',
      textCase: 'uppercase',
      color: '#000000',
      backgroundColor: '#2EE368',
      backgroundOpacity: 100,
      strokeWidth: 0,
      letterSpacing: 1,
    },
  },
  {
    id: 'quote-editorial',
    name: 'Editorial Quote',
    category: 'Quotes',
    previewText: '“Make yourself heard”',
    style: {
      fontFamily: 'Georgia',
      fontStyle: 'italic',
      fontWeight: '500',
      textCase: 'normal',
      color: '#FFFFFF',
      lineHeight: 1.35,
      shadowEnabled: true,
      shadowColor: 'rgba(0,0,0,0.6)',
      shadowBlur: 5,
      shadowX: 0,
      shadowY: 2,
    },
  },
  {
    id: 'outlined-clean',
    name: 'Outlined Clean',
    category: 'Subtitles',
    previewText: 'WATCH TILL END',
    style: {
      fontFamily: 'Space Grotesk',
      fontWeight: '700',
      textCase: 'uppercase',
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 3,
      letterSpacing: 2,
    },
  },
];

export function createDefaultTextElement(
  type: CanvasTextType,
  currentTime = 0,
  projectDuration = 10,
): CanvasTextElement {
  const safeDuration = projectDuration > 0 ? projectDuration : 10;
  const start = Math.max(0, Math.min(currentTime, Math.max(0, safeDuration - 1)));
  const end = Math.min(safeDuration, start + 3.5);

  const base: Omit<CanvasTextElement, 'type' | 'text' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'color'> = {
    id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    start,
    end,
    x: 50,
    y: 50,
    fontFamily: 'DM Sans',
    textDecoration: 'none',
    align: 'center',
    opacity: 100,
    rotation: 0,
    lineHeight: 1.2,
    letterSpacing: 0,
    wordSpacing: 0,
    textCase: 'normal',
    animationIn: 'none',
    animationOut: 'none',
    animationDuration: 0.4,
    visible: true,
    locked: false,
    zIndex: Date.now(),
  };

  switch (type) {
    case 'heading':
      return {
        ...base,
        type: 'heading',
        text: 'Your Title Here',
        fontSize: 64,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#FFFFFF',
        shadowEnabled: true,
        shadowColor: 'rgba(0,0,0,0.6)',
        shadowBlur: 6,
        shadowX: 0,
        shadowY: 2,
      };
    case 'subheading':
      return {
        ...base,
        type: 'subheading',
        text: 'Episode 04',
        fontSize: 38,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#E0E0E0',
        shadowEnabled: true,
        shadowColor: 'rgba(0,0,0,0.5)',
        shadowBlur: 4,
        shadowX: 0,
        shadowY: 2,
      };
    case 'body':
      return {
        ...base,
        type: 'body',
        text: 'Add your text here',
        fontSize: 24,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#FFFFFF',
      };
    case 'quote':
      return {
        ...base,
        type: 'quote',
        text: '“Make yourself heard.”',
        fontSize: 32,
        fontWeight: '500',
        fontStyle: 'italic',
        fontFamily: 'Georgia',
        color: '#FFFFFF',
        shadowEnabled: true,
        shadowColor: 'rgba(0,0,0,0.5)',
        shadowBlur: 5,
        shadowX: 0,
        shadowY: 2,
      };
    case 'label':
      return {
        ...base,
        type: 'label',
        text: 'NEW',
        fontSize: 20,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#000000',
        backgroundColor: '#2EE368',
        backgroundOpacity: 100,
        textCase: 'uppercase',
      };
  }
}

export function transformTextCase(text: string, textCase?: TextCase): string {
  if (!textCase || textCase === 'normal') return text;
  if (textCase === 'uppercase') return text.toUpperCase();
  if (textCase === 'lowercase') return text.toLowerCase();
  if (textCase === 'title') {
    return text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substring(1).toLowerCase());
  }
  return text;
}

export function getAnimationTransform(
  element: CanvasTextElement,
  time: number,
): { alpha: number; scale: number; offsetY: number; offsetX: number } {
  let alpha = 1;
  let scale = 1;
  let offsetY = 0;
  let offsetX = 0;

  const duration = element.animationDuration || 0.4;
  const inProgress = Math.max(0, Math.min(1, (time - element.start) / duration));
  const outProgress = Math.max(0, Math.min(1, (element.end - time) / duration));

  // In animation
  if (time < element.start + duration && element.animationIn && element.animationIn !== 'none') {
    switch (element.animationIn) {
      case 'fade':
        alpha = inProgress;
        break;
      case 'pop': {
        const c4 = (2 * Math.PI) / 3;
        const overshoot = inProgress === 0 ? 0 : inProgress === 1 ? 1 : Math.pow(2, -10 * inProgress) * Math.sin((inProgress * 10 - 0.75) * c4) + 1;
        scale = 0.5 + 0.5 * overshoot;
        alpha = Math.min(1, inProgress * 1.5);
        break;
      }
      case 'scale':
        scale = inProgress;
        alpha = inProgress;
        break;
      case 'slide':
        offsetY = (1 - inProgress) * 35;
        alpha = inProgress;
        break;
    }
  }

  // Out animation
  if (time > element.end - duration && element.animationOut && element.animationOut !== 'none') {
    switch (element.animationOut) {
      case 'fade':
        alpha = Math.min(alpha, outProgress);
        break;
      case 'drop':
        offsetY += (1 - outProgress) * 35;
        alpha = Math.min(alpha, outProgress);
        break;
      case 'slide':
        offsetY -= (1 - outProgress) * 35;
        alpha = Math.min(alpha, outProgress);
        break;
      case 'scale':
        scale *= outProgress;
        alpha = Math.min(alpha, outProgress);
        break;
    }
  }

  return { alpha, scale, offsetY, offsetX };
}

/**
 * Shared Canvas text element rendering engine.
 * Works uniformly in browser canvas and server export canvas.
 */
export function drawTextElements(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  textElements: CanvasTextElement[] | undefined,
  time: number,
): void {
  if (!textElements || !Array.isArray(textElements) || textElements.length === 0) {
    return;
  }

  // Filter elements that are currently visible at the given time
  const visibleElements = textElements
    .filter(el => el.visible !== false && time >= el.start && time <= el.end)
    .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  if (visibleElements.length === 0) return;

  const resolutionScale = Math.max(0.3, canvasWidth / 1080);

  for (const el of visibleElements) {
    const rawText = el.text || '';
    if (!rawText.trim()) continue;

    const displayText = transformTextCase(rawText, el.textCase);
    const lines = displayText.split('\n');

    const scaledFontSize = Math.round(el.fontSize * resolutionScale);
    const anim = getAnimationTransform(el, time);

    const baseAlpha = (el.opacity ?? 100) / 100;
    const finalAlpha = Math.max(0, Math.min(1, baseAlpha * anim.alpha));
    if (finalAlpha <= 0.001) continue;

    ctx.save();
    ctx.globalAlpha = finalAlpha;

    // Element center coordinate in pixels
    const cx = (el.x / 100) * canvasWidth + anim.offsetX * resolutionScale;
    const cy = (el.y / 100) * canvasHeight + anim.offsetY * resolutionScale;

    ctx.translate(cx, cy);

    if (el.rotation) {
      ctx.rotate((el.rotation * Math.PI) / 180);
    }

    if (anim.scale !== 1) {
      ctx.scale(anim.scale, anim.scale);
    }

    const fontStyle = el.fontStyle || 'normal';
    const fontWeight = el.fontWeight || 'bold';
    const fontFamily = el.fontFamily || 'DM Sans';
    ctx.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px "${fontFamily}", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = el.align === 'justify' ? 'center' : (el.align || 'center');

    const lineHeightMultiplier = el.lineHeight || 1.2;
    const lineSpacing = scaledFontSize * lineHeightMultiplier;
    const totalTextHeight = lines.length * lineSpacing;

    // Measure widths to draw background if configured
    let maxWidth = 0;
    const measuredWidths = lines.map(line => {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
      return w;
    });

    // Draw background if configured
    if (el.backgroundColor && (el.backgroundOpacity ?? 0) > 0) {
      const bgAlpha = ((el.backgroundOpacity ?? 100) / 100);
      const padX = scaledFontSize * 0.45;
      const padY = scaledFontSize * 0.28;
      const radius = scaledFontSize * 0.25;

      const bgW = maxWidth + padX * 2;
      const bgH = totalTextHeight + padY * 2;
      const bgX = -bgW / 2;
      const bgY = -bgH / 2;

      ctx.save();
      ctx.globalAlpha = finalAlpha * bgAlpha;
      ctx.fillStyle = el.backgroundColor;

      // Rounded rectangle
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bgX, bgY, bgW, bgH, radius);
      } else {
        ctx.rect(bgX, bgY, bgW, bgH);
      }
      ctx.fill();
      ctx.restore();
    }

    // Configure Shadow if enabled
    if (el.shadowEnabled) {
      ctx.shadowColor = el.shadowColor || 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = (el.shadowBlur ?? 6) * resolutionScale;
      ctx.shadowOffsetX = (el.shadowX ?? 0) * resolutionScale;
      ctx.shadowOffsetY = (el.shadowY ?? 2) * resolutionScale;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Draw each line of text
    const startY = -((lines.length - 1) * lineSpacing) / 2;

    lines.forEach((line, index) => {
      const lineY = startY + index * lineSpacing;
      let lineX = 0;
      if (el.align === 'left') {
        lineX = -maxWidth / 2;
      } else if (el.align === 'right') {
        lineX = maxWidth / 2;
      }

      // Draw stroke first if configured
      if (el.strokeWidth && el.strokeWidth > 0) {
        ctx.strokeStyle = el.strokeColor || '#000000';
        ctx.lineWidth = el.strokeWidth * resolutionScale * 2;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(line, lineX, lineY);
      }

      // Draw text fill
      ctx.fillStyle = el.color || '#FFFFFF';
      ctx.fillText(line, lineX, lineY);

      // Draw underline if enabled
      if (el.textDecoration === 'underline') {
        const textWidth = measuredWidths[index];
        let underlineX1 = lineX - textWidth / 2;
        let underlineX2 = lineX + textWidth / 2;
        if (el.align === 'left') {
          underlineX1 = lineX;
          underlineX2 = lineX + textWidth;
        } else if (el.align === 'right') {
          underlineX1 = lineX - textWidth;
          underlineX2 = lineX;
        }
        const underlineY = lineY + scaledFontSize * 0.45;

        ctx.beginPath();
        ctx.strokeStyle = el.color || '#FFFFFF';
        ctx.lineWidth = Math.max(1, scaledFontSize * 0.08);
        ctx.moveTo(underlineX1, underlineY);
        ctx.lineTo(underlineX2, underlineY);
        ctx.stroke();
      }
    });

    ctx.restore();
  }
}
