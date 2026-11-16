# tiili CLI: Windows shim injection, non-UTF-8 args panic, accept loop spin

## Why
- The Windows `bin\tiili.cmd` shim (`@"<exe>" %*`) lets cmd.exe re-parse arguments: `&`, `|`, `%VAR%` in a message or title run commands ("BatBadBut").
- `std::env::args()` in main.rs panics on non-UTF-8 arguments (exit 101) instead of the spec's usage error (exit 2).
- The Unix control accept loop `continue`s on every accept error, spinning at 100% CPU on EMFILE.

## What Changes
1. New console-subsystem `[[bin]] tiili-cli` (src/bin/tiili-cli.rs) running `cli::main`; the release app exe is GUI-subsystem, which shells neither wait for nor take an exit code from. control_app.rs `install_cli` on Windows places a real `bin\tiili.exe` from `tiili-cli.exe` next to the app exe: skip when size and mtime match; else hard-link (fall back to copy) to `bin\.tiili-<pid>.exe` and rename over `bin\tiili.exe`; on rename failure remove the temp file and return the error; then remove an old `bin\tiili.cmd`. Delete `windows_shim`, update the doc comment and docs/packaging.md.
2. main.rs and tiili-cli.rs collect `args_os`; `cli::main(&[OsString])` reports `CliError::Usage("arguments must be valid UTF-8")` for a non-UTF-8 arg through the same `fail` path as `run` (JSON envelope on stdout with `--json`), exiting 2. GUI path unchanged.
3. control_server.rs accept loop sleeps 100 ms on Err before continuing. Windows `bind_pipe` untouched.

## Outcome
- Non-UTF-8 argument
  - Now: Rust panic, exit 101
  - After: `tiili: arguments must be valid UTF-8`, exit 2

## Acceptance
- New Unix control_cli test passes; control_cli and control_server suites pass; Windows target cargo check passes.

## Citations
- openspec/specs/pane-control/spec.md:80 (usage errors); no spec or doc names `tiili.cmd` (grep of src-tauri, docs, integrations, README, openspec/specs found only control_app.rs).

## Assumptions
- No spec change: the shim was never specified; alternative was a spec delta naming `tiili.exe`.
