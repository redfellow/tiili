## Approach
Keep the prototype as designed. `flipFrames` in `src/layout/motion.ts` now gives each motion its own duration and easing (enter, move, exit). `src/layout/view.ts` calls a new `motionPlay` hook once the panes are laid out in their new places. In `src/panes.ts` that hook calls `refitNow()` on each terminal, which applies the final font and grid without telling the PTY and returns the ratio of old font size to new. View then counter-scales `.pane-terminal` (from ratio/s to none) and `.pane-title` (from 1/s to none) inside each moving pane, so the content scales evenly instead of stretching. `releaseSize(true)` at the end still sends the shell one resize. A closing pane is appended on top (z-index 1) so its fade can be seen.

## Out of scope
The drag preview (`dragPreview`, `DRAG_PREVIEW_WIDTH`) is in the prototype commit but belongs to another card. The user agreed to remove it here, which brings back the earlier label ghost.
