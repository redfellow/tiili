## 1. Skeleton and tooling

- [x] 1.1 Merge `origin/main` so `docs/concept.md` and `docs/brand/` are present; scaffold the Tauri 2 + Vite + TypeScript app with npm (`package.json` scripts `typecheck` = `tsc --noEmit`, `lint` = `eslint`, `test` = `vitest run`), `src-tauri/` with Cargo.toml/tauri.conf.json (window title `tiili`), ESLint flat config, Vitest config; commit `package-lock.json` and `Cargo.lock`
  - proof: `test -f docs/brand/tiili.css && test -f package-lock.json && test -f src-tauri/Cargo.lock`
  - proof: `npm run typecheck`
  - proof: `cargo check --manifest-path src-tauri/Cargo.toml`

## 2. PTY session (Rust)

- [x] 2.1 Add `src-tauri/src/pty.rs` (spawn default shell via `portable-pty`, write, resize, reader thread, exit notification) free of Tauri types, and Tauri commands `pty_spawn`/`pty_write`/`pty_resize` streaming output over a `Channel` and emitting an exit event
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`

## 3. Terminal frontend

- [x] 3.1 Add `src/terminal.ts` wiring xterm.js + fit addon to the PTY commands, `ResizeObserver` → `pty_resize`, exit message `[process exited] Press Enter to start a new shell` and restart on Enter
  - proof: `npx eslint src/terminal.ts`
- [x] 3.2 Brand: import `docs/brand/tiili.css`; vendor Geist Mono woff2 + OFL licence under `src/assets/fonts/` with `@font-face`; `src/theme.ts` builds the xterm theme from `--term-bg`, `--term-fg`, `--ansi-0..15`, block cursor `--accent`, re-applied on `prefers-color-scheme` change; generate icons with `npx tauri icon` from `docs/brand/logo/icon-light.svg` into `src-tauri/icons/`
  - proof: `npx eslint src/theme.ts`
  - proof: `test -f src-tauri/icons/icon.png && test -f src-tauri/icons/icon.icns && test -f src-tauri/icons/icon.ico`

## 4. Copy and paste

- [x] 4.1 Add pure `src/keymap.ts` `clipboardAction(event, platform)` and table-driven `src/keymap.test.ts` (first line `// @harvaaja-test-tier: fast`) covering macOS ⌘C/⌘V/⌘A, Windows/Linux Ctrl+Shift+C/V, plain Ctrl+C → null on every platform, Ctrl+Shift+C on macOS → null
  - proof: `npx vitest run src/keymap.test.ts`
- [x] 4.2 Wire clipboard: `attachCustomKeyEventHandler` using the keymap (Windows/Linux), macOS Edit menu (Copy/Paste/Select All with ⌘ accelerators) built in Rust and emitting events the frontend handles, right-click native context menu with Copy and Paste on all platforms, clipboard via `tauri-plugin-clipboard-manager`, paste through `term.paste()`
  - proof: `npx eslint src`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
  - proof: `npm run typecheck`

## 5. Workspace checks and instructions

- [x] 5.1 (triage) Update checks with install and the new checks
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
    - name: cargo-clippy
      run: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
      stage: every
      timeoutSeconds: 1200
    # Unit tests only: the PTY integration test needs a pseudo-terminal, which the sandbox refuses.
    - name: cargo-test
      run: cargo test --manifest-path src-tauri/Cargo.toml --lib --bins
      stage: every
      timeoutSeconds: 1200
    - name: cargo-test-pty
      run: cargo test --manifest-path src-tauri/Cargo.toml --test pty_session
      stage: release
      sandbox: none
      timeoutSeconds: 1200
  ```
- [x] 5.2 (triage) Allow the registries the install needs
  - file: .harvaaja/network.yaml
  - content:
  ```yaml
  # Hosts the workspace's agents may reach: npm and crates.io registries for npm ci and cargo,
  # and GitHub release downloads for the vendored Geist Mono font.
  allow: [registry.npmjs.org, index.crates.io, static.crates.io, crates.io, github.com, release-assets.githubusercontent.com, objects.githubusercontent.com]
  ```
- [x] 5.3 (triage) Update the planner's current state
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
    src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml --test
    <name>`, and `openspec validate --all --strict`.
  - The app window cannot run in the sandbox: anything seen in the window is a manual host check.

  ## Proofs

  - Name each task's proof as the narrowest command of this workspace's test runner that covers the task, and lint
    or type checks of only the files it touches.
  - Mark which tests are fast enough for every round: a first-line comment `@harvaaja-test-tier: fast`,
    `integration` or `host` lets härvääjä leave the slow ones to the release check.
  ```
- [x] 5.4 (triage) Update the builder's current state
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
    src-tauri/Cargo.toml --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D
    warnings`. OpenSpec: `openspec validate --all --strict`.
  - Keep PTY logic free of Tauri types and key mapping pure, so both stay testable without a window.

  ## Proofs

  - Run only the test files that cover what you changed, with this workspace's test runner.
  - A new test gets a first-line comment `@harvaaja-test-tier: fast`, `integration` or `host`: fast for
    isolated logic, integration for anything that needs real processes, files or services, host for what can't
    run in the sandbox.
  ```

## Manual checks after merge (The user)

- The PTY integration test (was task 2.2): run `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session` on the host, since the sandbox refuses a pseudo-terminal. It passed on the host on 2026-11-12 (1 passed), and the `cargo-test-pty` release check from 5.1 runs it outside the sandbox.
- On macOS, Windows and Linux run `npm run tauri dev`: the window is titled `tiili`, the shell prompt appears in Geist Mono with a brick block cursor, typing and resizing work.
- macOS: Edit menu has Copy ⌘C, Paste ⌘V, Select All ⌘A and they work in the terminal.
- Windows and Linux: Ctrl+Shift+C/V copy and paste; plain Ctrl+C interrupts `sleep 100` (or `ping -t` on Windows).
- Right-click shows Copy and Paste on each OS.
- Type `exit`: the exit message appears and Enter starts a new shell.
- Toggle system dark/light mode: the terminal colours follow.
