## 1. Shortcut mapping
- [x] 1.1 Add `zoomAction` to `src/keymap.ts` and table-driven cases to `src/keymap.test.ts` (macOS ⌘=/⌘+/⌘−/⌘0, Windows/Linux Ctrl variants incl. numpad, and non-matches: ⌃⌘0, Ctrl+Alt+Shift+0, Alt+−, ⌘− on Windows, Ctrl+− on macOS)
  - proof: `npx vitest run src/keymap.test.ts`
  - proof: `npx eslint src/keymap.ts src/keymap.test.ts`

## 2. Per-pane zoom
- [x] 2.1 Keep a zoom offset per terminal pane in `src/panes.ts`, handle `zoomAction` in `shortcut()` on keydown (clamp to 6–48 px, keep keys from the shell, skip Heynote panes), and pass the offset to `applySize`/`applyFont` in `src/terminal.ts` so it is added before responsive text; keep the offset when Settings change
  - proof: `npx eslint src/panes.ts src/terminal.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- On macOS, ⌘+ / ⌘− / ⌘0 zoom and reset only the focused pane; the shell keeps working at the new size.
- On Windows, Ctrl++ / Ctrl+− / Ctrl+0 do the same.
- Restart: all panes open at the Settings font size.
