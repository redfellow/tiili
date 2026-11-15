## Why
The Zen icon sits on every pane's title row all the time, adding clutter the user rarely needs. They want it only while the pointer is over that pane.

## What Changes
- The Zen icon (`.pane-zen-toggle`) shows only while the pointer is over its pane, on every pane including the Zen pane (lit in the accent there).
- When not shown it keeps its space (`visibility`/opacity, not `display: none`), so the title chip never shifts or re-truncates.
- While it carries the attention dot (`[data-marked]`) it stays visible without hover.
- Unchanged: hidden altogether with one pane; double-click on the title row, ⇧⌘↩ / Ctrl+Shift+Enter and Shell ▸ Zen Mode still toggle Zen; the tooltip stays.

## Outcome
- A pane the pointer is not over
  - Now: Zen icon shown at the right end of the title row
  - After: no icon; the space stays empty
- Pointer over a pane
  - After: Zen icon shown (lit in the accent on the Zen pane)
- Zen on, a hidden pane rings the bell
  - After: the lit icon with its dot shows without hover

## Assumptions
- Done in CSS only with `.pane:not(:hover) .pane-zen-toggle:not([data-marked]) { visibility: hidden; }`; ruled out a JS pointer-tracking approach.
- During a pane drag the icon follows the CSS hover state the webview reports; no special drag handling (ruled out forcing it shown or hidden during drags).
- Keyboard focus on the icon (`:focus-visible`) also shows it, so it is reachable by Tab; ruled out leaving it invisible while focused.
