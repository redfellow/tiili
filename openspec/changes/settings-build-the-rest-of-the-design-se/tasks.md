## 1. Model
- [ ] 1.1 Add `TILING_MODES` and `gridFor(n, mode)` to `src/layout.ts`. Add `mode`, `emptyLayout(mode)` and `setMode` to `src/layout/model.ts`. Extend the table tests with the "Tiling mode sizes" scenario.
  Tests to update: src/layout.test.ts, src/layout/model.test.ts
  - proof: `npx vitest run src/layout.test.ts src/layout/model.test.ts`
- [ ] 1.2 Add `src/responsive.ts` with `responsiveFont`, plus a table-driven `src/responsive.test.ts` (fast tier) covering the full pane, the quarter pane, the floors and responsive text off.
  - proof: `npx vitest run src/responsive.test.ts`
- [ ] 1.3 Add `tiling` and `responsive` to `Settings`, `DEFAULT_SETTINGS` and `normalize` in `src/settings.ts`, with tests for missing and invalid values (Invalid saved tiling).
  Tests to update: src/settings.test.ts, src/settingsSession.test.ts
  - proof: `npx vitest run src/settings.test.ts src/settingsSession.test.ts`

## 2. Wiring and UI
- [ ] 2.1 `src/panes.ts`: build the first layout in the saved mode and call `setMode` on a mode change in `applySettings`. `src/terminal.ts`: add `applySize` before each fit and set `overviewRuler` width 8.
  - proof: `npx eslint src/panes.ts src/terminal.ts`
- [ ] 2.2 `src/settingsDialog.ts`: add the Appearance and Behaviour tabs (tablist, arrow keys, open on Appearance), the stacked Family field, the Size slider, the Tiling list with icons and hint, and the Responsive text and Panes fieldsets. Reset and Disabled-while-saving cover the new controls.
  - proof: `npx eslint src/settingsDialog.ts`
- [ ] 2.3 `src/layout/view.ts` and `src/styles.css`: add the drag ghost, source dimming and the grabbing cursor, plus the styles for the tabs, tiling icons and the hidden overview ruler.
  - proof: `npx eslint src/layout/view.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Open Settings: there are two tabs, and Left/Right arrows switch them. Family sits above its list.
- Choose each tiling mode with 5 panes open: the layout changes live. Save, restart, and the mode is kept.
- With responsive text on, open 4+ panes: the text shrinks in small panes. Turn it off and the text returns to the chosen size.
- Drag a pane by its grab strip: a ghost label follows the pointer and the source pane dims.
- The scrollbar is slim, with no hairline.
