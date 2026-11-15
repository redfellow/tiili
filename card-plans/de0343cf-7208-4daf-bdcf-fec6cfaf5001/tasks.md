# Tasks

- [x] 1.1 Strip OSC sequences from session output before `wait_for` matches in `src-tauri/tests/pty_registry.rs`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test pty_registry -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)
- On the Mac host, `cargo test --manifest-path src-tauri/Cargo.toml --test pty_registry -- --include-ignored` passes (the sandbox refuses a pseudo-terminal; the cargo-test-host release check also runs it).
