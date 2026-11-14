## Approach

- **Current choice in a file.** The Rust core writes the active prompt id to a `prompt` file in the shell integration
  folder (`shell_integration::default_dir()`), on spawn and through a new `pty_set_prompt(prompt)` command. The
  frontend calls it from the settings apply path whenever the applied prompt changes: live while picking, on Save,
  on Cancel and when another window saves (`settings-changed`).
- **Shells re-read it.** The zsh, bash and PowerShell scripts remember at start whether the user's config left the
  default prompt (and keep that original prompt for Off). A precmd / PROMPT_COMMAND / prompt-function hook reads the
  file before each prompt and sets the matching prompt only in shells that started with the default prompt.
  `TIILI_PROMPT` stays the starting value, so a shell started before any file exists still works.
- **Idle redraw.** After writing the file, `pty_set_prompt` sends SIGUSR1 to each local session's shell process on
  Unix. zsh traps it (`TRAPUSR1`): re-read and `zle reset-prompt` when ZLE is active. bash and PowerShell ignore the
  signal (bash script sets `trap '' USR1` so the default action never kills it) and switch at their next prompt.
  Windows sends no signal.
- **Off loads the integration.** `PtySession::spawn_in` always passes the integration folder, and
  `shell_integration::plan` starts zsh, bash and PowerShell through the scripts for Off too (with `TIILI_PROMPT=off`),
  so Off panes can switch later. Other shells keep starting plainly.

## Why

A shared file plus a per-prompt hook needs no typing into the PTY (which would land in history or a running program)
and lets the user's own prompt keep winning, the rule already in the scripts. A signal is the only way to redraw an
idle zsh prompt from outside; bash readline has no safe equivalent.

## Risks

- SIGUSR1 to a shell that is not one of tiili's integrated shells: send only to sessions spawned with the integration
  (zsh/bash/pwsh plans), never to other shells.
