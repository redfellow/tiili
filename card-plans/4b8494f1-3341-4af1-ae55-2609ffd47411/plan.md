# Fix failing checks: openspec, cargo-test-host-card & cargo-test-host

## Why

Three checks fail on hv/main. The card blames the environment, but two of the causes are in the repository:

- **openspec**: `openspec validate --all --strict` (OpenSpec 2.2.0) fails `settings` and `terminal-session`. Their
  strict warnings fail the run because four requirements run over 500 characters before their first scenario:
  - settings "Settings tab contents" (573)
  - settings "Prompt choice" (610)
  - settings "Prompt list" (508)
  - terminal-session "Prompt shell integration" (647)
- **cargo-test-host-card / cargo-test-host**: `folder_reported_at_every_prompt_zsh_and_bash_send_osc7` in
  `src-tauri/tests/pty_session.rs` is stale since #267 (commit 98d2637, "prompt profiles replace the user's own
  prompt"). Its second case starts a Classic shell whose config sets `PROMPT='mine-zsh> '` and waits for
  `mine-zsh> `. Classic now shows in place of that prompt, so the pattern never appears. The captured output shows
  the hook ran and Classic's `user@host:path` was drawn. The sibling test
  `chosen_prompt_replaces_the_users_own_and_default_keeps_it` was updated in #267; this one was missed. The
  terminal-session scenario "Folder reported at every prompt" still says "the user's prompt … still run(s)", which
  contradicts the requirement it belongs to.
- In the cargo-test-host run, the same test instead failed at `openpty` with "Device not configured" (ENXIO). That
  happens when the machine runs out of pseudo-terminals. It is truly environmental, and no code change fixes it.

## What Changes

- Shorten the four long requirements to at most 500 characters each. The sentences they lose move, in the same
  words, into new scenarios (or existing ones), so no behaviour changes and every scenario name stays.
- In the terminal-session scenario "Folder reported at every prompt", change the THEN clause to "the chosen prompt
  and the user's existing prompt hooks still run". This matches the requirement, where Classic replaces the user's
  prompt.
- In `folder_reported_at_every_prompt_zsh_and_bash_send_osc7`, the case with its own prompt and hook waits for
  Classic's `\x1b[39m@\x1b[32m` instead of the user's prompt. It then still requires OSC 7 for `/tmp` and
  `hook:/tmp`. The unused `mine` column goes, and the doc comment is updated to match.

## Acceptance

- `openspec validate --all --strict --no-interactive` passes.
- `pty_session` compiles and is clippy- and fmt-clean in the sandbox. On the host, the card's
  `cargo-test-host-card` check runs the fixed test for real.

## Citations

- `openspec/specs/settings/spec.md`: Settings tab contents, Prompt choice, Prompt list
- `openspec/specs/terminal-session/spec.md`: Prompt shell integration and its scenarios
- `src-tauri/tests/pty_session.rs`: `folder_reported_at_every_prompt_zsh_and_bash_send_osc7`,
  `chosen_prompt_replaces_the_users_own_and_default_keeps_it`
- Commit 98d2637 (#267) edited the main specs directly, so this card edits them directly too, with no change folder.

## Assumptions

- The main specs are edited in place rather than through an OpenSpec change folder with MODIFIED deltas. This is a
  wording-only restructure, and the check fails on the main specs until an archive happens. Ruled out: a new change.
- The test keeps Classic and asserts Classic's prompt, rather than switching that case to Default to see the user's
  own prompt. The scenario is about Classic. Ruled out: testing under Default.
- The `openpty` ENXIO failure is left to the machine (too many open pseudo-terminals). Ruled out: retrying `openpty`
  in the test.
