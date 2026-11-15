## 1. Store (Rust)
- [ ] 1.1 `src-tauri/src/session.rs`: versioned model, parse (corrupt/newer → None), atomic 0600 write, `nearest_existing`, per-window on-screen fallback; table-driven `src-tauri/tests/session_store.rs` (`// @harvaaja-test-tier: fast`)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test session_store`
- [ ] 1.2 Replace tauri-plugin-window-state with session rects for every window (remove `is_remembered`, keep a one-time migration of the old main rect); window lifecycle (forget a closed window unless it is the last; flush at app end); `session_load`/`session_update`/`session_save_scrollback` commands
  Tests to update: src-tauri/tests/window_state.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test window_state`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test session_store`

## 2. Commands from the shell
- [ ] 2.1 Preexec hook in zsh, bash and pwsh scripts emitting the command sequence; history seeding from `TIILI_RESTORE_HISTORY`; sequence parsed per pane in the PTY sink, cleared at prompt; fallback program name from `command.rs`; test in `src-tauri/tests/pty_session.rs` that a zsh/bash pane reports a typed command
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 3. Frontend
- [ ] 3.1 `restoreScrollback` setting (default on) in src/settings.ts and the Behaviour tab in src/settingsDialog.ts; turning it off deletes saved scrollback/commands
  - proof: `npx vitest run src/settings.test.ts`
  - proof: `npx eslint src/settings.ts src/settingsDialog.ts`
- [ ] 3.2 `src/session.ts`: pure snapshot of a window and restore plan (reminder line, folder note, divider), table-driven src/session.test.ts (`// @harvaaja-test-tier: fast`)
  - proof: `npx vitest run src/session.test.ts`
- [ ] 3.3 Wire into src/panes.ts, src/main.ts, src/terminal.ts and src/backend*.ts: debounced updates on layout/pane/cwd changes, restore on launch (layout, focus, zoom, titles, Heynote), scrollback written before the shell output, flush on app end; ws backend no-ops
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts src/layout/model.test.ts`
  - proof: `npx eslint src/panes.ts src/main.ts src/terminal.ts src/backend.ts src/backend-tauri.ts src/backend-ws.ts src/session.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Two windows with several panes, resized and moved: Cmd+Q and relaunch restores both, layouts, focus, zoom, titles, Heynote.
- Close the last window on Windows/Linux and relaunch: same.
- `npm run dev` running at quit: reminder line, nothing runs, Up then Enter re-runs (zsh, bash, PowerShell); ssh pane shows the connected line.
- Scrollback with a divider; `vim` open at quit leaves no alternate screen.
- Setting off: no scrollback or commands in the app data folder; files are 0600.
- Delete a pane's folder: nearest parent with a note. Kill tiili: layout restores without scrollback.
