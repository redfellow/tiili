## Approach

- **Seam** `src/backend.ts`: `interface Backend { spawn(rows, cols, onOutput): Promise<void>; write(data); resize(rows, cols); onExit(cb); readClipboard(); writeClipboard(text); contextMenu(items, x, y) }`. `src/backend-tauri.ts` holds the current calls; `src/backend-ws.ts` holds the WebSocket one with a pure `encodeClient`/`decodeServer` pair for messages. `selectBackend(win)` returns `"tauri"` when `"__TAURI_INTERNALS__" in win`, else `"dev"`; the Tauri module is loaded with dynamic `import()` so the browser path never evaluates Tauri plugins. `terminal.ts` and `clipboard.ts` take a `Backend`.
- **Bridge** `src-tauri/src/bin/dev-bridge.rs`: reads `TIILI_BRIDGE_PORT` and `TIILI_BRIDGE_TOKEN` (refuses to start without a token of at least 32 hex chars), `TcpListener::bind(("127.0.0.1", port))`, thread per connection, `tungstenite::accept_hdr` checks path `/pty` and `token` query (constant-time compare) else 403, parses `rows`/`cols`, `PtySession::spawn` with output → binary frames and exit → text frame `{"type":"exit","code":n}` then close. Message parsing lives in a pure `bridge` module (`src-tauri/src/bridge.rs`, `parse_client(&str) -> Option<ClientMsg>`, `check_request(path_and_query, token)`) with unit tests. Socket close drops the session (kills the shell). Writes to the socket go through one `Mutex<WebSocket>` with a short read timeout so a reader loop and the output callback share it.
- **Vite**: plugin `devBridge()` with `apply: "serve"`: `transformIndexHtml` injects `<meta name="tiili-bridge-token">`; `server.proxy["/pty"] = { target: "ws://127.0.0.1:$TIILI_BRIDGE_PORT", ws: true }` only when the env vars are set.
- **Launcher** `scripts/dev-browser.mjs`: random token (`crypto.randomBytes(24)`), free port, spawns `cargo run --manifest-path src-tauri/Cargo.toml --bin dev-bridge` and `vite` with the forwarded args, kills the other when either exits and on SIGINT/SIGTERM/exit.
- **Browser menu** `src/context-menu.ts`: absolutely positioned list using `--surface`, `--text`, `--accent` tokens; closes on click outside/Escape.

## Why

The seam keeps the Tauri path byte-for-byte the same while letting the browser reuse `pty.rs`, so no second PTY implementation drifts. Loopback bind plus per-run token plus serve-only plugin keep the shell-over-socket off the network and out of builds.

## Risks

- PTYs need `sandbox: none`; bridge tests that spawn shells are integration tier.
- First `cargo run` compiles the bridge; slow without a shared target dir.
