## Approach
One CSS rule in `src/styles.css` beside the "Zen toggle" block:
`.pane:not(:hover) .pane-zen-toggle:not([data-marked]):not(:focus-visible) { visibility: hidden; }`.
`visibility` keeps the 20px slot so the title row layout is unchanged, and a hidden button takes no clicks. `[hidden]` (one pane) keeps `display: none`. `Tab.showZen` in `src/tab.ts` and `Panes.paneElement` need no change. The find bar overlaying the corner and pane drags only affect hover; the icon simply follows `:hover` of the pane.
