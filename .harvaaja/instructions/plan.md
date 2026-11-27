# Planning this workspace

Rules for planners, on top of härvääjä's own. Keep them about this workspace: how its tests are named, run and
tiered, what its end-to-end tests are, and anything every plan must include.

## Current state

- tiili is a Tauri 2 app: Rust core in `src-tauri/`, TypeScript frontend in `src/` built with Vite, npm.
- Commands: `npm run typecheck` (tsc), `npm run lint` (ESLint; one file: `npx eslint <file>`), `npx vitest run
  <file>` (unit tests), `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `cargo clippy --manifest-path
  src-tauri/Cargo.toml --lib -- -D warnings` (add `--test <name>` for test code), `cargo test --manifest-path
  src-tauri/Cargo.toml --test <name>`, and `openspec validate --all --strict`.
- The app window cannot run in the sandbox: anything seen in the window is a manual host check.

## Proofs

- Name each task's proof as the narrowest command of this workspace's test runner that covers the task, and lint
  or type checks of only the files it touches.
- Mark which tests are fast enough for every round: a first-line comment `@harvaaja-test-tier: fast`,
  `integration` or `host` lets härvääjä leave the slow ones to the release check.
- Never name a release check's command as a proof: härvääjä flags it and the plan is incomplete. Here they are
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` (`cargo-clippy`) and `cargo
  test --manifest-path src-tauri/Cargo.toml --lib --bins --tests -- --include-ignored` (`cargo-test-host`). A
  Rust task's lint proof is `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`, with
  `--test <name>` added when it touches that test target.

## Host tests

- A host test is a Rust test marked `#[ignore = "host: ..."]` because it binds a Unix socket or opens a
  pseudo-terminal, which the sandbox refuses. Today they live in `control_cli`, `control_server`, `dev_bridge`,
  `pty_registry`, `pty_resize_panes`, `pty_session` and `repo_tracking` under `src-tauri/tests/`.
- When a task edits one of those files, or the code its host tests cover (for example `tiili list --json` behind
  `control_cli`), list the file on `Tests to update:` and name `cargo test --manifest-path src-tauri/Cargo.toml
  --test <name>` as a proof. In the sandbox that compiles the target and reports the host tests ignored. The
  `cargo-test-host-card` card check runs them for real on the host before the card merges, so a stale
  expectation fails the card, not the release.
- Never write `-- --include-ignored` in a proof: proofs run in the sandbox, where the host tests fail.
- A task that adds a host test gives it the `#[ignore = "host: ..."]` attribute; without it the test fails in the
  sandbox, and `cargo-test-host-card` finds its target only by that attribute.

## Specs

- A delta spec that creates a new capability (a folder under `openspec/changes/<change>/specs/` with no matching
  `openspec/specs/<capability>/`) starts with a `## Purpose` section: one or two sentences on what the capability
  is for, written for this app. Archiving copies it into the new main spec; without it the archive writes a `TBD`
  placeholder that fails `openspec validate --all --strict` on the base branch after the merge.
