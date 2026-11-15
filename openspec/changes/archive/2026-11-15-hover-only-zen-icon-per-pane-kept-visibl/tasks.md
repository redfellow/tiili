## 1. Hover-only Zen icon

- [x] 1.1 Add to `src/styles.css` near the "Zen toggle" comment `.pane:not(:hover) .pane-zen-toggle:not([data-marked]):not(:focus-visible) { visibility: hidden; }` and update the comment to say it shows on hover or with the dot
  - proof: `grep -n "pane-zen-toggle:not(\[data-marked\])" src/styles.css`
- [x] 1.2 Validate the spec delta
  - proof: `openspec validate hover-only-zen-icon-per-pane-kept-visibl --strict`

## Manual checks after merge (The user)

- With two or more panes, the Zen icon shows only on the pane under the pointer, and the title chip does not shift as the pointer moves.
- In Zen, the lit icon shows on hover; when a hidden pane rings the bell, the icon with its dot shows without hover.
- Double-click on the title row and ⇧⌘↩ toggle Zen with the icon hidden; tooltip still shows on hover.
- During a pane drag and with the find bar open, the icon behaves sensibly (no stuck or flickering icon).
