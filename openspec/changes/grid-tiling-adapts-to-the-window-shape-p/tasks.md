## 1. Layout choice

- [x] 1.1 Add the optional cell-size argument (with previous column count for hysteresis) to `gridFor` in `src/layout.ts`; Grid scores c = 1..n as in design.md; no size keeps `ceil(sqrt(n))`. Add table-driven portrait and landscape cases for n = 2, 3, 4, 5, 7 and a hysteresis case to `src/layout.test.ts`.
  Tests to update: src/layout.test.ts
  - proof: `npx vitest run src/layout.test.ts`
  - proof: `npx eslint src/layout.ts src/layout.test.ts`
- [x] 1.2 Carry the pane area in `LayoutState` and add `setArea` in `src/layout/model.ts`; `reflow` passes area and previous cols. Add portrait/landscape and size-keeping cases to `src/layout/model.test.ts`.
  Tests to update: src/layout/model.test.ts
  - proof: `npx vitest run src/layout/model.test.ts`
  - proof: `npx eslint src/layout/model.ts src/layout/model.test.ts`

## 2. Window wiring

- [ ] 2.1 In `src/tab.ts`/`src/panes.ts` measure the tab area in cells, set it before add/remove/restore/mode change, and re-flow on a ResizeObserver debounced 250 ms only when the grid changes.
  - proof: `npx eslint src/tab.ts src/panes.ts`
- [ ] 2.2 `tabPlan` in `src/session.ts` validates saved sizes against saved Grid `cols`/`rows` and returns that shape; panes restore it. Add a case to `src/session.test.ts` for a saved 1×3 Grid with custom sizes.
  Tests to update: src/session.test.ts
  - proof: `npx vitest run src/session.test.ts`
  - proof: `npx eslint src/session.ts src/session.test.ts`
- [ ] 2.3 Draw the Grid tile picture in `src/settingsDialog.ts` for the window's shape in cells.
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- In a portrait window (~790 px wide) open 2 then 3 panes in Grid mode: they stack one above the other.
- Drag the window from landscape to portrait: panes rearrange once after the drag ends, and not back and forth near the threshold.
- Drag a divider, quit and reopen: the layout and sizes come back.
- Open Settings in a portrait window: the Grid picture shows rows.
