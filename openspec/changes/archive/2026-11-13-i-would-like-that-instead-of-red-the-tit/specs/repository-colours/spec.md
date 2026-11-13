## MODIFIED Requirements

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
