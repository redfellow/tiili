# Design

- **State**: `Panes.zen?: PaneId`, a view state only; `LayoutState` (src/layout/model.ts) is untouched, so order, manual sizes and tiling mode survive.
- **View**: `TileView.render` gets a Zen path: all pane elements stay in the DOM; non-Zen panes get a hidden class (`visibility:hidden`/`display` that keeps xterm alive), the Zen pane is placed in a centred box with two edge handles instead of dividers. Panes missing from state still take the closing path; hidden ones must not.
- **Width**: pure helper `zenWidthPx(columns, cellWidth, areaWidth)` = clamp(columns·cellWidth + chrome, ≥80 cols, ≤0.9·area). Recomputed on window resize and font zoom.
- **Edge drag**: symmetric; holdSize at start, releaseSize at end (like resizeStart/resizeEnd); new column count saved to `settings.zen.width`, broadcast to every window through the existing saved-settings path.
- **PTY**: hidden panes `holdSize()` on entering Zen; `releaseSize(true)` on leaving.
- **Rules** (in Panes): focus/attention/new pane → set zen to the new focus; remove of Zen pane → zen = new focus; ≤1 pane → zen cleared; pane-control open → zen unchanged; layout actions and reset → leave Zen then act; drag/swap no-op; moving the Zen pane out → zen cleared.
- **Shortcut**: `zenAction(event, platform)` in keymap.ts (⇧⌘Enter / Ctrl+Shift+Enter), swallowed in `Panes.shortcut()`. macOS menu item "Zen Mode" `Shift+Cmd+Enter` emits the "pane" app event with a `zen` action through `viaMenu()`.
- **Double-click**: `dblclick` on `.pane-title`, ignored if a drag happened; dragPane's click-vs-drag threshold is unchanged.
- **Attention dot**: derived from attention marks for panes in this window other than the Zen pane.
- **Motion**: FLIP via src/layout/motion.ts; reduced motion snaps.
