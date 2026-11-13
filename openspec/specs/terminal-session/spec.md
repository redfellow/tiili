# terminal-session Specification

## Purpose
The one terminal window of tiili: a terminal connected to the user's default shell through a pseudo-terminal, how it looks, and what happens when the shell exits.

## Requirements

### Requirement: One terminal on the user's default shell
The app SHALL open one window titled `tiili` containing one terminal connected to the user's default shell through a pseudo-terminal (ConPTY on Windows).

#### Scenario: Typing reaches the shell and output is shown
- **WHEN** the user types `echo hi` and Enter
- **THEN** the shell receives the input and `hi` is shown in the terminal

#### Scenario: Resize is sent to the shell
- **WHEN** the window is resized
- **THEN** the terminal's new rows and columns are sent to the pseudo-terminal

### Requirement: Branded terminal appearance
By default the terminal SHALL use the Koski theme, bundled Geist Mono at weight 100, and a blinking block (Brick) cursor. When the user chooses another theme, font or cursor in settings, the terminal SHALL use that choice instead.

#### Scenario: Follows system appearance
- **WHEN** the theme setting is System and the system switches between light and dark
- **THEN** the terminal colours switch to the matching token set

### Requirement: Shell exit closes its pane
When a pane's shell exits, the app SHALL close that pane as the close shortcut does, without offering a new shell. When it was the last pane, the window SHALL close.

#### Scenario: Exit closes the pane
- **WHEN** two panes are open and the shell in one exits
- **THEN** that pane closes and the layout re-flows

#### Scenario: Last shell exit closes the app
- **WHEN** one pane is open and its shell exits
- **THEN** the window closes

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
