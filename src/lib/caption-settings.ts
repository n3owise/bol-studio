import bounds from './caption-bounds.json';
import type { Settings } from './types';
export { bounds as captionBounds };
export function linkedCaptionSize(settings: Settings, requested: number, linked: boolean): Partial<Settings> {
  const fontSize = Math.max(bounds.fontSize.min, Math.min(bounds.fontSize.max, requested));
  if (!linked || settings.heroFontSize === undefined) return { fontSize };
  const ratio = settings.heroFontSize / settings.fontSize;
  const limited = Math.max(bounds.fontSize.min, bounds.heroFontSize.min / ratio, Math.min(fontSize, bounds.heroFontSize.max / ratio));
  return { fontSize: Math.round(limited * 1000) / 1000,
    heroFontSize: Math.max(bounds.heroFontSize.min, Math.min(bounds.heroFontSize.max, Math.round(limited * ratio))) };
}
