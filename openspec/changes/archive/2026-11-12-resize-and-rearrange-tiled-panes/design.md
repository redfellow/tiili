## Approach

- **Layout model** (`src/layout/model.ts`, pure, no DOM): state `{ order: PaneId[], cols: number, rows: number, colSizes: number[], rowSizes: number[] }` with sizes as fractions summing to 1. Functions: `resizeTrack(state, axis, dividerIndex, delta, min)`, `swap(state, a, b)`, `move(state, id, dir)`, `reset(state)`, `addPane(state, id)`, `removePane(state, id)`. `addPane`/`removePane` use the auto-tiling grid shape (from the auto-tiling card) and keep `colSizes`/`rowSizes` for any axis whose count is unchanged, resetting only the changed axis to equal.
- **Render**: CSS grid `grid-template-columns/rows` from the fractions as `fr`; dividers are absolutely positioned hit areas over the 3 px gaps (`--term-gap`) with `col-resize`/`row-resize` cursors, using pointer capture.
- **PTY resize on settle**: on pointer up, refit each pane whose cell box changed and call the existing `pty_resize` once per pane. Keep a pure helper `changedPanes(before, after)` so the "only affected PTYs" rule is unit tested.
- **Swap by drag**: HTML pointer drag from a pane's top grab strip; drop target highlighted with the accent token outline; drop calls `swap`.
- **Keys**: extend the pure keymap (`src/keymap.ts` from the scaffold) with `layoutAction(event, platform): {move: dir} | 'reset' | null`; handled before xterm via `attachCustomKeyEventHandler`, returning false so keys do not reach the shell.

## Why

A pure model makes resize, swap and re-flow unit-testable without a webview; per-track fractions match "rows and columns" and CSS grid directly.

## Risks

- Webview pointer behaviour differs slightly per OS (WebKit on macOS/Linux, WebView2 on Windows); pointer events with capture are supported on all three. Visual drag feel is a manual check.
- Global OS shortcuts could still shadow the chosen keys on some Linux desktops; the keymap is one place to change.
