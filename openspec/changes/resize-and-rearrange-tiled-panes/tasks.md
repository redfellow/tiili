## 1. Layout model

- [x] 1.1 Merge `origin/main` (scaffold and auto-tiling cards must have landed). Add pure `src/layout/model.ts` (resizeTrack with minimum, swap, move, reset, addPane, removePane with per-axis re-flow) and `changedPanes`; table-driven `src/layout/model.test.ts` (first line `// @harvaaja-test-tier: fast`) covering resize and minimum clamp, swap, move including grid edges, reset, re-flow keeping/resetting each axis on open and close, and changedPanes
  - proof: `npx vitest run src/layout/model.test.ts`

## 2. Shortcuts

- [x] 2.1 Extend `src/keymap.ts` with `layoutAction(event, platform)` (macOS ⌃⌘arrows/⌃⌘0; Windows/Linux Ctrl+Alt+Shift+arrows/0) and add rows to `src/keymap.test.ts`, including that clipboard keys and plain Ctrl/Ctrl+Shift arrows return null
  - Tests to update: src/keymap.test.ts
  - proof: `npx vitest run src/keymap.test.ts`

## 3. UI wiring

- [x] 3.1 Render tracks from the model, divider hit areas with pointer capture, refit and `pty_resize` for `changedPanes` on pointer up; top-edge grab strip for drag swap with accent drop outline (tokens only); route layout keys before xterm
  - proof: `npx eslint src/layout`
  - proof: `npx eslint src/panes.ts src/terminal.ts src/resize.ts`
  - proof: `npx vitest run src/resize.test.ts`
- [x] 3.2 Integration test `src-tauri/tests/pty_resize_panes.rs` (first line `// @harvaaja-test-tier: integration`): spawn two PTY sessions, resize each to sizes from a simulated divider move, and check `stty size` output in each shell reports the new rows/columns
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_resize_panes`
  - proof: `npm run typecheck`

## 4. Rework: send the merged head through checks

- [ ] 4.1 Confirm the branch head carries the `hv/main` merge (144bf17) and the review nits (fc4141b) with no further code change: `rowsOf` is gone from `src/layout` and its tests, and the layout model and keymap tests still pass on the merged head
  - proof: `git merge-base --is-ancestor fc4141b HEAD`
  - proof: `npx vitest run src/layout/model.test.ts src/keymap.test.ts src/resize.test.ts`
  - proof: `npx eslint src/layout src/panes.ts src/terminal.ts src/resize.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- On macOS, Windows and Linux: drag a column and a row divider, then run `stty size` (or `$Host.UI.RawUI.WindowSize` in PowerShell) in each affected pane.
- Drag a pane's top edge onto another and check both sessions keep running; text selection inside a pane still works.
- Try the move and reset shortcuts on each platform, and check they don't reach the shell or trigger an OS action.
- Open and close terminals after resizing and check sizes are kept or reset as the spec says.
- On Linux under GNOME, check whether Ctrl+Alt+Shift+arrow is taken by the desktop (workspace move) before reaching tiili; this stays a manual check, not a code change.
