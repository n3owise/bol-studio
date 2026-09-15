/**
 * Where each short-form app draws its own interface over your video.
 *
 * A caption that sits behind the Reels caption block or the Shorts title is the
 * most common way a finished export is wasted, and it is invisible while
 * editing because the editor draws none of that furniture.
 *
 * The numbers are fractions of the frame, measured against a 1080x1920 portrait
 * screenshot of each app, and rounded outward. They are approximations of a
 * layout the apps change without notice, so they are drawn as a warning, never
 * enforced: nothing here moves or clips a caption.
 */
export type SafeAreaId = 'none' | 'reels' | 'shorts';

export type SafeAreaZone = {
  /** Which edge this reserved strip hangs off. */
  edge: 'top' | 'bottom' | 'right';
  /** Fraction of frame height (top/bottom) or width (right). */
  size: number;
  label: string;
};

export type SafeAreaSpec = {
  id: SafeAreaId;
  name: string;
  /** What the creator is being warned about, in one line. */
  note: string;
  zones: SafeAreaZone[];
};

export const SAFE_AREAS: Record<Exclude<SafeAreaId, 'none'>, SafeAreaSpec> = {
  reels: {
    id: 'reels',
    name: 'Instagram Reels',
    note: 'The caption block and audio strip cover the bottom sixth of the frame.',
    zones: [
      { edge: 'top', size: 0.07, label: 'Status bar · Reels header' },
      { edge: 'bottom', size: 0.18, label: 'Username · caption · audio' },
      { edge: 'right', size: 0.13, label: 'Like · comment · share' },
    ],
  },
  shorts: {
    id: 'shorts',
    name: 'YouTube Shorts',
    note: 'The title and channel row sit lower than the Reels block, but the action rail is wider.',
    zones: [
      { edge: 'top', size: 0.06, label: 'Status bar · Shorts header' },
      { edge: 'bottom', size: 0.16, label: 'Title · channel · Subscribe' },
      { edge: 'right', size: 0.14, label: 'Like · dislike · comment · remix' },
    ],
  },
};

/** The spec to draw, or null when the overlay is off or unknown. */
export function safeAreaFor(id: SafeAreaId | undefined): SafeAreaSpec | null {
  if (!id || id === 'none') return null;
  return SAFE_AREAS[id] ?? null;
}

/**
 * Whether a caption sitting at `position` (percent from the top, the value the
 * Vertical Position slider writes) would fall inside a reserved strip.
 *
 * Only the vertical edges are checked: horizontal position is a percentage of
 * width and the caption is centred on it, so the right-hand action rail would
 * need the rendered text width to answer properly. Reporting a definite vertical
 * clash beats reporting a guessed horizontal one.
 */
export function positionCollides(spec: SafeAreaSpec | null, position: number): SafeAreaZone | null {
  if (!spec) return null;
  const fraction = position / 100;
  for (const zone of spec.zones) {
    if (zone.edge === 'top' && fraction < zone.size) return zone;
    if (zone.edge === 'bottom' && fraction > 1 - zone.size) return zone;
  }
  return null;
}
