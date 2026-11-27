# Review criteria

Besides tracing every behavior to the change's spec, hold the change to these. Each one broken is a change to make.

## Safety

- Nothing weakens how the workspace handles secrets, credentials or user data.
- No automated test reaches a real outside service.

## Compatibility

- Stored data, public APIs and file formats stay readable by the previous version, or the change says how they move.

## Tests

- Every test file the change edits is run by a task's proof. A Rust file under `src-tauri/tests/` is run by
  `cargo test --manifest-path src-tauri/Cargo.toml --test <name>`.
- When the change alters behaviour a host test checks (a test marked `#[ignore = "host: ..."]`, such as the
  JSON `tiili list --json` prints in `control_cli`), that test's expectation changes with it, and the card's
  `cargo-test-host-card` check passed. In the sandbox a host test only compiles and reports ignored; that check
  is what runs it.
- A new test that binds a Unix socket or opens a pseudo-terminal carries `#[ignore = "host: ..."]` and
  `// @harvaaja-test-tier: host`; without the attribute `cargo-test-host-card` doesn't run it.

## Words

- Text a person reads (UI, messages, errors) is plain and specific: it says what happened and what can be done.
