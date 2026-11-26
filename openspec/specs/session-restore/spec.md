# session-restore Specification

## Purpose
Reopen tiili after it ends with the windows, panes, layout, folders and scrollback it had, without re-running programs.

## Requirements

### Requirement: Windows and panes reopen
On launch tiili SHALL reopen the windows open when the app last ended (quit, or closing the last window), each with its rect, maximised/fullscreen state, tiling mode, pane order, column and row sizes, focused pane, and per pane its kind, folder, font zoom and chip title. A window closed while others stayed open, or whose last pane exited, SHALL not reopen; with nothing saved one fresh window opens.

#### Scenario: Two windows reopen
- **WHEN** two windows with three and one panes are open, resized, and the user quits and relaunches
- **THEN** both windows open with the same panes, folders, sizes, order and focus

#### Scenario: Closed window forgotten
- **WHEN** the user closes the second window, then quits and relaunches
- **THEN** only the first window reopens

#### Scenario: Heynote pane
- **WHEN** a window had a Heynote pane
- **THEN** it reopens as a Heynote pane with its notes

### Requirement: Scrollback restored
When the restore setting is on, each shell pane SHALL show its saved normal-buffer scrollback, never a full-screen program's alternate screen, above a dim "restored from last session" divider. Scrollback SHALL be saved when the app ends; after a crash panes reopen without it.

#### Scenario: Scrollback above the divider
- **WHEN** a pane had output and the user quits and relaunches
- **THEN** the output shows above the divider and a new prompt below it

### Requirement: Programs are not re-run
tiili SHALL never re-run a program on restore. A pane that was running a command SHALL show a dim line `— was running: <command> —`, or `— was connected to <host> —` for a remote pane, and with tiili's zsh, bash or PowerShell integration a local pane's command SHALL be the newest entry of that shell's history so Up then Enter runs it. A remote pane SHALL never seed history. Other shells SHALL show the foreground program name only.

#### Scenario: Up re-runs
- **WHEN** a zsh pane was running `npm run dev` at quit and tiili relaunches
- **THEN** the pane shows `— was running: npm run dev —`, nothing runs, and Up puts `npm run dev` on the prompt

#### Scenario: Remote command is not seeded
- **WHEN** a pane connected to a host had a recorded command at quit and tiili relaunches
- **THEN** the pane shows `— was connected to <host> —` and the command is not added to the local shell's history

### Requirement: Missing folder
A pane whose saved folder no longer exists SHALL open in the nearest existing parent folder, else home, with a short dim note.

#### Scenario: Folder deleted
- **WHEN** a pane's folder was deleted between launches
- **THEN** it opens in the nearest existing parent and shows the note

### Requirement: Session storage
The session SHALL be stored as a versioned `session.json` with one scrollback file per pane in tiili's app data folder, readable by the user only. Layout, panes and folders SHALL be written shortly after each change. An unreadable or unknown-version file SHALL be ignored.

#### Scenario: Corrupt session
- **WHEN** session.json is not valid JSON
- **THEN** tiili opens one fresh window

### Requirement: Minimized panes reopen minimized
A pane minimized when the app ended SHALL reopen minimized in its tab, with its folder, zoom, title and scrollback. Its program SHALL not run again. Its badge SHALL read `was running: <command>` when a command was recorded, and restoring it SHALL show the pane as other restored panes show, so Up then Enter runs the command again.

#### Scenario: Dev server badge after relaunch
- **WHEN** a minimized pane was running `npm run dev` at quit and tiili relaunches
- **THEN** the bar shows a badge reading `was running: npm run dev` and nothing runs

#### Scenario: Restore and re-run
- **WHEN** the user clicks that badge, presses Up and Enter
- **THEN** the pane is in the grid and `npm run dev` runs
