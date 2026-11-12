## 1. Bridge protocol
- [x] 1.1 Add `ready_message` and `error_message` to `src-tauri/src/bridge.rs`, with table tests. In `src-tauri/src/bin/dev-bridge.rs`, send `error` and close when `PtySession::spawn` fails, and send `ready` after a successful spawn.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib bridge`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## 2. Browser backend
- [x] 2.1 In `src/backend-ws.ts`, decode `ready` and `error`, resolve `spawn` on `ready`, and reject on `error` with the readable line. Update the `FakeSocket` setup in `src/backend-ws.test.ts` to send `ready`, and add table cases for `decodeServer` and for spawn rejecting on `error`.
  - Tests to update: src/backend-ws.test.ts
  - proof: `npx vitest run src/backend-ws.test.ts`
  - proof: `npx eslint src/backend-ws.ts src/backend-ws.test.ts`
  - proof: `npm run typecheck`

## 3. Design preparation
- [ ] 3.1 (triage) Add the design-prepare check
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
    # Installs dependencies and builds the dev bridge in the design worktree before the design server starts.
    - name: design-prepare
      run: npm ci --no-audit --no-fund --cache "$TMPDIR/harvaaja-npm-cache" && cargo build --manifest-path src-tauri/Cargo.toml --bin dev-bridge
      role: design-prepare
      stage: manual
      network: [registry.npmjs.org, index.crates.io, static.crates.io]
      timeoutSeconds: 900
    # Browser preview with a real shell: the launcher starts the dev bridge (a PTY) and Vite, and stops the bridge with it.
    - name: design
      run: npm run dev:browser -- --port "$HV_PREVIEW_PORT" --strictPort
      role: design
      stage: manual
      timeoutSeconds: 1200
  ```

## Manual checks after merge (The user)
- Start Design view. The page is served, and the terminal shows `The dev bridge could not open a shell: …`.
- With PTY access (`npm run dev:browser` on the host), the terminal runs the user's shell.
