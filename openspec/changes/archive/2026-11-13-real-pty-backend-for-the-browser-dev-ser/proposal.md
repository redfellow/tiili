## Why

The design check serves the frontend with `npm run dev` in a plain browser, where there is no Tauri: `src/terminal.ts` (invoke/Channel/listen) and `src/clipboard.ts` (clipboard plugin, native Menu) fail, so the Designer sees styling but no shell. A dev-only bridge that reuses tiili's own `src-tauri/src/pty.rs` lets the browser preview run a real shell.

## What Changes

- New `src/backend.ts` transport seam: `spawn(rows, cols, onOutput)`, `write`, `resize`, `onExit`, `readClipboard`, `writeClipboard`, `showContextMenu`. Two implementations:
  - Tauri: today's invoke/Channel/listen and clipboard-plugin/Menu calls, moved out of `terminal.ts` and `clipboard.ts`.
  - Dev (WebSocket): output (binary) and exit (`{"type":"exit","code":n}`) arrive as messages; input (`{"type":"input","data":...}`) and resize (`{"type":"resize","rows","cols"}`) go out; spawn opens the socket with rows/cols and the token in the query. Clipboard via `navigator.clipboard`; the right-click menu is a small HTML menu (Copy, Paste) styled with brand tokens.
- `main.ts` picks the backend with `"__TAURI_INTERNALS__" in window` (pure, unit-tested `selectBackend`).
- New dev-only Rust binary `src-tauri/src/bin/dev-bridge.rs` using `pty.rs` and `tungstenite`: binds `127.0.0.1` only, one PTY session per WebSocket connection, rejects connections without the per-run token, kills the shell when the socket closes.
- Vite dev server (serve only): a plugin generates a random token per run, starts nothing itself but proxies `/pty` (ws) to the bridge, and injects the token into the page; the bridge reads the same token from the environment. Nothing of this enters `npm run build` or the Tauri bundle.
- New script `npm run dev:browser` (`scripts/dev-browser.mjs`): generates the token and bridge port, starts the bridge and Vite, and stops the bridge when Vite exits or on SIGINT/SIGTERM.
- Proposed design check entry for the owner (triage task).
- New spec `dev-browser-backend`.

## Outcome

- Design check page on `$HV_PREVIEW_PORT`
  - Now: terminal area with no shell
  - After: a prompt of the user's default shell; typing, resize, exit and `[process exited] Press Enter to start a new shell` restart work
- Right-click in the browser preview
  - After: a small HTML menu with `Copy` and `Paste`

## Assumptions

- A launcher script (`npm run dev:browser`) owns starting and stopping both processes, instead of a shell `&` in the check; ruled out: `&` in checks.yaml, which can leave the bridge running.
- The token travels in the WebSocket URL query and is injected through Vite's `transformIndexHtml` (serve only); ruled out: a cookie or a fetch endpoint.
- The bridge uses the shared target dir only if the owner sets `CARGO_TARGET_DIR` in the check; the plan does not change cargo layout. Ruled out: committing build output.
- `tungstenite` is a normal dependency of the crate (binaries cannot have their own); the bin is never part of the Tauri bundle because Tauri bundles only the main binary (`default-run`/`mainBinaryName` set to `tiili`). Ruled out: a separate workspace crate.
- Browser clipboard read needs the page's permission prompt; on denial paste writes the same error line as today.
- The auto-tiling card (BUILDING) also reshapes `terminal.ts`; the build merges `origin/main` first and adapts the seam to whatever session API has landed (session ids pass through the seam). Ruled out: waiting for it.
- macOS Edit-menu clipboard path stays Tauri-only; in the browser, Cmd+C/V use the same keymap handler as other platforms with `navigator.clipboard`.
