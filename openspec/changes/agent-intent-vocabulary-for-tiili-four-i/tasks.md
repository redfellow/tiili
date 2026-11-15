# Tasks

Requires the tiili-cli-contract-one-command-table-err change merged (merge `origin/main` first).

## 1. Core

- [ ] 1.1 Add `src-tauri/src/intents.rs` (`INTENTS`, `render_prompt`, `render_skill_section`); add `prompt` to the command table and `intents` to describe; update the describe golden file. Unit test: skill section in SKILL.md matches the table (`TIILI_BLESS=1` rewrites).
  Tests to update: src-tauri/tests/fixtures/describe.json (describe golden test in control.rs)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib intents::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control::`
- [ ] 1.2 Wire protocol and CLI parsing in `control.rs`/`cli.rs`: ops `attention {message, clear}`, `open` with `key` and `reused` reply, `close {pane}`, `list --json` fields; new `CliError` codes `not_opened_by_you`, `no_such_pane`, `attention_failed`, `close_failed`. Extend the table-driven parse and reply tests.
  Tests to update: src-tauri/src/control.rs, src-tauri/src/cli.rs, src-tauri/tests/control_cli.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib cli::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_cli`

## 2. App side

- [ ] 2.1 `control_app.rs`: `PaneOwners` beside `PaneTitles` (forgotten with it), per-pane command cache from `PaneCommandEvent`, atomic `open --key` (pending-key guard, liveness check, per-owner keys), `close` with ownership check, `list` extra fields, `attention` emitting `pane-attention-request` to the caller's window. Unit-test the ownership/key logic (reuse, concurrent, dead key, per-owner, refuse close) as one table-driven test.
  Tests to update: src-tauri/tests/control_server.rs
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib control_app::`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_server`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test control_server --test control_cli -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [ ] 2.2 Frontend: `src/attention.ts` handles `pane-attention-request` through the OSC 9 path (sanitise, rate limit, focus rule) and `clear`; `src/main.ts` handles the close request like closing that pane. Extend `src/attention.test.ts`.
  - proof: `npx vitest run src/attention.test.ts`
  - proof: `npx eslint src/attention.ts src/main.ts`
  - proof: `npm run typecheck`

## 3. Docs

- [ ] 3.1 Regenerate the intents section of `integrations/claude/skills/tiili-tiles/SKILL.md` and describe the run-beside and need-you recipes; keep the preflight.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib intents::`
  - proof: `openspec validate agent-intent-vocabulary-for-tiili-four-i --strict`

## Manual checks after merge (The user)

- From a Claude Code Bash tool in a pane, run `tiili attention "hi"` while another pane is focused: brick, count, badge and notification appear; focusing clears it.
- `tiili open --key dev -- npm run dev` twice opens one pane; `tiili close` on it closes it; on a pane you opened by hand it refuses.
- Repeat on macOS, Windows and Linux.
