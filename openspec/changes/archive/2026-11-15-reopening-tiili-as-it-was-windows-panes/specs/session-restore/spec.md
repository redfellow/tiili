## Purpose
Reopen tiili after it ends with the windows, panes, layout, folders and scrollback it had, without re-running programs.

## ADDED Requirements

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
tiili SHALL never re-run a program on restore. A pane that was running a command SHALL show a dim line `— was running: <command> —`, or `— was connected to <host> —` for a remote pane, and with tiili's zsh, bash or PowerShell integration the command SHALL be the newest entry of that shell's history so Up then Enter runs it. Other shells SHALL show the foreground program name only.

#### Scenario: Up re-runs
- **WHEN** a zsh pane was running `npm run dev` at quit and tiili relaunches
- **THEN** the pane shows `— was running: npm run dev —`, nothing runs, and Up puts `npm run dev` on the prompt

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
