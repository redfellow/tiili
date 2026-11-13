## ADDED Requirements

### Requirement: Shell colour environment
Every shell tiili spawns SHALL have `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=tiili` and `TERM_PROGRAM_VERSION` set to tiili's version, whatever prompt is chosen.

#### Scenario: Truecolour advertised
- **WHEN** the user runs `echo $COLORTERM` in a tiili shell
- **THEN** `truecolor` is shown

### Requirement: Prompt shell integration
When a prompt other than Off is chosen, tiili SHALL start zsh, bash and PowerShell so that the user's own startup files still load first and the chosen prompt is set only when those files left the shell's default prompt. Other shells, and every shell with Off, SHALL start with the same program and arguments as without the integration.

#### Scenario: Default zsh gets the chosen prompt
- **WHEN** Classic is chosen and a zsh whose config sets no PROMPT starts
- **THEN** its prompt is the coloured Classic prompt

#### Scenario: User's own prompt wins
- **WHEN** Classic is chosen and the user's `.zshrc` sets PROMPT (or `.bashrc` sets PS1, or the PowerShell profile defines `prompt`)
- **THEN** the shell shows the user's prompt
