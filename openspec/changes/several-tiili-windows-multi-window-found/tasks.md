## 1. Windows in Rust

- [ ] 1.1 Add `src-tauri/src/windows.rs`: `window_new` command (label `window-<n>`, cascaded 28 px from the focused window, `?cwd=` query), focused-window lookup, and a label → session ids map whose sessions close on `WindowEvent::Destroyed`; unit-test the cascade position and session map
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib windows`
- [ ] 1.2 Route macOS menu items with `emit_to` the focused window, add Shell › New Window (⌘N), make `pty_spawn` emit `pane-cwd`, `pane-command` and `pty-exit` only to its own window, and filter the window-state plugin to `main`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib windows`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test window_state`
- [ ] 1.3 Capabilities cover `main` and `window-*` in `src-tauri/capabilities/default.json`
  - proof: `grep -E '"window-\*"' src-tauri/capabilities/default.json`

## 2. App-wide tints, settings and Heynote

- [ ] 2.1 Move the tint assigner (and `tintKey`) to `src-tauri/src/tints.rs` as managed state counting open panes in all windows; `pane-cwd` carries the tint; table-driven unit tests ported from `src/tints.test.ts`
  - Tests to update: src/tints.test.ts
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib tints`
  - proof: `npx vitest run src/tints.test.ts`
- [ ] 2.2 After `settings_save`, emit `settings-changed` to every other window; `main.ts` applies it and adopts it into the dialogue
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib settings`
  - proof: `npx eslint src/main.ts`
- [ ] 2.3 Heynote ownership in Rust (`heynote_claim`, `heynote_focus`, released on pane close or window destroy); `panes.ts` focuses the owner window instead of opening a second Heynote
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib notes`
  - proof: `npx eslint src/panes.ts src/heynotePane.ts`

## 3. Frontend

- [ ] 3.1 Keymap: Ctrl+Shift+N on Windows/Linux is `{ type: "newWindow" }`, ⌘N kept from the shell on macOS; table rows in the keymap test
  - Tests to update: src/keymap.test.ts
  - proof: `npx vitest run src/keymap.test.ts`
- [ ] 3.2 Backend gains `newWindow(cwd)`; `Panes` handles `newWindow` and the `new-window` menu event with the focused pane's folder; `main.ts` reads `?cwd=` for the first pane; panes use the tint from `pane-cwd`
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
  - proof: `npm run typecheck`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)

- ⌘N / Ctrl+Shift+N opens a cascaded window whose pane starts in the focused pane's folder.
- With two windows, ⌘T, ⌘W, Edit › Copy and Settings… act only in the focused window.
- A repository has the same tint in both windows; saving a theme in one changes both.
- Heynote button in the second window brings forward the window holding Heynote.
- Closing one window leaves the other; closing the last quits tiili (macOS too); relaunch opens only the main window at its own saved size.
