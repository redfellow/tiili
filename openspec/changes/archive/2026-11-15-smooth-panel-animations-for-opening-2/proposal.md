## Why
Opening and closing panes barely showed any motion, and a moving pane stretched its content, so the terminal text jumped in size all at once. The user agreed a design in Design view (prototype commit "Design prototype") that fixes both.

## What Changes
- Opening a pane animates visibly: it rises a little, grows from 94 % and fades in on a soft shadow, with a slight spring (about 380 ms).
- Closing a pane animates visibly: it shrinks and fades out above its neighbours (about 180 ms, ease-in); the terminal stays on screen until the fade is done.
- Moving a pane glides with an ease-out-quint motion (about 280 ms).
- During a glide, the terminal and title inside the pane scale evenly instead of stretching. The terminal takes its final font and grid at the start of the move (`refitNow` in `src/terminal.ts`, called from `src/panes.ts`), so the line wrapping changes once and the text then scales smoothly from its old size to its new one. The title stays the same size.
- Each shell still sees one size change per move.
- The drag miniature-preview code that came with the prototype commit is removed from this branch. It belongs to its own card, and the user agreed to this.

## Outcome
- Opening a pane
  - Now: the pane appears almost at once
  - After: the pane rises and grows into place with a slight spring
- Closing a pane
  - Now: the pane disappears
  - After: the pane shrinks and fades out over the panes moving into its place
- Text in a moving pane
  - Now: stretched with the pane, then snaps to its new size
  - After: wraps once, then grows or shrinks smoothly over the glide; the title keeps its size

## Assumptions
- The timings and easings are the prototype's values as designed. The alternative, keeping 180 ms for all motion, is ruled out.
- The close delay before the terminal is disposed is 200 ms, as in the prototype, and is skipped under reduced motion. The alternative, waiting for the animation's own finish event, is ruled out.
