# Tasks

## 1. Run the host tests on every card

- [x] 1.1 (triage) Add the `cargo-test-host-card` check: `stage: every`, `sandbox: none`, with a `tests` block that, when the card changes anything under `src-tauri/`, runs every test target holding a `#[ignore = "host: ..."]` test with `--include-ignored`
  - file: .harvaaja/checks.yaml
  - content:

```yaml
# Checks for tiili: a Tauri 2 app (Rust in src-tauri/, TypeScript + Vite frontend, npm).
setup:
  check: install
  clean: [node_modules]
checks:
  - name: install
    run: npm ci --no-audit --no-fund --cache "$TMPDIR/harvaaja-npm-cache" && cargo fetch --locked --manifest-path src-tauri/Cargo.toml
    network: [registry.npmjs.org, index.crates.io, static.crates.io]
    timeoutSeconds: 600
  - name: openspec
    run: openspec validate --all --strict --no-interactive
    stage: every
    timeoutSeconds: 120
  - name: typecheck
    run: npm run typecheck
    stage: every
    timeoutSeconds: 300
  - name: lint
    run: npm run lint
    stage: every
    timeoutSeconds: 300
  - name: unit
    run: npm test
    stage: every
    timeoutSeconds: 300
  - name: cargo-fmt
    run: cargo fmt --manifest-path src-tauri/Cargo.toml --check
    stage: every
    timeoutSeconds: 120
  # The host-only Rust tests on a card, outside the sandbox: a card's proofs run in the sandbox, which refuses the
  # Unix sockets and pseudo-terminals these tests need, so there they only compile and report ignored. When a card
  # changes anything under src-tauri/, every target in src-tauri/tests/ with a test marked #[ignore = "host: ..."]
  # runs with the ignored tests included; a card that leaves src-tauri/ alone skips it. The targets are found by
  # that attribute, so a new host test is picked up without editing this check. cargo test writes no JUnit report,
  # so a failure counts against the whole check. The run line is the whole set, for main's batch.
  - name: cargo-test-host-card
    run: >-
      cargo test --manifest-path src-tauri/Cargo.toml
      $(grep -l 'ignore = "host:' src-tauri/tests/*.rs | sed -E 's|.*/([^/]+)[.]rs$|--test \1|')
      -- --include-ignored
    stage: every
    sandbox: none
    timeoutSeconds: 1200
    tests:
      report: junit
      affected: >-
        git diff --quiet {since} HEAD -- src-tauri
        || grep -l 'ignore = "host:' src-tauri/tests/*.rs
      only: >-
        cargo test --manifest-path src-tauri/Cargo.toml
        $(for f in {files}; do printf -- '--test %s ' "$(basename "$f" .rs)"; done)
        -- --include-ignored
  # At promotion, not on each card: a card's merge into hv/main needs only fast checks (about 87 s per card here).
  # A card's proofs run a narrower clippy (--lib, plus --test <name>); this exact command is refused as a proof.
  - name: cargo-clippy
    run: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
    stage: release
    timeoutSeconds: 1200
  # The whole Rust suite before a release, outside the sandbox so the host tests (#[ignore = "host: ..."], tagged
  # @harvaaja-test-tier: host) run too. Cards run their host tests in cargo-test-host-card; this one also runs the
  # lib and bin tests and every other target.
  - name: cargo-test-host
    run: cargo test --manifest-path src-tauri/Cargo.toml --lib --bins --tests -- --include-ignored
    stage: release
    sandbox: none
    timeoutSeconds: 1200
  # Installs dependencies and builds the dev bridge in the design worktree before the design server starts.
  - name: design-prepare
    run: npm ci --no-audit --no-fund --cache "$TMPDIR/harvaaja-npm-cache" && cargo build --manifest-path src-tauri/Cargo.toml --bin dev-bridge
    role: design-prepare
    stage: manual
    network: [registry.npmjs.org, index.crates.io, static.crates.io]
    timeoutSeconds: 900
  # Browser preview with a real shell: the launcher starts the dev bridge (a PTY) and Vite, and stops the bridge with it.
  # Vite binds 127.0.0.1: härvääjä checks the preview there, and plain "localhost" is IPv6 only on macOS.
  - name: design
    run: npm run dev:browser -- --host 127.0.0.1 --port "$HV_PREVIEW_PORT" --strictPort
    role: design
    pty: true
    stage: manual
    timeoutSeconds: 1200
```

## 2. Write the rule where planners, builders and reviewers read it

- [x] 2.1 (triage) Planner rule: a task that edits a host test file, or the code it covers, names that target's `cargo test --test <name>` as its proof, and `cargo-test-host-card` runs it on the host
  - file: .harvaaja/instructions/plan.md
  - content:

```markdown
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
```

- [ ] 2.2 (triage) Builder rule: replace "Card checks don't run the Rust tests" with how `cargo-test-host-card` runs the host tests on the card
  - file: .harvaaja/instructions/build.md
  - content:

```markdown
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
```

- [ ] 2.3 (triage) Reviewer rule: every edited test file is run by a proof, host tests by `cargo-test-host-card` too
  - file: .harvaaja/review.md
  - content:

```markdown
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
```

## Manual checks after merge (The user)

- On the next card after the merge that changes `src-tauri/`, `cargo-test-host-card` shows in the card's checks, runs the seven host targets with their ignored tests (the listener test in `control_cli` among them) and passes. Note how long it takes per card.
- Change an expected string in an ignored host test on a throwaway card and check that `cargo-test-host-card` fails on the card, before merge.
