# Fix the Classic-prompt host tests in pty_session.rs

## Why
Since #92, `classic_prompt_applies_only_where_the_users_config_left_the_default` and
`classic_zsh_keeps_the_users_history_file` fail on macOS. The output shows macOS's own zsh prompt
(`red@MacBook-Air-M1 … %`), so tiili's zsh integration never ran. The cause is in the test helper `classic_shell`
(src-tauri/tests/pty_session.rs). It builds the command with `command_for`, which sets `ZDOTDIR` to tiili's
`<scripts>/zsh` folder (src-tauri/src/shell_integration.rs, zsh plan), and then calls `cmd.env_remove("ZDOTDIR")`,
which removes that same value. zsh then reads the temp home's (empty) files instead of tiili's, and Classic is never applied.
The product code is correct: the app does not remove ZDOTDIR.

## What Changes
- In `classic_shell`, delete `cmd.env_remove("ZDOTDIR");`. Keep `cmd.env_remove("TIILI_USER_ZDOTDIR")`: it stops a
  host ZDOTDIR from leaking into the test, because `command_for` turns the host's ZDOTDIR into TIILI_USER_ZDOTDIR.
  zsh then loads the user files from the temp HOME.

## Acceptance
- `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session -- --ignored` passes on the macOS host (the
  cargo-test-host release check).

## Citations
- src-tauri/tests/pty_session.rs `classic_shell` (env_remove added in 7e96039)
- src-tauri/src/shell_integration.rs `plan` / `command_for`

## Assumptions
- Fix the test, not the integration, because the app's spawn path never removes ZDOTDIR. The alternative ruled out was changing the integration scripts.
- These tests need a pseudo-terminal, which the sandbox refuses, so the sandbox could not confirm the fix. The release check confirms it.
