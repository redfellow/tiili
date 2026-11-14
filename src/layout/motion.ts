import type { PaneId } from "./model";

/** A pane's place and size on screen, in CSS pixels. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How long a pane takes to reach its new place. */
export const MOTION_MS = 180;
/** Ease-out: quick to start, gentle to land. */
export const MOTION_EASING = "cubic-bezier(.2,.8,.2,1)";
/** The scale a new pane grows in from and a closing pane shrinks to. */
const SHRUNK = 0.92;
/** Rect changes smaller than this many pixels count as no change. */
const EPSILON = 0.5;

/** What a pane does in a layout change: glides to a new rect, grows in, or shrinks and fades out. */
export type MotionKind = "move" | "enter" | "exit";

export interface PaneMotion {
  kind: MotionKind;
  frames: Keyframe[];
}

function same(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.left - b.left) < EPSILON &&
    Math.abs(a.top - b.top) < EPSILON &&
    Math.abs(a.width - b.width) < EPSILON &&
    Math.abs(a.height - b.height) < EPSILON
  );
}

/**
 * The keyframes each pane plays after a layout change, from its rect `before` to its rect `after` (FLIP): a pane
 * that moved starts translated and scaled onto its old rect and plays to its new one; a new pane grows in; a pane
 * that is gone shrinks and fades out at its old rect. Panes whose rect didn't change get no entry.
 */
export function flipFrames(before: Map<PaneId, Rect>, after: Map<PaneId, Rect>): Map<PaneId, PaneMotion> {
  const motions = new Map<PaneId, PaneMotion>();
  for (const [id, to] of after) {
    const from = before.get(id);
    if (!from) {
      motions.set(id, {
        kind: "enter",
        frames: [
          { transformOrigin: "50% 50%", transform: `scale(${SHRUNK})`, opacity: 0 },
          { transformOrigin: "50% 50%", transform: "none", opacity: 1 },
        ],
      });
      continue;
    }
    if (same(from, to) || to.width <= 0 || to.height <= 0) continue;
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    motions.set(id, {
      kind: "move",
      frames: [
        { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: "0 0", transform: "none" },
      ],
    });
  }
  for (const id of before.keys()) {
    if (after.has(id)) continue;
    motions.set(id, {
      kind: "exit",
      frames: [
        { transformOrigin: "50% 50%", transform: "none", opacity: 1 },
        { transformOrigin: "50% 50%", transform: `scale(${SHRUNK})`, opacity: 0 },
      ],
    });
  }
  return motions;
}

/** True when the OS asks for reduced motion: panes then take their new places instantly. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
