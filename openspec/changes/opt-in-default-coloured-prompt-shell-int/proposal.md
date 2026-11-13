## Why
In tiili a user without a custom prompt gets the plain `user@host ~ %` (zsh) or `bash-3.2$`, while other terminals show a coloured one. Some command-line tools also hold back full colour because tiili does not set `COLORTERM`.

## What Changes
- Every shell tiili spawns gets `COLORTERM=truecolor`, `TERM_PROGRAM=tiili` and `TERM_PROGRAM_VERSION=<app version>` next to `TERM=xterm-256color`, whatever prompt is chosen.
- New **Prompt** setting (`prompt: PromptId`, list `PROMPT_IDS`), built like Theme: default `off`; unknown or wrong-typed saved values load as `off`.
- Settings ▸ Style gets a "Prompt" fieldset under Theme using the same `pickList`: Off first, then a One-line group (Classic, Minimal) and a Two-line group (Tiili). Each row shows a small preview of the prompt drawn in the selected theme's term background and ANSI colours, so it follows theme changes. Off is marked `(default)`.
- Shell integration for zsh (ZDOTDIR), bash (`--rcfile`) and PowerShell (`-NoExit -Command` dot-sourcing a tiili script): it loads the user's own config first, then sets the chosen prompt only when the user's config left the system default. Prompts use ANSI colour codes (theme slots), never fixed hex.
- With Off, shells start exactly as today (same program and arguments), apart from the env vars above.

## Outcome
- Prompt picker on the Style tab
  - After: `Prompt` list: `Off — my shell's own prompt (default)`, `Classic  user@host:~/src$`, `Minimal  ~/src ❯`, `Tiili` (two lines: `user@host ~/src` / `❯`)
- Hint under the picker
  - After: `Applies to panes opened from now on. A prompt set in your own shell config (PROMPT, PS1 or a prompt function) always wins.`
- Fresh zsh with Classic chosen
  - Now: `red@mac ~ %`
  - After: `red@mac:~$` in cyan user, green host, blue path

## Assumptions
- Already open shells keep their prompt; a new choice applies to panes opened afterwards (ruled out: re-sourcing into running shells, which would type into the user's session).
- The hint states the "your own prompt wins" rule in general rather than detecting per shell whether it applies (ruled out: probing each shell's config).
- Choice set Off/Classic/Minimal/Tiili with One-line/Two-line groups, as suggested; exact colour slots per style are the builder's within ANSI slots.
- "System default" means: zsh PROMPT unset or equal to macOS/zsh default `%n@%m %1~ %# ` ; bash PS1 unset or `\s-\v\$ ` / `\h:\W \u\$ `; PowerShell `prompt` function unchanged from the built-in.
- Integration scripts are embedded in the binary and written to the app's cache folder at spawn; ruled out shipping them as bundle resources.
- Other shells (fish, nu, cmd.exe) start unchanged whatever the choice.
- OSC 7 / OSC 133 stay out of scope for a later card.
