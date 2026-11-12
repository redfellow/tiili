## Approach

- **Rust sessions**: extend the scaffold's `pty.rs` into a `SessionRegistry` (`HashMap<SessionId, PtySession>` behind a `Mutex`). `pty_spawn(cwd: Option<String>)` returns an id; `pty_write`, `pty_resize`, `pty_close` take the id. Output channel and exit event carry the id. Registry stays free of Tauri types so `cargo test` drives it.
- **Working directory**: `src-tauri/src/cwd.rs` `fn process_cwd(pid) -> Option<PathBuf>`: `#[cfg(target_os = "linux")]` reads `/proc/<pid>/cwd`; `#[cfg(target_os = "macos")]` uses `libproc` (`pidcwd`); Windows returns `None`. Command `pty_cwd(id)`; spawn falls back to the home dir (`dirs`/`CommandBuilder::cwd`).
- **Layout**: `src/layout.ts` `gridFor(n): {cols, rows, cells: {row, col, colSpan}[]}` pure. The DOM renders each row as its own flex row (rows share height equally, panes in a row share width), which stretches the short last row naturally. Gap 3 px, background `var(--term-gap)`.
- **Panes**: `src/panes.ts` owns an ordered list of `Pane` (xterm instance, fit addon, session id). Focus state toggles a `data-focused` attribute; CSS draws the `::before` 2 px `--accent` top line and `opacity: .82` on others; xterm `cursorStyle: 'block'` + `cursorInactiveStyle: 'outline'` and per-pane `focus()`.
- **Resize**: one `ResizeObserver` per pane → per-pane trailing debounce (~50 ms) → `fit()` → `pty_resize` only if rows/cols changed. Helper `debounce` and `sizeChanged` are tiny pure functions.
- **Shortcuts**: `src/keymap.ts` gains `paneAction(event, platform): {type:'new'} | {type:'close'} | {type:'focus', index} | null`, used in `attachCustomKeyEventHandler` (return false so the key doesn't reach the PTY). On macOS ⌘T/⌘W are also menu items (Shell menu) emitting events, because the webview otherwise may not see them.
- **Close last pane** → `getCurrentWindow().close()`.

## Platform differences

- Working directory inheritance: macOS and Linux yes, Windows falls back to home (ConPTY gives no cwd of the child).
- Shortcut modifiers: ⌘ on macOS; Ctrl+Shift (new/close) and Alt (focus) on Windows and Linux. Alt+N on Linux may be taken by some desktop environments; noted for manual check.

## Risks

- Many xterm instances cost memory; WebGL addon not used, keep the DOM/canvas renderer from the scaffold.
- The window and visual states are host-tier manual checks.

## Proposed workspace changes

None: the scaffold's checks (Vitest, ESLint, tsc, cargo) cover this change; `libproc` downloads from crates.io already allowed.
