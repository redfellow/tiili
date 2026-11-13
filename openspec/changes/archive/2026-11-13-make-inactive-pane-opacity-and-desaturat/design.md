## Approach
Follow the prototype in `card-plans/3baa38f1-.../attachments/design-reference.md`:
- `src/settings.ts`: `behaviour.hoverHighlight` and `inactive { opacity, desaturate }` with `INACTIVE_OPACITY` range; `normalize` clamps/falls back.
- `src/panes.ts`: `styleRoot(settings)` sets `data-hover-highlight`, `data-desaturate` and `--inactive-opacity` on `#panes`, called at construction and in `applySettings`.
- `src/styles.css`: drop `opacity` from `.pane`; fade `.pane > :is(.pane-title, .pane-terminal)` instead; desaturate and hover rules keyed on the root attributes.
- `src/settingsDialog.ts`: slider + two checkboxes, wired into load/collect/disable like the existing fields.

Putting the switches on the root keeps per-pane code untouched and lets CSS do the work; content-only fade is just moving the opacity from the pane to its children.
