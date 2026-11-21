## 1. Viewer in the binary

- [ ] 1.1 Add `src-tauri/src/follow.rs` and the `tiili follow` CLI command (no app needed), porting `follow.mjs` (clean, events, render, summarizeArgs, wait/tail, stop on `session_exit`/`--done`/`--pid`); port `integrations/subagent-panes/follow.test.ts` to a table-driven `src-tauri/tests/follow.rs` (`// @harvaaja-test-tier: fast`) and delete `follow.mjs` and `follow.test.ts`
  Tests to update: integrations/subagent-panes/follow.test.ts (ported, then removed); src-tauri/tests/control_cli.rs (command list)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test follow`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_cli`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test follow -- -D warnings`
- [ ] 1.2 Make `integrations/subagent-panes/omp/index.ts` run `tiili follow` and update the README (install from Settings → Integrations, no Node)
  - proof: `npx eslint integrations/subagent-panes/omp/index.ts`

## 2. Install and uninstall

- [ ] 2.1 Add `claude_skill::uninstall(home)` removing the `tiili-tiles` folder only, and add `src-tauri/src/integrations.rs`: table, status from disk and PATH, embedded omp files, install (write + `omp plugin link`), uninstall (omp's confirmed uninstall verb + remove folder), per-integration errors with a fix, injectable command runner; tests in `src-tauri/tests/integrations.rs` (`fast`) with a fake runner: status, apply with one failure, omp argv sent, skill uninstall leaves siblings
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test integrations`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test integrations -- -D warnings`
- [ ] 2.2 Add `refresh_installed(version)` with the stamp file, called at startup; test that only installed integrations are rewritten and none is linked
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test integrations`
- [ ] 2.3 Register Tauri commands `integrations_status` and `integrations_apply` in `lib.rs`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 3. Integrations tab

- [ ] 3.1 Add `src/integrations.ts` (backend calls, diff of ticked vs installed, row state from results) with `src/integrations.test.ts` (`fast`, table-driven), and the backend methods in `backend.ts`/`backend-tauri.ts`/`backend-ws.ts`
  - proof: `npx vitest run src/integrations.test.ts`
  - proof: `npx eslint src/integrations.ts src/integrations.test.ts src/backend.ts src/backend-tauri.ts src/backend-ws.ts`
- [ ] 3.2 Add the Integrations tab and panel to `src/settingsDialog.ts` (rows, disabled reason, inline error + fix, dialog stays open on failure) with styles in `src/styles.css`
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate settings-an-integrations-tab-that-turns --strict`

## Manual checks after merge (The user)

- In an installed build, tick Oh My Pi subagent panes, save, start `omp` in a tiili pane and run a subagent: a follow pane opens; untick and save: `omp plugin list` no longer lists it.
- Tick and untick the Claude Code skill and check `~/.claude/skills/tiili-tiles` appears and goes.
- With `omp` off PATH, the row explains and the box can't be ticked.
- Repeat on Windows and Linux.
