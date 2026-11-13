# Tasks

- [ ] 1.1 Give each repo_tracking test its own temp parent folder and remove only that one
  - Tests to update: src-tauri/tests/repo_tracking.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test repo_tracking`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## Manual checks after merge (The user)
- cargo-test-host is green on hv/main (it runs the ignored host tests in repo_tracking.rs).
