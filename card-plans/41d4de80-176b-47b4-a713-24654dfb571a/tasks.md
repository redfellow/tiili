# Tasks

Follow `openspec/changes/remote-panes/design.md`; tick the matching task in `openspec/changes/remote-panes/tasks.md` as each is done.

## 1. OSC 7 host and user-variable report (`src-tauri/src/cwd.rs`)

- [x] 1.1 Parse OSC 7 host and path (change task 1.1), with host table cases
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [x] 1.2 Scanner also finds `SetUserVar=tiili_repo` (change task 1.2)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [x] 1.3 Local-host check and Windows driveless = `WSL` (change task 1.3)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [x] 1.4 Strip control characters from host, path and repo (change task 1.4)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`

## 2. Remote state in `CwdTracker`

- [x] 2.1 `host` on `PaneCwd`, remote repo only from `tiili_repo` (change task 2.1)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [x] 2.2 Foreground-group end of remote state; local OSC 7 ends it (change task 2.2)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cwd::`
- [x] 2.3 Wire into `src-tauri/src/pty.rs` and serialise `host` in `pane-cwd` (change task 2.3)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib pty::`
- [x] 2.4 Host-tier remote round trip in `src-tauri/tests/repo_tracking.rs` (change task 2.4)
  - Tests to update: src-tauri/tests/repo_tracking.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test repo_tracking`

## 3. Chip and tints

- [x] 3.1 `host` in `src/paneChip.ts` and the `host:name` label (change task 3.1)
  - Tests to update: src/paneChip.test.ts
  - proof: `npx vitest run src/paneChip.test.ts`
- [x] 3.2 Remote tint keys in `src/panes.ts` (change task 3.2)
  - Tests to update: src/tints.test.ts
  - proof: `npx vitest run src/tints.test.ts src/paneChip.test.ts`
  - proof: `npx eslint src/panes.ts src/paneChip.ts`

## 4. Prompt integration sends OSC 7

- [x] 4.1 zsh and bash send OSC 7 every prompt (change task 4.1)
  - Tests to update: src-tauri/tests/pty_session.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
- [x] 4.2 PowerShell prompt wrapper sends OSC 7 (change task 4.2)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 5. Remote shells in Settings

- [x] 5.1 Snippets in `src/remoteSnippets.ts` with a table-driven `src/remoteSnippets.test.ts` checking the escape sequences (change task 5.1, without the by-hand step)
  - proof: `npx vitest run src/remoteSnippets.test.ts`
- [x] 5.2 Remote shells group on the Behaviour tab in `src/settingsDialog.ts` with Copy buttons (change task 5.2)
  - proof: `npx eslint src/settingsDialog.ts src/remoteSnippets.ts src/main.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate --all --strict`

## Manual checks after merge (The user)

- Each snippet, sourced in its shell, prints the expected OSC 7 and SetUserVar bytes (`script -q` / `cat -v`).
- macOS: `ssh` with the zsh snippet; chip reads `host:repo` in a remote tint; `cd` out shows `host:folder`; `exit` returns to the local folder and tint within a second.
- macOS: `ssh` to a fish host without the snippet shows `host:folder` in a host tint, not a local repo tint.
- Linux: the same ssh round trip.
- Windows Classic prompt: ssh round trip; after `exit` the next prompt makes the pane local; note whether `tiili_repo` arrives through ConPTY.
- Windows: a WSL shell with the bash snippet shows `WSL:<folder>`.
- Settings > Behaviour > Remote shells: each Copy button puts its snippet on the clipboard.
