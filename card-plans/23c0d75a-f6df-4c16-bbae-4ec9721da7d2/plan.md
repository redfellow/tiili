# Run every PTY integration test target in a release check

This card is a chore: it has no proposal, design or specs.

## Origin

Run every PTY integration test target in a release check

Integration tests in src-tauri/tests (pty_registry.rs, repo_tracking.rs, dev_bridge.rs) never run in any check. .harvaaja/checks.yaml runs cargo-test only with --lib --bins, and the sandbox-free cargo-test-pty stage runs only --test pty_session. Add the other PTY targets to the sandbox-free stage (for example cargo test --manifest-path src-tauri/Cargo.toml --tests, sandbox none), so openpty-dependent tests run where openpty is allowed.

Why: Three cards from three different runs found the same gap: PTY tests that are written and pass by hand but are never run automatically. A later regression in pane cwd, registry or dev bridge would go unnoticed.

From findings:
- PTY integration tests other than pty_session never run in any check: .harvaaja/checks.yaml's cargo-test runs only --l...
- PTY integration tests can't run in the sandbox (openpty: Operation not permitted). The release check `cargo-test-pty`...
- The new integration test src-tauri/tests/pty_registry.rs (several sessions: independent input, per-session size, cwd ...
