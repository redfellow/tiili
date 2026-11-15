## Why
When the user drags a pane, only a small text label follows the pointer, so it is hard to see what is being moved. A miniature of the pane shows it at a glance.

## What Changes
- Dragging a pane by its top strip shows a 200 px wide miniature of that pane at the cursor, copied from the pane's current contents, with an accent border and a shadow (styled in `src/styles.css`).
- The old text drag label is removed.
- The source pane still dims and the pointer still shows grabbing until drop or cancel.
- Pane motion is retuned (brought in from the "Smooth panel animations" prototype, which the drag preview's code was built on): moves take about 280 ms easing out, new panes about 380 ms with a slight rise, overshoot and lifted shadow, closing panes about 180 ms easing in with a slight drop, drawn above the others. During a glide the terminal and title scale evenly; a closing pane's terminal stays until it has faded out. This modifies pane-tiling's "Pane motion" requirement (was about 180 ms for all).
- The code is the design prototype already on this branch (`src/layout/view.ts`, `src/styles.css`), kept as designed.

## Outcome
- Dragging a pane
  - Now: a label with the pane's chip name, or `Terminal`, follows the pointer
  - After: a 200 px miniature of the pane, with an accent border and shadow, follows the pointer

- Opening a pane
  - Now: panes grow and glide in about 180 ms
  - After: moving panes glide in about 280 ms; the new pane rises in over about 380 ms with a slight overshoot
- Closing a pane
  - Now: the pane shrinks and fades as its terminal disappears
  - After: the pane drops and fades in about 180 ms above the others, its terminal visible until it has faded

## Assumptions
- The miniature's width is fixed at 200 px (or the pane's own width if smaller), as in the prototype; ruled out a size setting.
- No new unit test: the miniature is DOM and styling only, which the workspace rules say not to test by class or pixel value; it is checked by hand after merge.
- The spec gives timings as "about" values and leaves the exact easing curves, rise/drop distances and the 200 ms dispose wait to the code (`src/layout/motion.ts`, `src/panes.ts`); ruled out pinning pixel and curve values in the spec.
- Existing motion tests keep their scenario names, which still hold; no new test for timings or scaling, which are visual; ruled out a test asserting duration constants.
