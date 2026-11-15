# tiili CLI contract: one command table, coded errors, `tiili describe`

## Why
Agents in panes learn `tiili` by trial. Today the command list lives in three places that disagree (`cli::is_cli`, `main.rs`, `control::USAGE`), errors are free text with exit code 1 for everything, and `tiili --help` falls through to `tiili_lib::run()` and starts a second GUI instance.

## What Changes
- One `COMMANDS: &[CommandSpec]` table in `src-tauri/src/control.rs` (open, list, install-claude-skill, describe, help) that `is_cli`, `parse_args`, the help text and describe all read.
- One error enum (`CliError`) with a stable `code`, exit code, message and `suggestion`. The CLI prints `tiili: <message>` plus `hint: <suggestion>`; the control wire error reply becomes `{"ok":false,"code","error","suggestion"}`.
- `tiili describe [CMD]`: offline, deterministic JSON stamped `schema: "tiili.describe/1"`, `version`, `protocol`; per command name, summary, usage, args, needs, output (text, hand-written JSON schema or null), exit codes, errors with suggestions; a top-level `env` section.
- `tiili help [CMD]`, `--help`, `-h` print help generated from the table; `--version` prints `tiili <version>`. None starts the GUI.
- An unknown bare-word first argument is a usage error (exit 2) with a suggestion; dash-prefixed arguments other than the help/version flags still reach the app (macOS `-psn_…`).
- Requests and replies carry `"protocol": 1`; nothing compares it yet.
- Spec `pane-control` gains the requirements; `integrations/claude/skills/tiili-tiles/SKILL.md` points agents at `tiili describe`.

## Outcome
- Help from a pane
  - Now: `tiili --help` opens a second tiili window
  - After: `tiili --help` prints `usage: tiili <command> [ARGS]` and the command list, and exits 0
- Outside a pane
  - Now: `tiili: not inside a tiili pane (TIILI_SOCKET is not set)`
  - After: `tiili: not inside a tiili pane (TIILI_SOCKET is not set)` then `hint: run tiili from a pane of the running tiili app`
- Unknown command
  - Now: `tiili frobnicate` starts the app
  - After: `tiili: unknown command frobnicate` then `hint: run tiili help to see the commands`, exit 2
- Version
  - After: `tiili --version` prints `tiili 0.x.y`

## Assumptions
- `list --json` follows as its own change (Reijo); `output.json` for list is `null` until then.
- Protocol is stamped only, no mismatch check (Reijo); a later `tiili status` may compare it.
- Schemas are hand-written (Reijo); no `schemars` dependency.
- Exit codes: 0 ok, 1 request failed at the app, 2 usage, 3 not in a pane, 4 app unreachable. Rejected: keeping only 0/1/2, which hides which fix applies.
- Error codes are snake_case strings (`usage`, `not_in_pane`, `unreachable`, `bad_token`, `malformed_request`, `open_failed`, `list_failed`). Rejected: numeric codes.
- The golden file pins describe with the version replaced by a placeholder so version bumps don't break it. Rejected: pinning the literal version.
- The skill's preflight stays `[ -n "$TIILI_SOCKET" ]`; the skill only adds a pointer to `tiili describe`, so `agent-skills` gets no delta. Rejected: making preflight call describe.
- `tiili help` and `tiili describe` with an unknown CMD are usage errors (exit 2).
