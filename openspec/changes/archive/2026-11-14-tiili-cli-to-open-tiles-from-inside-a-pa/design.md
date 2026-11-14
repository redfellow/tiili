## Context

Panes are owned by the frontend (`src/panes.ts`); the backend spawns PTYs through `pty_spawn` (`src-tauri/src/lib.rs`) and routes per-window events with `emit_to`. `bridge.rs` shows the pattern for a socket-free, testable protocol module with a constant-time token compare.

## Decisions

- **Protocol module `src-tauri/src/control.rs`** (no sockets): one JSON line per request, `{"token","pane","op":"open"|"list",...}`, one JSON line reply `{"ok":true,"pane":7}` / `{"ok":true,"panes":[...]}` / `{"ok":false,"error":"..."}`. Functions: `parse_request`, `check_token` (reuse `bridge::valid_token`/constant-time compare), reply builders, and the CLI's argv parser `parse_args` → `Open{cwd,title,cmd}` | `List` | usage error. All unit-tested in-module.
- **Server `src-tauri/src/control_server.rs`**: started in `setup`. Unix: `std::os::unix::net::UnixListener` in a 0700 dir, socket chmod 0600. Windows: named pipe `\\.\pipe\tiili-<user>-<pid>` via `windows-sys` (or `interprocess` crate if simpler), `PIPE_REJECT_REMOTE_CLIENTS`. One thread accepts; each connection handled on its own short thread with a read timeout.
- **Open flow**: server resolves the caller's window from `TIILI_PANE` via `WindowSessions`, emits `pane-open-request {requestId, cwd, title, command}` to that window, and waits (timeout ~10 s) for the frontend to call new command `pane_open_done(requestId, paneId | error)`. Frontend adds the pane like ⌘T but without focusing it and calls `pty_spawn` with a new optional `command: string[]`.
- **`pty_spawn` with `command`**: `SessionRegistry::spawn_tracked` gains an optional argv; when set it builds a `CommandBuilder` from it (cwd applied, `set_colour_env`), skips shell integration, and calls `spawn_command`. Exit flows through the same `PTY_EXIT_EVENT`, so the existing close rule applies.
- **Env**: `set_colour_env` (or a sibling) adds `TIILI_SOCKET`, `TIILI_TOKEN`, `TIILI_PANE` and prepends `<app data>/bin` to `PATH`, where setup creates a `tiili` symlink (Windows: `tiili.cmd` shim calling the exe) to `std::env::current_exe()`. The pane id is known only after spawn, so the registry reserves the id before spawning.
- **CLI mode**: `main.rs` checks `argv[1]` ∈ {`open`,`list`} before `tiili_lib::run()` and calls `tiili_lib::cli::main(args)` which exits with its code. On Windows the release binary is `windows_subsystem = "windows"`; CLI mode calls `AttachConsole(ATTACH_PARENT_PROCESS)` so output reaches the caller.
- **list**: server answers from `WindowSessions` + `SessionReports` (cwd, title = custom title or chip name).

## Risks

- Windows pipe and console attach cannot be exercised in the sandbox: covered by unit tests of the protocol and a manual check.
- Token is in every child's environment; that is the intended trust boundary (processes started inside tiili).
