# terminal-session Specification

## Purpose
The one terminal window of tiili: a terminal connected to the user's default shell through a pseudo-terminal, how it looks, and what happens when the shell exits.

## Requirements

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

### Requirement: Branded terminal appearance
By default the terminal SHALL use the Koski theme, bundled Geist Mono at weight 100, and a blinking block (Brick) cursor. When the user chooses another theme, font or cursor in settings, the terminal SHALL use that choice instead.

#### Scenario: Follows system appearance
- **WHEN** the theme setting is System and the system switches between light and dark
- **THEN** the terminal colours switch to the matching token set

### Requirement: Shell exit closes its pane
When a pane's shell exits, the app SHALL close that pane as the close shortcut does, without offering a new shell, unless the pane is minimized: a minimized pane SHALL stay, its badge showing the exit code. When the closed pane was the window's last visible pane and the window has minimized panes, the most recently minimized one SHALL come back instead (see pane-minimize); when no visible or minimized pane is left, the window SHALL close.

#### Scenario: Exit closes the pane
- **WHEN** two panes are open and the shell in one exits
- **THEN** that pane closes and the layout re-flows

#### Scenario: Last shell exit closes the app
- **WHEN** one pane is open, none is minimized, and its shell exits
- **THEN** the window closes

#### Scenario: Minimized pane stays
- **WHEN** a minimized pane's shell exits with code 0
- **THEN** the pane stays minimized and its badge shows the exited state with `0`

### Requirement: Shell colour environment
Every shell tiili spawns SHALL have `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=tiili` and `TERM_PROGRAM_VERSION` set to tiili's version, whatever prompt is chosen.

#### Scenario: Truecolour advertised
- **WHEN** the user runs `echo $COLORTERM` in a tiili shell
- **THEN** `truecolor` is shown

### Requirement: Prompt shell integration
tiili SHALL start zsh, bash, fish and PowerShell through its integration so that the user's own startup files still load first. With Classic, Minimal or Tiili chosen, the chosen prompt SHALL show in place of the prompt those files set up; with Default (`off`), the shell SHALL show the prompt those files set up. These shells SHALL also report their working folder with OSC 7, naming this machine's hostname, before every prompt, whichever prompt is shown.

#### Scenario: Default zsh gets the chosen prompt
- **WHEN** Classic is chosen and a zsh whose config sets no PROMPT starts
- **THEN** its prompt is the coloured Classic prompt

#### Scenario: Chosen prompt replaces the user's own
- **WHEN** Classic is chosen and the user's `.zshrc` sets PROMPT (or `.bashrc` sets PS1, `config.fish` defines `fish_prompt`, or the PowerShell profile defines `prompt`)
- **THEN** the shell shows the Classic prompt

#### Scenario: Default keeps the user's own prompt
- **WHEN** Default is chosen and the user's shell config sets its own prompt
- **THEN** the shell shows the user's prompt

#### Scenario: Framework prompt replaced and brought back
- **WHEN** Classic is chosen and the user's config sets up a prompt a framework rebuilds before every prompt, then the user switches to Default
- **THEN** the Classic prompt shows in its place, and switching to Default brings the user's prompt back

#### Scenario: Folder reported at every prompt
- **WHEN** Classic is chosen and the user runs `cd /tmp` in zsh, bash, fish or PowerShell, including one whose own config set the prompt
- **THEN** the shell sends OSC 7 for `/tmp` (or the Windows folder) before its next prompt, and the chosen prompt and the user's existing prompt hooks still run

#### Scenario: Other shells start unchanged
- **WHEN** the user's shell is not zsh, bash, fish or PowerShell
- **THEN** other shells start with the same program and arguments as without the integration

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

### Requirement: macOS line-editing keys
On macOS, a terminal pane SHALL send ⌘← as `^A`, ⌘→ as `^E`, ⌥← as `ESC b`, ⌥→ as `ESC f`, ⌘⌫ as `^U` and ⌥⌫ as `^W` to its shell, instead of what xterm.js would send. Keys with any other modifiers, the layout and app shortcuts, and every key on Windows and Linux SHALL pass through unchanged.

#### Scenario: Command and Option arrows edit the line
- **WHEN** the user presses ⌘←, ⌘→, ⌥←, ⌥→, ⌘⌫ or ⌥⌫ in a macOS pane
- **THEN** the shell receives `^A`, `^E`, `ESC b`, `ESC f`, `^U` or `^W` respectively

#### Scenario: Layout keys and other platforms untouched
- **WHEN** the user presses ⌃⌘← on macOS, or Ctrl+← on Windows or Linux
- **THEN** no line-editing translation happens

### Requirement: Shell line-editing bindings
The zsh integration SHALL bind `ESC[H` and `ESC O H` to beginning-of-line, `ESC[F` and `ESC O F` to end-of-line, `ESC[1;3D` and `ESC[1;5D` to backward-word, and `ESC[1;3C` and `ESC[1;5C` to forward-word, in the emacs and viins keymaps. The bash integration SHALL bind the same four word-move sequences. Both SHALL only bind keys the user's own config left unbound. Home and End SHALL still reach programs as their escape codes.

#### Scenario: Home and word keys work in default zsh
- **WHEN** an integrated zsh whose config binds none of these keys starts
- **THEN** `bindkey` maps `^[[H` to beginning-of-line and `^[[1;5D` to backward-word

#### Scenario: User's own binding wins
- **WHEN** the user's `.zshrc` or `.bashrc` binds `^[[1;5D` to another widget
- **THEN** that binding stays

#### Scenario: Default bash gets word moves
- **WHEN** an integrated bash whose config binds no Ctrl/Alt arrows starts
- **THEN** `^[[1;5C` and `^[[1;3C` are bound to forward-word

### Requirement: SHELL names the running shell
On macOS and Linux every shell tiili starts SHALL have `SHELL` set to the path of the shell it runs, so programs started from it use that shell. On Windows `SHELL` and `COMSPEC` SHALL be left as tiili found them.

#### Scenario: SHELL follows the choice
- **WHEN** the system default shell is fish, the user chose `/usr/bin/zsh` and runs `echo $SHELL` in a new pane
- **THEN** `/usr/bin/zsh` is shown
