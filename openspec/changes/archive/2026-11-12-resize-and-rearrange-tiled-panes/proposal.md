## Why

Auto-tiling (docs/concept.md) places terminals in an even grid, but the concept also promises that "panes can be resized and rearranged later". People running several agents want a bigger pane for the one they watch, and want related panes next to each other.

## What Changes

- Draggable dividers between grid rows and columns. Each affected PTY gets its new rows/columns once the drag settles (pointer up), not on every move.
- Swap two panes by dragging one pane's top-edge grab strip onto another pane. Dragging inside the terminal still selects text.
- Keyboard: move the focused pane left/right/up/down (swaps with its neighbour), and reset to the automatic grid.
  - macOS: ⌃⌘←/→/↑/↓ move, ⌃⌘0 reset.
  - Windows and Linux: Ctrl+Alt+Shift+←/→/↑/↓ move, Ctrl+Alt+Shift+0 reset (avoids readline Ctrl+arrows, Ctrl+Shift+arrow selection, Windows Snap and GNOME workspace keys).
- Re-flow on open/close: manual row and column sizes are kept while the grid keeps its shape; when the grid changes shape, only the dimension whose track count changed resets to equal sizes, the other keeps its manual sizes.
- New spec `pane-layout`.

## Outcome

- Hovering a divider between panes
  - After: resize cursor (`col-resize` / `row-resize`); the divider is the existing 3 px mortar gap.
- Dragging a pane's top edge onto another pane
  - After: the two panes swap places.
- Pressing ⌃⌘0 (macOS) or Ctrl+Alt+Shift+0 (Windows/Linux)
  - After: all panes return to the even automatic grid.

## Assumptions

- Builds on the scaffold card and the auto-tiling card; the build merges `origin/main` after both land and adapts to their module names. Ruled out: building before them.
- Sizes are per grid track (row heights, column widths as fractions), not per pane; ruled out per-pane free sizing (nested splits are out of scope).
- Minimum track size is enough for 20 columns × 4 rows of the terminal font; ruled out allowing collapse to zero.
- Moving a pane at the grid edge does nothing (no wrap-around); ruled out wrapping.
- The grab strip is the pane's top edge (where the focus line sits), 6 px tall, using `--term-gap`/accent tokens only; ruled out a visible handle icon or new colours.
- Divider drag shows live layout while xterm refits only at the end; PTY resize is sent once per affected pane on pointer up.
- Out of scope: pop-out windows, saving layouts across restarts, nested splits.
- The divider keeps its accent colour while being dragged (kept as built); ruled out removing it after review.
