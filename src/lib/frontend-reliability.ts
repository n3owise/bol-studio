import type { CanvasVisualElement, Project } from './types';

/** Let the browser own standard page magnification shortcuts. */
export function isBrowserZoomKey(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'key' | 'code'>) {
  return (event.ctrlKey || event.metaKey) &&
    (['+', '=', '-', '0'].includes(event.key) || ['NumpadAdd', 'NumpadSubtract', 'Numpad0'].includes(event.code));
}

export function canvasKeyboardChange(element: CanvasVisualElement, key: string, shift = false): Partial<CanvasVisualElement> | null {
  if (element.locked) return null;
  const step = shift ? 5 : 1;
  if (key === 'ArrowLeft') return { x: Math.max(0, element.x - step) };
  if (key === 'ArrowRight') return { x: Math.min(100, element.x + step) };
  if (key === 'ArrowUp') return { y: Math.max(0, element.y - step) };
  if (key === 'ArrowDown') return { y: Math.min(100, element.y + step) };
  if (['+', '=', '-'].includes(key)) return { scale: Math.max(.15, Math.min(3.5, Number((element.scale + (key === '-' ? -.05 : .05)).toFixed(2)))) };
  if (key === '[' || key === ']') return { rotation: Math.max(-360, Math.min(360, (element.rotation ?? 0) + (key === '[' ? -5 : 5))) };
  return null;
}

/** History stores the immutable scene before a drag, never its last mouse move. */
export function editSnapshot(project: Project) {
  return {
    words: project.words, settings: project.settings, name: project.name,
    videoEnabled: project.videoEnabled, canvasElements: project.canvasElements,
    activeMediaAssetId: project.activeMediaAssetId,
  };
}

/** Sample React's clock at the caption frame rate while media keeps its own clock. */
export function playbackFrame(time: number, fps: number) {
  return Math.floor(time * fps);
}

/** Recompute window membership only after scrolling, zooming or document edits. */
export function timelineGroupWindow(groups: Project['words'][], start: number, end: number, limit = 200) {
  const visible: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (group.length && group[group.length - 1].end >= start && group[0].start <= end) visible.push(i);
  }
  const cap = Math.max(2, Math.floor(limit));
  if (visible.length <= cap) return { sampled: visible, visible: new Set(visible) };
  const sampled = new Set<number>();
  for (let i = 0; i < cap - 1; i++) sampled.add(visible[Math.floor(i * (visible.length - 1) / Math.max(1, cap - 2))]);
  return { sampled: [...sampled], visible: new Set(visible) };
}

export function timelineWindowIndices(window: ReturnType<typeof timelineGroupWindow>, active: number) {
  if (active < 0 || !window.visible.has(active) || window.sampled.includes(active)) return window.sampled;
  return [...window.sampled, active].sort((a, b) => a - b);
}

/** Compatibility helper; React memoizes window membership separately from playback. */
export function timelineGroupIndices(groups: Project['words'][], start: number, end: number, time: number, limit = 200) {
  return timelineWindowIndices(timelineGroupWindow(groups, start, end, limit),
    activeCaptionIndex(captionTimeIndex(groups), time, { inclusiveEnd: true, preferLast: true }));
}

/** Build once per document edit; preserve original group priority at overlaps. */
export function captionTimeIndex(groups: Project['words'][], padding = 0) {
  return timeIntervalIndex(groups.flatMap((group, index) => group.length
    ? [{ index, start: group[0].start, end: group[group.length - 1].end + padding }]
    : []));
}

export function timeIntervalIndex(intervals: { index: number; start: number; end: number }[]) {
  const entries = [...intervals].sort((a, b) => a.start - b.start || a.index - b.index);
  const maxEnds: number[] = [];
  let maxEnd = -Infinity;
  for (const entry of entries) { maxEnd = Math.max(maxEnd, entry.end); maxEnds.push(maxEnd); }
  return { entries, maxEnds };
}

export function activeCaptionIndex(index: ReturnType<typeof captionTimeIndex>, time: number, options: { inclusiveEnd?: boolean; preferLast?: boolean } = {}) {
  if (!Number.isFinite(time)) return -1;
  let low = 0, high = index.entries.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (index.entries[mid].start <= time) low = mid + 1;
    else high = mid;
  }
  let result = -1;
  for (let i = low - 1; i >= 0 && (options.inclusiveEnd ? index.maxEnds[i] >= time : index.maxEnds[i] > time); i--) {
    const entry = index.entries[i];
    if ((options.inclusiveEnd ? time <= entry.end : time < entry.end) &&
      (result < 0 || (options.preferLast ? entry.index > result : entry.index < result))) result = entry.index;
  }
  return result;
}
