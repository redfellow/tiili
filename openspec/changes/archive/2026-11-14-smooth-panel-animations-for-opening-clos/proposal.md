## Why

Panes jump into place today when they open, close or move, so it's hard to follow where a terminal went. Reijo wants the
panes to animate, in the spirit of how herdr animates its panes ("looked damn cool").

## What Changes

- A newly opened pane grows in where the grid places it, and a closed pane shrinks and fades out.
- When the grid re-flows (a pane opens or closes, the tiling mode changes, or the layout is reset) and when two panes swap
  (by dragging or with the keyboard), every pane that moves glides from its old place to its new one.
- The animations are quick, about 150–200 ms with an ease-out curve, so keyboard use never waits on them.
- When the OS asks for reduced motion, panes change instantly as they do now.
- Dragging a divider, zooming and the PTY resize rules don't change. Each PTY is resized once, to the pane's final size.

## Outcome

- Opening a pane
  - Now: the new pane appears at once and the others jump to their new places
  - After: the new pane grows in and the other panes glide to their new places in about 180 ms
- Closing a pane
  - Now: the pane disappears and the rest jump to fill the space
  - After: the pane shrinks and fades out while the rest glide to fill the space
- Swapping panes
  - Now: the two panes switch places instantly
  - After: the two panes slide past each other into their new places

## Assumptions

- The animation uses FLIP (measure the panes before and after the change, then play the difference with the Web
  Animations API) instead of animating CSS grid tracks. Ruled out: animating `grid-template` sizes, which isn't
  smooth in WebKit.
- The terminal content isn't redrawn on every frame: it is scaled with its pane and refitted once at the end. Ruled
  out: resizing the PTY during the animation.
- The duration is 180 ms with an ease-out curve. Ruled out: 300 ms.
- Moving a pane to another window animates only as an ordinary open and close in each window.
