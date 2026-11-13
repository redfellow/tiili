# Tasks

- [x] 1.1 Delete `cmd.env_remove("ZDOTDIR");` from `classic_shell` in src-tauri/tests/pty_session.rs, so the ZDOTDIR that `command_for` set is kept (TIILI_USER_ZDOTDIR is still removed)
  Tests to update: src-tauri/tests/pty_session.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## Manual checks after merge (The user)
- None beyond the cargo-test-host release check, which runs the ignored host tests and must be green again.
