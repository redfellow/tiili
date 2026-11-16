# Tasks

- [x] 1.1 Replace the Windows `tiili.cmd` shim with a hard-linked/copied `bin\tiili.exe` in `install_cli` (control_app.rs), made from a new console-subsystem `tiili-cli` binary (src/bin/tiili-cli.rs) next to the app exe so shells wait for it and get its exit code; remove old `tiili.cmd` and `windows_shim`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --bin tiili-cli --bin tiili -- -D warnings`
- [x] 1.2 Read args with `args_os` in main.rs and tiili-cli.rs; `cli::main` refuses a non-UTF-8 argument with a usage error through the same report path as `run` (JSON envelope on stdout with `--json`); a Unix-only control_cli test runs both binaries with `OsStr::from_bytes(b"bad\xff")`, with and without `--json`, asserting exit 2, `tiili: arguments must be valid UTF-8` on stderr and the usage envelope
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_cli`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test control_cli -- -D warnings`
- [x] 1.3 Sleep 100 ms after a failed accept in the Unix control-accept loop (control_server.rs)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_server`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)
- Run the check-windows workflow (or `cargo check --target x86_64-pc-windows-msvc` on Windows) for the install_cli change.
- On Windows, install a release build, start tiili, and in a pane run `tiili frobnicate; $LASTEXITCODE` in PowerShell and `tiili frobnicate` then `echo %ERRORLEVEL%` in cmd: the prompt waits for tiili and both print 2.
- On Windows, start tiili, then from PowerShell in a pane run `tiili attention 'R&D'` and confirm the message reads `R&D` and nothing else runs.
