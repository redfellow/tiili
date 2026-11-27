## MODIFIED Requirements

### Requirement: One terminal on the user's default shell
The app SHALL open one window titled `tiili` containing one terminal connected through a pseudo-terminal (ConPTY on Windows) to the shell chosen in Settings, which is the user's default shell (`$SHELL`, `%COMSPEC%` on Windows) unless the user chose another. A chosen shell SHALL start as the default one does, as a login shell on macOS and Linux.

#### Scenario: Typing reaches the shell and output is shown
- **WHEN** the user types `echo hi` and Enter
- **THEN** the shell receives the input and `hi` is shown in the terminal

#### Scenario: Resize is sent to the shell
- **WHEN** the window is resized
- **THEN** the terminal's new rows and columns are sent to the pseudo-terminal

#### Scenario: Chosen shell instead of the system default
- **WHEN** the system default shell is fish, the user chose `/usr/bin/zsh` and opens a new pane
- **THEN** the pane runs zsh, started as a login shell

#### Scenario: Missing chosen shell
- **WHEN** the chosen shell's path does not exist or is not executable and the user opens a new pane
- **THEN** the pane runs the system default shell

## ADDED Requirements

### Requirement: SHELL names the running shell
On macOS and Linux every shell tiili starts SHALL have `SHELL` set to the path of the shell it runs, so programs started from it use that shell. On Windows `SHELL` and `COMSPEC` SHALL be left as tiili found them.

#### Scenario: SHELL follows the choice
- **WHEN** the system default shell is fish, the user chose `/usr/bin/zsh` and runs `echo $SHELL` in a new pane
- **THEN** `/usr/bin/zsh` is shown
