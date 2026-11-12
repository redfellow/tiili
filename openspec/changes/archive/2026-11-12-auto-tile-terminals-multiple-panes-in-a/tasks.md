## 1. Rust sessions

- [x] 1.1 Merge `origin/main` (scaffold must be merged); turn `src-tauri/src/pty.rs` into a `SessionRegistry` keyed by session id with spawn(cwd)/write/resize/close, commands `pty_spawn`/`pty_write`/`pty_resize`/`pty_close`/`pty_cwd` carrying the id; output channel and exit event tagged with the id
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- [x] 1.2 Add `src-tauri/src/cwd.rs` `process_cwd(pid)` (Linux `/proc`, macOS `libproc`, Windows `None`) with home-folder fallback at spawn; unit test that the current process's cwd is returned on macOS/Linux and `None` on Windows
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml cwd`
- [x] 1.3 Integration test `src-tauri/tests/pty_registry.rs` (first line `// @harvaaja-test-tier: integration`): spawn three sessions, resize each to a different size and check each reports its own size (`stty size` output), spawn one with cwd of another's `/tmp` dir on macOS/Linux and check `pwd`, close one and check the others still echo
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_registry`

## 2. Layout and shortcuts (pure)

- [x] 2.1 Add `src/layout.ts` `gridFor(n)` and table-driven `src/layout.test.ts` (first line `// @harvaaja-test-tier: fast`) for n = 0..10 (cols, rows, last-row stretch)
  - proof: `npx vitest run src/layout.test.ts`
- [x] 2.2 Add `paneAction(event, platform)` to `src/keymap.ts` and extend `src/keymap.test.ts` table: ⌘T/⌘W/⌘1–9 on macOS, Ctrl+Shift+T/W and Alt+1–9 on Windows/Linux, plain Ctrl+T/Ctrl+W/Ctrl+1 → null, cross-platform combos → null; existing clipboard rows unchanged
  - Tests to update: src/keymap.test.ts
  - proof: `npx vitest run src/keymap.test.ts`
- [x] 2.3 Add `src/resize.ts` debounce + `sizeChanged` helpers with `src/resize.test.ts` (fast tier, fake timers: burst of calls → one trailing call; unchanged size → no call)
  - proof: `npx vitest run src/resize.test.ts`

## 3. Panes in the window

- [x] 3.1 Add `src/panes.ts`: ordered panes, open (cwd from `pty_cwd` of focused pane), close (focus same index else previous; last pane closes the window), focus by click and by index, row-based flex layout from `gridFor`, per-pane debounced `pty_resize`; refactor `src/terminal.ts` to one instance per pane; macOS Shell menu items ⌘T/⌘W emitting events
  - proof: `npx eslint src/panes.ts src/terminal.ts`
- [x] 3.2 Focus styling in `src/styles.css`: container background `var(--term-gap)`, 3 px gap, focused `::before` 2 px `var(--accent)` top line, unfocused `opacity: .82`; xterm `cursorStyle: 'block'`, `cursorInactiveStyle: 'outline'`
  - proof: `npx eslint src`
  - proof: `npm run typecheck`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## Manual checks after merge (The user)

- On macOS, Windows and Linux: open 1–6 panes with the new-terminal shortcut and check the layouts (3 panes: two on top, one wide below) and 3 px mortar gaps.
- Focused pane shows the brick top line and solid cursor; others dimmed with outlined cursor while `yes | head -n 100000` still streams in them.
- ⌘1–9 / Alt+1–9 and clicking move focus; Alt+N not swallowed by the Linux desktop.
- Drag-resize the window: shells reflow (e.g. `htop`) without stutter.
- `cd /tmp` then new pane starts in `/tmp` on macOS/Linux, home on Windows.
- Closing the last pane closes the window.
