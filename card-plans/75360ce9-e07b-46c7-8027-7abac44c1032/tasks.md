# Tasks

- [ ] 1.1 Replace the Windows `tiili.cmd` shim with a hard-linked/copied `bin\tiili.exe` in `install_cli` (control_app.rs), removing old `tiili.cmd` and `windows_shim`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
- [ ] 1.2 Read args with `args_os` in main.rs and add `cli::refuse_non_utf8`; add a Unix-only control_cli test running the binary with `OsStr::from_bytes(b"bad\xff")`, asserting exit 2 and `tiili: arguments must be valid UTF-8` on stderr
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_cli`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test control_cli -- -D warnings`
- [ ] 1.3 Sleep 100 ms after a failed accept in the Unix control-accept loop (control_server.rs)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_server`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)
- Run the check-windows workflow (or `cargo check --target x86_64-pc-windows-msvc` on Windows) for the install_cli change.
- On Windows, start tiili, then from PowerShell in a pane run `tiili attention 'R&D'` and confirm the message reads `R&D` and nothing else runs.
