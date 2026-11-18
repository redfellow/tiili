## Approach

- `src/panes.ts` `paneElement()`: create a `pane-close-toggle` button next to `zenButton` (same mousedown-preventDefault, tabIndex -1, title/aria-label "Close pane" plus platform shortcut). Its click closes the pane it belongs to, by id, through the same close path as ⌘W, then refocuses the focused pane. Exclude it from the title row's dblclick Zen toggle. Expose it on `Pane` as `closeButton` so `src/tab.ts` hides it with one pane, as it does `zenButton`.
- `src/styles.css`: style it like `.pane-zen-toggle`, hidden when the pane isn't hovered (without the data-marked exception).
- `src/topBar.ts` / `src/main.ts`: drop the Close pane entry, `onClosePane` and the unused icon.
