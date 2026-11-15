# Design

## Intent table
`src-tauri/src/intents.rs`: `pub struct Intent { name, when, recipe, notes }` and `pub const INTENTS: &[Intent]` (fan-out, run-beside, need-you, find-reuse). `describe` adds `"intents": [...]`; `tiili prompt` prints `render_prompt()` (plain text, deterministic). `render_skill_section()` produces the Markdown between `<!-- tiili:intents:begin -->` and `<!-- tiili:intents:end -->` in `integrations/claude/skills/tiili-tiles/SKILL.md`; a unit test reads SKILL.md and fails on drift, rewriting it when `TIILI_BLESS=1`.

## Ownership
`control_app.rs` gains `PaneOwners(Mutex<HashMap<SessionId, Owner { by: SessionId, key: Option<String> }>>)` beside `PaneTitles`, forgotten where `PaneTitles::forget` is. The open handler holds the owners lock across lookup and the open request, so two concurrent `open --key K` from one owner yield one pane (a pending-key entry blocks the second until the first resolves). Lookup checks the pane is still live.

## Ops
Wire ops `attention {message?, clear}`, `open {.., key?}` (reply adds `reused: bool`), `close {pane}`, `list` (reply gains command, tab, key, opened_by, and the CLI computes `self` from `TIILI_PANE`). The command for a pane comes from the last `PaneCommandEvent` value, cached in Rust per pane. Attention is emitted to the caller's window as a new `pane-attention-request` event that `src/attention.ts` feeds into the same path as an OSC 9 signal (sanitising, rate limit, focus rule); `clear` calls the existing clear. Close emits a close request the frontend handles like ⌘W for that pane (no confirmation prompt) and replies after it closes.

## Errors
New `CliError` codes: `not_opened_by_you` (suggestion: ask the user), `no_such_pane`, `attention_failed`, `close_failed`.
