# Tasks

- [ ] 1.1 Make `temp_dir` in `src-tauri/tests/pty_session.rs` return a unique folder per call (process id plus an atomic counter), so parallel `classic_shell` calls never share or delete each other's home and scripts folders
  - Tests to update: src-tauri/tests/pty_session.rs
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session -- --include-ignored`
