## Why
When the user drags a pane, only a small text label follows the pointer, so it is hard to see what is being moved. A miniature of the pane shows it at a glance.

## What Changes
- Dragging a pane by its top strip shows a 200 px wide miniature of that pane at the cursor, copied from the pane's current contents, with an accent border and a shadow (styled in `src/styles.css`).
- The old text drag label is removed.
- The source pane still dims and the pointer still shows grabbing until drop or cancel.
- The code is the design prototype already on this branch (`src/layout/view.ts`, `src/styles.css`), kept as designed. The prototype's retuned pane motion is already on the base branch, so this change makes no motion change.

## Outcome
- Dragging a pane
  - Now: a label with the pane's chip name, or `Terminal`, follows the pointer
  - After: a 200 px miniature of the pane, with an accent border and shadow, follows the pointer

## Assumptions
- The miniature's width is fixed at 200 px (or the pane's own width if smaller), as in the prototype; ruled out a size setting.
- No new unit test: the miniature is DOM and styling only, which the workspace rules say not to test by class or pixel value; it is checked by hand after merge.
