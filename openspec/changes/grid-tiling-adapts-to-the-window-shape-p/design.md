## Approach

- `src/layout.ts`: `gridFor(n, mode = "grid", size?: { cols: number; rows: number; prev?: number })` where size is the pane area in character cells and `prev` the current column count. Only `grid` uses size. `chooseGridColumns(n, size)`: score each c in 1..n by `|ln((W/c)/(H/r) / (80/24))| + 0.15*(r*c-n)`, discard c whose pane width < 60 columns unless all are; pick lowest. Hysteresis: if `prev` is given and differs from the pick, keep `prev` unless the area's aspect, measured in 80×24 pane units, lies outside [0.87, 1.15] of the boundary between the two scores (implementation: keep prev when its score is within ln(1.15) of the best).
- `src/layout/model.ts`: `LayoutState` gets optional `area?: {cols, rows}`; `reflow` passes it and `prev.cols` to `gridFor`. New `setArea(state, area)` re-flows; tracks keep sizes when counts are unchanged (existing rule).
- `src/tab.ts`/`src/panes.ts`: measure the tab area in cells (existing cell metrics used near `MIN_COLS * cell.width`), set the area before add/remove/restore, and on a ResizeObserver debounced 250 ms call `relayout(setArea(...))` only when the grid would change.
- `src/session.ts`: `tabPlan` validates sizes against saved `layout.cols`/`layout.rows` when they are positive integers with cols*rows ≥ n and the mode is grid; otherwise `gridFor(n, mode)`. The plan returns `cols`/`rows` so the tab restores that shape until the first settled measure.
- `src/settingsDialog.ts`: `tilingIcon("grid")` passes the window's size in cells (from `window.innerWidth/innerHeight` and cell metrics) and draws in a viewBox of that aspect.

Why: the scoring lives in the pure `gridFor`, so it is unit-tested without a window; the model keeps its existing size-keeping rule.
