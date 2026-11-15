# Tabs in a window

## Why
Each window has one auto-tiling grid, so with many panes (several coding agents per project) the grid shrinks until panes are unreadable. Tabs keep separate sets of panes in one window, each with its own grid, and let the user switch between them.

## What Changes
- A window holds tabs and shows one; each tab has its own layout (order, column/row sizes), focused pane (and zoomed pane once Zen mode exists). Tiling mode stays global. Hidden tabs' shells keep running and their terminals hold their size until shown.
- Tabs are made only by hand; a new tab starts with one pane in the focused pane's folder. Closing a tab's last pane closes the tab; the window's last tab closes the window.
- A tab strip on the left of the top bar (after the traffic lights on macOS), hidden with one tab. Label: focused pane's chip text in its tint until renamed. Background tabs show only an attention brick and count.
- Tab right-click menu: Rename…, Pop Out (whole tab, layout and all, to a new window; no-op for the only tab), Close Tab (asks when it holds more than one pane).
- Pane menu gets Move to Tab ▸ (other tabs plus New Tab); dragging a pane's grab strip onto a tab moves it there; dragging tabs reorders them. Move to Window lands in the target's shown tab.
- Keys: New tab ⇧⌘T / Ctrl+Alt+Shift+T; next/previous tab ⇧⌘] / ⇧⌘[ and Ctrl+Tab / Ctrl+Shift+Tab on macOS, Ctrl+PageDown / Ctrl+PageUp on Windows/Linux; move focused pane to next/previous tab ⌃⇧⌘] / ⌃⇧⌘[, Ctrl+Shift+PageDown / Ctrl+Shift+PageUp. macOS Shell menu items for these. ⌘1–9 / Alt+1–9 work in the shown tab only.
- Attention shortcut switches to the tab holding the marked pane. `tiili open` opens in the caller's tab without switching; `tiili list` lists tab by tab, grid order inside each.

## Outcome
- Top bar with two tabs
  - After: tab strip `härvääjä  tiili` on the left, the shown tab highlighted
- Background tab with two marked panes
  - After: a brick and `2` beside its label
- Tab right-click menu
  - After: `Rename…`, `Pop Out`, `Close Tab`
- Pane right-click menu
  - After: `Move to Tab ▸` with the other tabs and `New Tab`
- macOS Shell menu
  - After: `New Tab ⇧⌘T`, `Next Tab ⇧⌘]`, `Previous Tab ⇧⌘[`, `Move Pane to Next Tab ⌃⇧⌘]`, `Move Pane to Previous Tab ⌃⇧⌘[`

## Assumptions
- Pop Out ships in this change (one multi-pane payload); ruled out a follow-up card, which the card allowed if too big.
- A new tab opens right after the shown tab and is shown at once; ruled out appending at the end.
- Rename is an inline text field in the strip (Enter saves, Escape cancels); ruled out a modal dialog.
- Close Tab's confirmation is an in-app dialog like other tiili prompts, naming the pane count; ruled out a native dialog.
- Moving a pane to another tab (menu, drag or keys) shows that tab and focuses the pane; moving to next tab from the last tab creates no new tab and does nothing. Ruled out wrapping or auto-creating.
- Next/previous tab wraps around; ruled out stopping at the ends.
- The listed key choices are kept; a desk check against GNOME, KDE, Ubuntu and Windows defaults (none of Ctrl+Alt+Shift+T, Ctrl+(Shift+)PageUp/Down are bound there by default) is recorded in design.md, with a manual check after merge.
- The window name (Move to Window list) and window title follow the shown tab's focused pane.
