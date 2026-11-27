# Building this workspace

Rules for implementers and fixers, on top of härvääjä's own. Keep them about this workspace: the commands that
run one test file, lint or type check, and conventions the code must follow.

## Current state

- tiili is a Tauri 2 app: Rust core in `src-tauri/`, TypeScript frontend in `src/` built with Vite, npm.
- One test file: `npx vitest run <file>`; one Rust test target: `cargo test --manifest-path src-tauri/Cargo.toml
  --test <name>`. Lint: `npx eslint <files>`. Type check: `npm run typecheck`. Rust: `cargo fmt --manifest-path
  src-tauri/Cargo.toml --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  (add `--test <name>` for test code; the `--all-targets` form is the `cargo-clippy` release check). OpenSpec: `openspec validate --all --strict`.
- Keep PTY logic free of Tauri types and key mapping pure, so both stay testable without a window.

## Proofs

- Run only the test files that cover what you changed, with this workspace's test runner.
- A new test gets a first-line comment `@harvaaja-test-tier: fast`, `integration` or `host`: fast for
  isolated logic, integration for anything that needs real processes, files or services, host for what can't
  run in the sandbox.
- The sandbox refuses pseudo-terminals (`openpty`) and binding Unix sockets, so a Rust test that spawns a shell
  through `PtySession` or `SessionRegistry`, or binds a control socket, is a host test: tag it
  `// @harvaaja-test-tier: host` and put `#[ignore = "host: <why>; the cargo-test-host release check runs it"]`
  under its `#[test]`, with `<why>` as in the existing ones ("needs a pseudo-terminal, which the sandbox
  refuses" or "binds a Unix socket, which the sandbox refuses"). Its proof, `cargo test --manifest-path
  src-tauri/Cargo.toml --test <name>`, then compiles it and reports it ignored. Don't leave the task unchecked or
  file a finding because the test can't run here. Keep the logic it covers testable without a PTY or socket where
  you can, and test that part with ordinary unit tests.
- Never add `-- --include-ignored` to a proof: the host tests fail in the sandbox.
- Card checks don't run the whole Rust suite, so a task that touches Rust names the test targets covering it in
  its proof, and those run on the card. The `cargo-test-host-card` card check then runs every target holding a
  `#[ignore = "host: ..."]` test on the host with the ignored tests included. It finds the targets by that
  attribute, so a host test without it is missed. When you change behaviour a host test checks (for example
  the JSON `tiili list --json` prints, which `control_cli` expects), update that test's expectation in the same
  change: a stale one fails `cargo-test-host-card` on the card. When it fails, fix it on the card.
