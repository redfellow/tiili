## 1. Rust core

- [ ] 1.1 Add `src-tauri/src/sink.rs` (swappable output sink with detach buffering and in-order flush on attach) with table-driven unit tests, and route pty_spawn output through it
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib sink`
- [ ] 1.2 Make each session's event target window shared and reassignable; add `WindowSessions::reassign`, `WindowNames`, `window_list`, `window_set_name`, `PendingMoves` in `windows.rs` with unit tests (reassign then close source keeps the shell, close target ends it)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib windows`
- [ ] 1.3 Add `pty_detach`, `pty_attach`, `pane_move`, `pane_move_take` commands; `window_new` takes an optional move token; re-emit latest cwd/command on attach
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- [ ] 1.4 macOS Shell menu: Move to New Window (Ctrl+Cmd+N) and a Move to Window submenu rebuilt when windows or names change
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## 2. Frontend

- [ ] 2.1 Keymap: `moveToNewWindow` for ⌃⌘N on macOS and Ctrl+Alt+Shift+N elsewhere, plain ⌘N / Ctrl+Shift+N unchanged
  - Tests to update: src/keymap.test.ts
  - proof: `npx vitest run src/keymap.test.ts`
- [ ] 2.2 Pure `menuEntries` naming other windows by chip text with ` (2)` for duplicates, table-driven test in a new fast test file
  - proof: `npx vitest run src/windowMenu.test.ts`
- [ ] 2.3 Install `@xterm/addon-serialize`; `openTerminal` gets `serialize()`, `detach()` (keeps the session) and an adopt-session mode (write scrollback, attach, resize to force redraw)
  - proof: `npx eslint src/terminal.ts`
- [ ] 2.4 Backend: `MenuItem` submenu variant; Tauri backend adds detach/attach/move/list/setName and maps submenus; ws backend omits moves
  - Tests to update: src/backend.test.ts, src/backend-ws.test.ts
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
  - proof: `npx eslint src/backend.ts src/backend-tauri.ts src/backend-ws.ts`
- [ ] 2.5 Panes: context-menu items, `move-to-window` / `pane-arrive` events, start-up `?move=` handling, Heynote flush and reopen, close source when emptied, only-pane no-op, focus target pane, report window name on focus/chip change
  - proof: `npx eslint src/panes.ts src/main.ts`
  - proof: `npm run typecheck`

## 3. Docs

- [ ] 3.1 Remove "Popping a pane out into its own window." from the out-of-scope list in docs/concept.md
  - proof: `grep -c "Popping a pane out" docs/concept.md | grep -x 0`
  - proof: `openspec validate move-panes-between-tiili-windows --strict`

## Manual checks after merge (The user)

- Move a pane running `vim` and one running a coding agent to a new window: both keep running and redraw correctly.
- Move a pane with long scrollback while it prints (`yes | head -100000`): scrollback and output arrive intact.
- Move to Window ▸ lists other windows by focused pane name, with (2) for duplicates; the target comes to front with the pane focused.
- Move a window's last pane out: the window closes and the shell lives on; closing the target window ends it.
- Move a Heynote pane: notes saved and reopened in the target.
- ⌃⌘N on macOS and Ctrl+Alt+Shift+N on Windows/Linux; Move to New Window on an only pane does nothing.
