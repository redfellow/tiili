# Tasks

- [ ] 1.1 Make `temp_dir` in `src-tauri/tests/pty_session.rs` return a unique folder per call (process id plus an atomic counter), so parallel `classic_shell` calls never share or delete each other's home and scripts folders
  - Tests to update: src-tauri/tests/pty_session.rs
  - proof: `rustfmt --check --edition 2021 src-tauri/tests/pty_session.rs`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session -- --include-ignored`
