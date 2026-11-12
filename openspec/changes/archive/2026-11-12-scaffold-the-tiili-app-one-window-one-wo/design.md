## Approach

- **Layout**: `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `index.html`, `src/` (frontend), `src-tauri/` (Rust). Fonts in `src/assets/fonts/`. `src/styles.css` imports `docs/brand/tiili.css` through Vite so tokens have one source.
- **PTY (Rust)**: `src-tauri/src/pty.rs` owns a `PtySession` (spawn default shell with `TERM=xterm-256color`, write, resize, reader thread). Tauri commands `pty_spawn`, `pty_write`, `pty_resize`; output streams to the webview through a Tauri `Channel<Vec<u8>>`, and exit arrives as an event with the exit code. The session logic is plain Rust with no Tauri types so `cargo test` can drive it.
- **Frontend**: `src/terminal.ts` wires xterm.js (+ fit addon) to the commands; a `ResizeObserver` fits and calls `pty_resize`. On exit it prints the message and spawns a new session on Enter.
- **Clipboard**: `src/keymap.ts` exports `clipboardAction(event, platform): 'copy' | 'paste' | 'selectAll' | null`, pure. On Windows/Linux it is plugged in via `attachCustomKeyEventHandler` (returns false so the key does not reach the PTY); Ctrl+C without Shift returns null so xterm sends `\x03`. On macOS the native Edit menu (Tauri `PredefinedMenuItem` is not usable for a canvas terminal, so custom `MenuItem`s with accelerators emit events the frontend handles) owns ⌘C/⌘V/⌘A; the keymap still maps them for the in-webview path. Clipboard I/O uses `tauri-plugin-clipboard-manager`. Paste goes through `term.paste()` so bracketed paste works.
- **Theme**: `src/theme.ts` builds the xterm `ITheme` from computed CSS custom properties (`--term-bg`, `--term-fg`, `--ansi-0..15`), cursor `--accent`; re-applied on `prefers-color-scheme` change.
- **Icons**: `npx tauri icon docs/brand/logo/icon-light.svg` (rasterised to PNG first if the CLI needs it); generated files committed.

## Why

Keeping PTY logic free of Tauri and the key mapping pure keeps the two risky parts testable without a window. The Edit menu is the macOS-native route the concept requires.

## Risks

- Webview cannot run in the sandbox: the window itself is a host-tier manual check.
- The PTY integration test spawns a real shell (integration tier).
