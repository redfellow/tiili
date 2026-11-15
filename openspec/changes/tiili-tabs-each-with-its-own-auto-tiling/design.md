# Design

## Split of Panes
- `src/panes.ts` keeps the window part: keys, menus, top bar, attention, window name/title, moves between windows, the tab list and which tab is shown.
- New `src/tab.ts` `Tab`: its panes, its own `LayoutState` and `TileView` rendered into its own container under `#panes`, its focused pane, optional name. Hidden tabs' containers get `display: none`.
- Pure helpers in `src/tabs.ts` (tested): tab label (name or focused chip), next/previous index with wrap, reorder, insert position, list order across tabs, and "which tab holds session X".

## Hidden tabs and PTY size
- On hide: `holdSize()` on every terminal of the tab. On show: `releaseSize(true)` so each refits once if the area changed. The ResizeObserver never sends a size while held.

## Moves
- Between tabs: move the pane element and terminal object to the target tab's view and layout; no detach.
- Move to Window: unchanged path; `arrive` adds to the shown tab.
- Pop Out: `MovePayload` gains `{ kind: "tab"; name?; layout: { colSizes, rowSizes }; focused: number; panes: PanePayload[] }` (panes in grid order). `windows.rs` takes the payload as one token for the new window (serde passes it through opaquely), detaching every session first. Only tab → no-op.

## Control
- Window reports order as the concatenation of tabs in strip order, grid order inside each, through the existing `setOrder`; `grid_order` unchanged.
- `tiili open` resolves the caller's session to its tab and adds the pane there without showing it or moving focus.

## Attention
- `focusSession` first shows the tab holding the session. Background tab badge counts that tab's marked sessions from `showMarks`.

## Keys and menus
- `TabAction` and `tabAction(event, platform)` in `src/keymap.ts`; swallowed in `Panes.shortcut()`. macOS: Shell menu items in `macos_menu()` emitting the "pane" app event, carried by `viaMenu()`.
- Desk check of system shortcuts: Ubuntu binds Ctrl+Alt+T (not with Shift); GNOME workspace moves use Super/Ctrl+Alt arrows and Super+PageUp/Down; KDE binds Ctrl+F1–F4 and Meta keys; Windows binds Win-key chords. None default-bind the chosen keys.
