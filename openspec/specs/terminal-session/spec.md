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
When a prompt other than Off is chosen, tiili SHALL start zsh, bash and PowerShell so that the user's own startup files still load first and the chosen prompt is set only when those files left the shell's default prompt. These shells SHALL also report their working folder with OSC 7, naming this machine's hostname, before every prompt, whichever prompt is shown. Other shells, and every shell with Off, SHALL start with the same program and arguments as without the integration.

#### Scenario: Default zsh gets the chosen prompt
- **WHEN** Classic is chosen and a zsh whose config sets no PROMPT starts
- **THEN** its prompt is the coloured Classic prompt

#### Scenario: User's own prompt wins
- **WHEN** Classic is chosen and the user's `.zshrc` sets PROMPT (or `.bashrc` sets PS1, or the PowerShell profile defines `prompt`)
- **THEN** the shell shows the user's prompt

#### Scenario: Folder reported at every prompt
- **WHEN** Classic is chosen and the user runs `cd /tmp` in zsh, bash or PowerShell, including one whose own config set the prompt
- **THEN** the shell sends OSC 7 for `/tmp` (or the Windows folder) before its next prompt, and the user's prompt and existing prompt hooks still run

### Requirement: Session environment in AppImage shells
When tiili runs from a Linux AppImage, every shell it spawns SHALL get no environment entries pointing at or inside the AppImage mount: such entries SHALL be dropped from colon-separated variables (removing a variable left empty), variables whose single value is inside the mount SHALL be removed, `APPIMAGE`, `APPDIR`, `ARGV0` and `OWD` SHALL be removed, and `GDK_BACKEND` SHALL be removed when it is `x11`. Outside an AppImage the shell environment SHALL be unchanged.

#### Scenario: System tools use system libraries
- **WHEN** the user runs `env | grep -i mount_` in a shell of the tiili AppImage
- **THEN** nothing is shown

#### Scenario: PATH keeps the user's entries
- **WHEN** tiili runs from an AppImage and its PATH mixes AppImage and system folders
- **THEN** the shell's PATH holds only the system folders, in their original order

#### Scenario: No change outside an AppImage
- **WHEN** tiili runs without `APPDIR` set
- **THEN** the shell's environment is the one tiili had, plus the colour variables

### Requirement: Option-drag selects on macOS
On macOS, dragging with Option held SHALL select text even when the running program reports the mouse. A plain Option-click SHALL still move the shell cursor, and double-click and triple-click SHALL still select a word and a line.

#### Scenario: Select over vim
- **WHEN** vim with mouse reporting runs on macOS and the user Option-drags over its text
- **THEN** the text is selected and vim receives no mouse events

#### Scenario: Option-click at the prompt
- **WHEN** the user Option-clicks inside the command line at a shell prompt on macOS
- **THEN** the shell cursor moves to that place

### Requirement: Output flow control
In the app, a pane's shell output SHALL be flow-controlled: the app SHALL stop reading a session's output once about 1 MiB is sent but not yet drawn by the terminal, and resume as the terminal acknowledges it. Heavy output SHALL neither grow memory without bound nor be discarded. Closing a pane or window SHALL release a waiting reader.

#### Scenario: Endless output
- **WHEN** `yes` runs in a pane for a minute
- **THEN** the app's memory stays flat, no output is discarded, and Ctrl+C stops it within a second

#### Scenario: Pane closed while output is held back
- **WHEN** a pane whose reader is waiting for acknowledgement is closed
- **THEN** the reader is released and the session ends
