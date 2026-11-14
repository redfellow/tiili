## Approach

A new module, `src/layout/motion.ts`, holds the pure part. `flipFrames(before, after)` takes the panes' bounding rects
by pane id before and after a layout change and returns, for each pane, the keyframes to play: a translate and scale
from its old rect to its new one for panes that moved, a grow-in for panes that are new, and nothing for panes whose
rect didn't change. `prefersReducedMotion()` reads `matchMedia('(prefers-reduced-motion: reduce)')`.

`TileView` (in `src/layout/view.ts`) wraps each relayout. It snapshots the rects, applies the new grid as it does today
and snapshots again. Then it calls `element.animate(frames, { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' })` on
each pane. This covers opening, closing, re-flow, reset and swap. A closing pane is kept, pinned (`position: absolute`)
at its last rect, and animated to scale 0.92 with opacity 0, then removed. Its PTY is closed right away, as today.

The fit/PTY resize runs once, when the animation finishes (or at once under reduced motion), so the shell sees a
single size change. A new relayout during a running animation cancels it and starts from the current visual position.
Divider drags call the existing path with animation disabled.

Why FLIP: it is cheap, runs on the compositor, and works with the existing CSS grid without changing the layout
model.
