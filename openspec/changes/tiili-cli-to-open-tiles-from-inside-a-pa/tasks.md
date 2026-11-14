## 1. Protocol (socket-free)

- [x] 1.1 Add `src-tauri/src/control.rs`: request/reply JSON types, `parse_request`, token check (constant-time, reusing `bridge.rs` helpers), reply builders, and the CLI argv parser (`open [--cwd] [--title] -- CMD...`, `list`, usage errors), with table-driven unit tests for token refusal, malformed requests and argv parsing
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control`

## 2. Spawning a command in a pane

- [x] 2.1 Let `SessionRegistry::spawn_tracked` and `pty_spawn` take an optional argv: run it directly (no shell integration) in the cwd, same exit path; reserve the session id before spawn and set `TIILI_SOCKET`, `TIILI_TOKEN`, `TIILI_PANE` and the `PATH` prefix for every pane; add an integration test that a spawned command sees the variables and its exit is reported
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_registry`

## 3. Server and CLI

- [x] 3.1 Add the control server (Unix socket 0600 in a 0700 folder; Windows named pipe, local clients only, current user), started in `setup`, removed on exit; it resolves the caller's window from `TIILI_PANE`, emits `pane-open-request` and waits for `pane_open_done`, and answers `list` from `WindowSessions`/`SessionReports`; keep the listener behind a handler trait and add an integration test (Unix) that binds it in a temp folder, checks the socket is 0600, and that a request with a wrong token is refused while a good one reaches the handler
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_server`
- [x] 3.2 Add CLI mode: `main.rs` dispatches `open`/`list` to `tiili_lib::cli`, which connects, sends the request, prints the pane id or list, and exits with a code (Windows: attach to the parent console); setup creates the `tiili` link/shim in the app's bin folder; add an integration test that runs the CLI against a test listener (Unix) and checks its output and exit codes, including the not-inside-tiili case
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_cli`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 4. Frontend

- [x] 4.1 Listen for `pane-open-request` in `src/panes.ts`/`src/main.ts`: add a terminal pane like ⌘T without moving focus, spawn it with the command, cwd and title (title overrides the chip name), and reply through `pane_open_done`; extend the backend `spawn` with the optional command
  - Tests to update: `src/backend.test.ts` (asserts `pty_spawn` arguments)
  - proof: `npx vitest run src/backend.test.ts`
  - proof: `npx eslint src/panes.ts src/main.ts src/backend.ts src/backend-tauri.ts src/backend-ws.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- On macOS, in a tiili pane run `tiili open -- top`: a pane appears, focus stays put, an id prints; quit `top` and the pane closes.
- `tiili list` shows the window's panes with ids, folders and titles.
- `ls -l "$TIILI_SOCKET"` shows `srw-------`; `TIILI_TOKEN=x tiili list` is refused.
- On Windows and Linux, repeat `tiili open` and `tiili list` from a pane.
