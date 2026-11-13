## 1. Shell environment and integration (Rust)
- [ ] 1.1 Set COLORTERM, TERM_PROGRAM, TERM_PROGRAM_VERSION in `PtySession::spawn_in`; add a case to `src-tauri/tests/pty_session.rs` asserting `COLORTERM=truecolor` in a spawned shell's output (Unix)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
- [ ] 1.2 Add `src-tauri/src/shell_integration.rs` (pure `plan(shell, prompt, dir)` + embedded zsh/bash/PowerShell scripts, cache-dir writer with plain-spawn fallback); table-driven unit tests for off/zsh/bash/pwsh/unknown shell and Windows paths
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib shell_integration`
- [ ] 1.3 Thread `prompt` through `pty_spawn`, `SessionRegistry::spawn_tracked`, `spawn_in` and the dev bridge; add an integration test that a zsh/bash with an empty HOME and Classic gets the tiili prompt and one whose rc sets PS1/PROMPT keeps it (skipped when the shell is missing)
  - Tests to update: src-tauri/tests/pty_session.rs, src-tauri/tests/pty_registry.rs, src-tauri/tests/dev_bridge.rs, src-tauri/tests/pty_resize_panes.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session --test pty_registry --test dev_bridge --test pty_resize_panes`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 2. Setting and picker (frontend)
- [ ] 2.1 Add `PROMPT_IDS`/`PromptId`, `prompt` in `Settings` (default `off`) with load clamping; table cases in `src/settings.test.ts`
  - proof: `npx vitest run src/settings.test.ts`
- [ ] 2.2 Add `src/promptStyles.ts` (labels, groups, preview segments on ANSI slots); pass the setting into `Backend.spawn` in `backend-tauri.ts`, `backend-ws.ts` and the pane opener
  - Tests to update: src/backend.test.ts, src/backend-ws.test.ts
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
- [ ] 2.3 Prompt fieldset under Theme in `src/settingsDialog.ts` via `pickList`, previews in `--term-bg`/`--ansi-*`, `markDefault` on Off, hint text
  - proof: `npx eslint src/settingsDialog.ts src/promptStyles.ts src/settings.ts src/backend-tauri.ts src/backend-ws.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate opt-in-default-coloured-prompt-shell-int --strict`

## Manual checks after merge (The user)
- macOS: choose Classic, open a pane in zsh with no PROMPT set: coloured `user@host:~$`; run `bash` there too; switching theme recolours it.
- With PROMPT set in ~/.zshrc, the user's prompt stays.
- Off: shells look exactly as before; `echo $COLORTERM` shows `truecolor`.
- Linux bash and Windows PowerShell: Classic shows; Off spawns as before.
