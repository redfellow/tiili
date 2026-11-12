# Building this workspace

Rules for implementers and fixers, on top of härvääjä's own. Keep them about this workspace: the commands that
run one test file, lint or type check, and conventions the code must follow.

## Current state

- tiili is a Tauri 2 app: Rust core in `src-tauri/`, TypeScript frontend in `src/` built with Vite, npm.
- One test file: `npx vitest run <file>`; one Rust test target: `cargo test --manifest-path src-tauri/Cargo.toml
  --test <name>`. Lint: `npx eslint <files>`. Type check: `npm run typecheck`. Rust: `cargo fmt --manifest-path
  src-tauri/Cargo.toml --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D
  warnings`. OpenSpec: `openspec validate --all --strict`.
- Keep PTY logic free of Tauri types and key mapping pure, so both stay testable without a window.

## Proofs

- Run only the test files that cover what you changed, with this workspace's test runner.
- A new test gets a first-line comment `@harvaaja-test-tier: fast`, `integration` or `host`: fast for
  isolated logic, integration for anything that needs real processes, files or services, host for what can't
  run in the sandbox.
- The sandbox refuses pseudo-terminals (`openpty`), so a Rust test that spawns a shell through `PtySession` or
  `SessionRegistry` is a host test: tag it `// @harvaaja-test-tier: host` and put
  `#[ignore = "host: needs a pseudo-terminal, which the sandbox refuses; the cargo-test-host release check runs it"]`
  under its `#[test]`. Its proof, `cargo test --manifest-path src-tauri/Cargo.toml --test <name>`, then compiles
  it and reports it ignored; the `cargo-test-host` release check runs it for real outside the sandbox. Don't
  leave the task unchecked or file a finding because the test can't run here. Keep the logic it covers testable
  without a PTY where you can, and test that part with ordinary unit tests.
