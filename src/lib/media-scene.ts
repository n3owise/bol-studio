import type { CanvasVisualElement } from './types';
/** Stable ordering: equal layers retain their saved insertion order. */
export function orderedElements(elements: CanvasVisualElement[]): CanvasVisualElement[] {
  return [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
}
