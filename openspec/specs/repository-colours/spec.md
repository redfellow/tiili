# repository-colours Specification

## Purpose
How tiili tells repositories apart at a glance: each pane follows its shell's working directory and git repository, panes in the same repository share a tint, and a title chip names the repository.

## Requirements

### Requirement: Pane follows its working directory
Each pane SHALL know its shell's current working directory and its git repository root, updated from OSC 7 on all platforms and by polling the shell process on macOS and Linux.

#### Scenario: Change directory into a repository
- **WHEN** the user runs `cd` into a folder inside a git repository
- **THEN** the pane's repository becomes that repository within about a second

### Requirement: Panes in one repository share a tint
Panes in the same repository SHALL share a project tint, assigned in order tint 1 to tint 16 as new repositories appear, stable for the session; once all 16 are taken a new repository SHALL get the least-used tint, ties to the lowest number.

#### Scenario: Two panes, one repository
- **WHEN** two panes are in the same repository
- **THEN** both show the same tint

#### Scenario: Seventeenth repository
- **WHEN** a seventeenth repository appears
- **THEN** it gets the tint with the fewest open panes

### Requirement: Title chip
Each pane SHALL show a title chip naming its place and its command as `<place> · <command>`: the place is the repository name in its tint and label colour, or the folder name in a neutral style when outside any repository, where the pane stays untinted. The command SHALL be the title the foreground program has set itself since it came to the foreground, otherwise the name of the pane's foreground process; at an idle prompt this is the shell's name.

#### Scenario: Outside a repository
- **WHEN** a pane's cwd is not in a git repository
- **THEN** its chip shows the folder name in the neutral style and the pane has no tint

#### Scenario: Program running
- **WHEN** the user runs `top` in a pane in their home folder `red`
- **THEN** the chip reads `red · top`, and after quitting top it reads `red · zsh` (with zsh as the shell)

#### Scenario: Program sets its own title
- **WHEN** the foreground program sends a window title
- **THEN** the chip's command part shows that title until the foreground process changes
