import type { PaneId } from "./model";

/** A pane's place and size on screen, in CSS pixels. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How long a pane takes to reach its new place. */
export const MOTION_MS = 280;
/** Ease-out-quint: quick to start, a long soft landing. */
export const MOTION_EASING = "cubic-bezier(.22,1,.36,1)";
/** A new pane takes a little longer than a move so the eye catches it arriving. */
export const ENTER_MS = 380;
/** Ease-out with a slight overshoot: the new pane settles into place with a little spring. */
export const ENTER_EASING = "cubic-bezier(.34,1.35,.64,1)";
/** A closing pane leaves quickly; ease-in so it speeds away. */
export const EXIT_MS = 180;
export const EXIT_EASING = "cubic-bezier(.4,0,1,1)";
/** The scale a new pane grows in from and a closing pane shrinks to. */
const SHRUNK = 0.94;
/** A new or closing pane lifts off the grid on a soft shadow, so it reads against the dark mortar. */
const LIFTED = "0 10px 32px rgba(0,0,0,.45)";
const FLAT = "0 0 0 rgba(0,0,0,0)";
/** Rect changes smaller than this many pixels count as no change. */
const EPSILON = 0.5;

/** What a pane does in a layout change: glides to a new rect, grows in, or shrinks and fades out. */
export type MotionKind = "move" | "enter" | "exit";

export interface PaneMotion {
  kind: MotionKind;
  duration: number;
  easing: string;
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
        duration: ENTER_MS,
        easing: ENTER_EASING,
        frames: [
          { transformOrigin: "50% 50%", transform: `translateY(10px) scale(${SHRUNK})`, opacity: 0, boxShadow: LIFTED },
          { transformOrigin: "50% 50%", transform: "none", opacity: 1, boxShadow: FLAT },
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
      duration: MOTION_MS,
      easing: MOTION_EASING,
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
      duration: EXIT_MS,
      easing: EXIT_EASING,
      frames: [
        { transformOrigin: "50% 50%", transform: "none", opacity: 1, boxShadow: FLAT },
        { transformOrigin: "50% 50%", transform: `translateY(6px) scale(${SHRUNK})`, opacity: 0, boxShadow: LIFTED },
      ],
    });
  }
  return motions;
}

/** True when the OS asks for reduced motion: panes then take their new places instantly. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
