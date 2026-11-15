# Agent intent vocabulary: four intents, `tiili attention`, `tiili open --key`, `tiili close`

## Why
Coding agents are tiili's main CLI users, but they cannot ask for the user's attention (a Claude Code Bash tool has no tty, so BEL / OSC 9 never reach pane-attention), cannot reuse a dev-server pane without racing into duplicates, cannot close what they opened, and `tiili list` hides the command, tab and ownership they need to find panes. What an agent can do should be a small, fixed, discoverable vocabulary.

## What Changes
- Four intents, each with one canonical recipe, in one static intent table in Rust: fan-out (`tiili open --cwd D -- claude "P"`), run-beside (`tiili open --key dev -- sh -c 'CMD 2>&1 | tee FILE'`, then read FILE), need-you (`tiili attention [MSG]`), find/reuse (`tiili list --json`).
- Rule: an intent stays a recipe; it becomes a command or flag only when it would race, need output parsing, or be impossible.
- New `attention` op: `tiili attention [MSG]` marks the caller's own pane through the existing attention pipeline; `tiili attention --clear` clears it. Focus still clears it.
- `tiili open --key K`: atomically returns the live pane with key K that the caller's pane opened, else opens a new one. A closed keyed pane frees its key, so the next call opens a new pane quietly. The output says `reused` or `opened`.
- `tiili close PANE`: closes a pane only when the caller's pane opened it; otherwise error `not_opened_by_you` with suggestion "ask the user to close it".
- Ownership: an opened-by record per pane (owner = the calling pane, `TIILI_PANE`) and its key, kept beside `PaneTitles` in `control_app.rs`.
- `tiili list --json`: each pane gets `id`, `cwd`, `title`, `command`, `tab`, `key`, `self`, `opened_by_you`.
- The intent table feeds an `intents` section of `tiili describe`, a new `tiili prompt` (a text fragment to paste into agent prompts), and the tiili-tiles `SKILL.md` intents section, held to the table by a test.
- New ops go in the CLI contract's command table and use its error codes.

## Outcome
- Agent needs the user
  - Now: no way from a Bash tool call
  - After: `tiili attention "Review ready"` marks the agent's pane (chip brick, count, badge, notification) when the user is elsewhere
- Dev server started twice
  - Now: `tiili open -- npm run dev` twice opens two panes
  - After: `tiili open --key dev -- npm run dev` twice prints `reused 12` the second time
- Closing someone else's pane
  - After: `tiili: pane 7 was not opened by you` then `hint: ask the user to close it`, exit 1
- Prompt fragment
  - After: `tiili prompt` prints the four intents with their recipes

## Assumptions
- Depends on the "tiili CLI contract" change (command table, `CliError`, `tiili describe`) being merged first; `list --json` is built here since that change left it out. Rejected: a separate list --json change.
- `tiili attention` follows the needs-you rule: it does nothing when the caller's pane is the focused pane in the front window. Rejected: marking the focused pane.
- Attention from `tiili attention` shares the 2-second per-pane rate limit and message sanitising with escape-code signals.
- `open --key` output is `opened <id>` or `reused <id>` on one line; without `--key` the output stays the bare id. Rejected: changing plain `open` output.
- Keys are unique per owner pane, not window-wide. Rejected: a window-wide key namespace, which would let agents collide.
- Ownership is in memory only and is lost on app restart (restored panes have no owner). Rejected: persisting it in session restore.
- `close` on a pane that is already gone is error `no_such_pane` (now specified in pane-control). Rejected: reporting it as `not_opened_by_you`.
- The skill's intents section is generated between marker comments in SKILL.md by a Rust test that compares it with the table (and a `--bless` style env var rewrites it).
- Exit codes are not reported (Reijo); attention clears on focus or `--clear` (Reijo); a dead key reopens quietly (Reijo); owner is the calling pane (Reijo).
