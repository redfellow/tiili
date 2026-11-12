# terminal-session Specification

## Purpose
TBD - created by archiving change scaffold-the-tiili-app-one-window-one-wo. Update Purpose after archive.

## Requirements

### Requirement: One terminal on the user's default shell
The app SHALL open one window titled `tiili` containing one terminal connected to the user's default shell through a pseudo-terminal (ConPTY on Windows).

#### Scenario: Typing reaches the shell and output is shown
- **WHEN** the user types `echo hi` and Enter
- **THEN** the shell receives the input and `hi` is shown in the terminal

#### Scenario: Resize is sent to the shell
- **WHEN** the window is resized
- **THEN** the terminal's new rows and columns are sent to the pseudo-terminal

### Requirement: Shell exit offers a new shell
When the shell exits, the terminal SHALL show a plain message and offer to start a new shell.

#### Scenario: Restart after exit
- **WHEN** the shell exits and the user presses Enter
- **THEN** a new default shell starts in the same terminal

### Requirement: Branded terminal appearance
The terminal SHALL use the tiili design tokens: koski background and dark ANSI set in dark mode, kalkki and light ANSI set in light mode, following the system setting; bundled Geist Mono; a block cursor in `#A4472B`.

#### Scenario: Follows system appearance
- **WHEN** the system switches between light and dark
- **THEN** the terminal colours switch to the matching token set
