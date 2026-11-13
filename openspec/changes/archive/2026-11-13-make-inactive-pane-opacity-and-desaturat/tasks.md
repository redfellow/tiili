## 1. Inactive looks

- [x] 1.1 Merge `origin/hv/main` first (it carries the cursor/settings overhaul this builds on). Add `behaviour.hoverHighlight`, `inactive { opacity, desaturate }`, `INACTIVE_OPACITY` and their defaults/normalisation to `src/settings.ts`; extend the table-driven normalise tests in `src/settings.test.ts` for missing, invalid and out-of-range values.
  Tests to update: src/settings.test.ts
  - proof: `npx vitest run src/settings.test.ts`
  - proof: `npx eslint src/settings.ts src/settings.test.ts`
- [x] 1.2 Add the Opacity slider, Desaturate and mouseover-highlight checkboxes to `src/settingsDialog.ts` (load, collect, disable while saving), and `styleRoot` in `src/panes.ts` called at start and from `applySettings`.
  Tests to update: src/settingsSession.test.ts
  - proof: `npx vitest run src/settingsSession.test.ts`
  - proof: `npx eslint src/settingsDialog.ts src/panes.ts`
- [x] 1.3 In `src/styles.css`, move the inactive fade from `.pane` to its title chip and terminal, add the desaturate and hover-highlight rules keyed on `#panes[data-desaturate]` / `#panes[data-hover-highlight]`.
  - proof: `grep -nE "inactive-opacity|data-desaturate|data-hover-highlight" src/styles.css`
  - proof: `npm run typecheck`
- [x] 1.4 Validate the spec deltas.
  - proof: `openspec validate make-inactive-pane-opacity-and-desaturat --strict`

## Manual checks after merge (The user)
- Open four or more panes: inactive panes keep a solid background while title and text fade; the Opacity slider changes the fade live.
- Tick Desaturate: inactive content turns grey; the focused pane keeps colour.
- With mouseover highlight on, hovering an inactive pane shows it at full opacity and colour with a faint top accent line; with it off, nothing changes on hover.
