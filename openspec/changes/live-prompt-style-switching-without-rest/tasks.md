## 1. Rust core

- [x] 1.1 Start zsh, bash and PowerShell through the integration for Off too (`plan` with `TIILI_PROMPT=off`, `spawn_in` always passes the folder); update the Off cases in `plans_per_shell_and_prompt`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib shell_integration`
- [x] 1.2 Write the active prompt to the integration folder's `prompt` file and add the `pty_set_prompt` command that rewrites it and sends SIGUSR1 (Unix) to integrated local sessions only; add a unit test that an unknown id writes `off`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib shell_integration`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib command`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test signal_catch`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [x] 1.3 zsh, bash and PowerShell scripts: remember whether the user's config left the default prompt and their original prompt, re-read the file before each prompt, zsh `TRAPUSR1` with `zle reset-prompt`, bash `trap '' USR1`; extend `pty_session.rs` with a test that a bash and a zsh shell started with Off show the Classic prompt after the file changes and a newline is sent
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 2. Frontend

- [x] 2.1 Add `setPrompt(prompt)` to `Backend` (Tauri: `pty_set_prompt`; WebSocket: no-op) with a table-driven test in `src/backend.test.ts`
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
  - proof: `npx eslint src/backend.test.ts src/backend-ws.test.ts`
- [x] 2.2 Call `setPrompt` from `src/main.ts` whenever the applied prompt changes (preview, Save, Cancel, settings saved in another window) and change the hint's first sentence in `src/settingsDialog.ts` to `Applies to open panes and new ones.`
  - proof: `npx eslint src/main.ts src/settingsDialog.ts src/backend.ts src/backend-tauri.ts src/backend-ws.ts src/settings.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- With a zsh pane idle at its prompt, move the prompt list through Classic, Minimal and Tiili: the pane redraws each; Cancel puts it back.
- With a bash pane, save Tiili and press Enter: the next prompt is the Tiili prompt.
- A pane whose shell config sets its own prompt keeps it after saving Classic.
