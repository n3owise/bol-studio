/**
 * Where a caption can be dropped: the three horizontal and three vertical
 * anchors the alignment buttons set, and nothing in between.
 *
 * Dragging used to snap to a 5% grid, which is 441 landing spots — fine enough
 * that the caption twitched to a new one on almost every pixel of mouse travel,
 * so the drag read as glitchy without ever helping anything line up. The nine
 * anchors are the positions worth having, and they are the same numbers the
 * buttons use, so dragging somewhere and clicking to it agree.
 *
 * The bottom anchor sits at 82 rather than 85 because descenders and a second
 * caption line need the room.
 */
export const CAPTION_ANCHORS_X = [15, 50, 85];
export const CAPTION_ANCHORS_Y = [15, 50, 82];
/**
 * How close the pointer must come, in percent of the frame, before an anchor
 * takes the caption. Outside it the caption follows the mouse exactly, so a
 * deliberate position off-anchor is still possible without holding Alt.
 */
const CAPTION_SNAP_RANGE = 6;

/** The nearest anchor within range, or the raw value when there is none. */
export function snapToAnchor(value: number, anchors: number[]): { value: number; anchor: number | null } {
  let best: number | null = null;
  for (const a of anchors) {
    if (Math.abs(value - a) <= CAPTION_SNAP_RANGE
      && (best === null || Math.abs(value - a) < Math.abs(value - best))) best = a;
  }
  return { value: best ?? value, anchor: best };
}
