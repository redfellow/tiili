## 1. Release check covers every PTY integration target

- [x] 1.1 Confirm the sandbox-free release check `cargo-test-host` runs all integration targets (`--tests`, `--include-ignored`), so pty_registry, repo_tracking, dev_bridge and pty_resize_panes run where openpty is allowed; no config change needed, commit #44 already did it
  - proof: `grep -E 'run: cargo test --manifest-path src-tauri/Cargo.toml --lib --bins --tests -- --include-ignored' .harvaaja/checks.yaml`
  - proof: `grep -E -A2 'name: cargo-test-host' .harvaaja/checks.yaml`

- [x] 1.2 Confirm every PTY integration test is tagged host and ignored with the host reason, so the release check is the one that runs it
  - proof: `grep -c 'ignore = "host: needs a pseudo-terminal' src-tauri/tests/pty_session.rs src-tauri/tests/pty_registry.rs src-tauri/tests/repo_tracking.rs src-tauri/tests/dev_bridge.rs src-tauri/tests/pty_resize_panes.rs`
