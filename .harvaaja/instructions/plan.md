# Planning this workspace

Rules for planners, on top of härvääjä's own. Keep them about this workspace: how its tests are named, run and
tiered, what its end-to-end tests are, and anything every plan must include.

## Current state

- tiili is a Tauri 2 app: Rust core in `src-tauri/`, TypeScript frontend in `src/` built with Vite, npm.
- Commands: `npm run typecheck` (tsc), `npm run lint` (ESLint; one file: `npx eslint <file>`), `npx vitest run
  <file>` (unit tests), `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `cargo clippy --manifest-path
  src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --test
  <name>`, and `openspec validate --all --strict`.
- The app window cannot run in the sandbox: anything seen in the window is a manual host check.

## Proofs

- Name each task's proof as the narrowest command of this workspace's test runner that covers the task, and lint
  or type checks of only the files it touches.
- Mark which tests are fast enough for every round: a first-line comment `@harvaaja-test-tier: fast`,
  `integration` or `host` lets härvääjä leave the slow ones to the release check.
