## 1. Frontend seam

- [ ] 1.1 Merge `origin/main`. Add `src/backend.ts` (interface, pure `selectBackend(win)`), `src/backend-tauri.ts` (today's invoke/Channel/listen, clipboard plugin, Menu), and refactor `src/terminal.ts`/`src/clipboard.ts`/`src/main.ts` to take a `Backend` (Tauri backend loaded by dynamic import). Table-driven `src/backend.test.ts` (first line `// @harvaaja-test-tier: fast`) for selection
  - proof: `npx vitest run src/backend.test.ts`
  - proof: `npx eslint src/backend.ts src/backend-tauri.ts src/terminal.ts src/clipboard.ts src/main.ts`
- [ ] 1.2 Add `src/backend-ws.ts` (WebSocket backend, pure `encodeClient`/`decodeServer`, token read from the meta tag, `navigator.clipboard`) and `src/context-menu.ts` (HTML Copy/Paste menu, brand tokens). `src/backend-ws.test.ts` (fast tier) with a fake WebSocket: input and resize frames sent, binary output delivered, exit message calls onExit, URL carries rows/cols/token
  - proof: `npx vitest run src/backend-ws.test.ts`
  - proof: `npx eslint src/backend-ws.ts src/context-menu.ts`
  - proof: `npm run typecheck`

## 2. Rust bridge

- [ ] 2.1 Add `tungstenite` to `src-tauri/Cargo.toml` (update Cargo.lock), set `default-run = "tiili"`; add `src-tauri/src/bridge.rs` (pure `parse_client`, `check_request` with constant-time token compare, unit tests: input, resize, garbage, missing/wrong/right token, wrong path, bad rows/cols)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib bridge`
- [ ] 2.2 Add `src-tauri/src/bin/dev-bridge.rs`: env token/port (refuse without token), bind 127.0.0.1, one `PtySession` per connection, binary output, exit text frame, close kills shell. Integration test `src-tauri/tests/dev_bridge.rs` (first line `// @harvaaja-test-tier: integration`): wrong token refused; right token, send `echo hi`, receive `hi`; send `exit`, receive exit frame
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test dev_bridge`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`

## 3. Dev server wiring

- [ ] 3.1 Add the serve-only `devBridge()` Vite plugin in `vite.config.ts` (token meta injection, `/pty` ws proxy when env set) and `scripts/dev-browser.mjs` + `npm run dev:browser` (token, free port, start bridge and vite with forwarded args, stop bridge when vite exits or on signals)
  - proof: `npx eslint vite.config.ts scripts/dev-browser.mjs`
  - proof: `npm run build && ! grep -rE 'tiili-bridge-token|/pty' dist`
- [ ] 3.2 (triage) Add the design check that runs the browser preview with a real shell
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
    # Browser preview with a real shell: the launcher starts the dev bridge (a PTY) and Vite, and stops the bridge with it.
    - name: design
      run: npm run dev:browser -- --port "$HV_PREVIEW_PORT" --strictPort
      stage: manual
      sandbox: none
      timeoutSeconds: 1200

  ```

## Manual checks after merge (The user)

- Run the design check, open the preview port: default shell prompt, typing, window resize (`stty size`), `exit` then Enter restarts, copy/paste via shortcuts and right-click menu.
- `npm run tauri dev`: the app behaves as before, including the macOS Edit menu and native context menu.
- Stop the check and confirm no `dev-bridge` process remains.
