## Approach
Port the accepted prototype diff from `card-plans/3baa38f1-.../attachments/design-reference.md` onto the current code. Much of what it adds (inactive settings and hover) already exists.
- `layout.ts`: `TILING_MODES` and `gridFor(n, mode = "grid")`. Columns per mode: grid ceil(√n), wide ceil(n/floor(√n)), tall floor(√n), columns n, rows 1.
- `layout/model.ts`: `LayoutState.mode`, `emptyLayout(mode)`, `setMode()`. `reflow` passes the mode on.
- `responsive.ts` (new): a pure `responsiveFont(font, responsive, pane, area)`. Linear scale r = √(pane area / tiled area), and drop = strength·(1−r). The size floor is 7 px, the line-height floor is 1, and letter spacing has a −2 px floor.
- `terminal.ts`: `applySize` runs before each fit so that a pane's text follows its size. Set `overviewRuler: { width: 8 }`.
- `settings.ts`: add `tiling` and `responsive` with defaults and normalisation.
- `panes.ts`: build the first layout in the saved mode, and call `setMode` in `applySettings` when the mode changes.
- `settingsDialog.ts`: tabs with roving arrow keys, the tiling pickList with SVG icons, the responsive and panes fieldsets, and the Family field stacked above its list. Opening the dialogue shows the Appearance tab.
- `view.ts` and `styles.css`: the drag ghost after the pointer moves 3 px, plus the styles for the ghost, tabs and scrollbar.

Why: the user accepted this prototype in Design, so porting it keeps the result the same as what they approved.
