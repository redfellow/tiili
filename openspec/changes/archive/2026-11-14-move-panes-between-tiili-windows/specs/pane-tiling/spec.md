## ADDED Requirements

### Requirement: Move a pane to another window
The pane's right-click menu and the macOS Shell menu SHALL offer Move to New Window (⌃⌘N on macOS, Ctrl+Alt+Shift+N on Windows and Linux) and Move to Window, a submenu of the other open windows with no shortcut. Moving SHALL add the pane last in the target window's grid, bring that window to the front and focus the pane.

#### Scenario: Move to an existing window
- **WHEN** two windows are open, one whose focused pane is in repository `härvääjä`, and the user chooses Move to Window ▸ `härvääjä` for a pane
- **THEN** the pane appears last in that window's grid, the window comes to the front and the pane is focused

### Requirement: Window names in Move to Window
Each Move to Window entry SHALL name its window by that window's focused pane chip text, with ` (2)`, ` (3)` and so on added when entries would read the same.

#### Scenario: Duplicate window names
- **WHEN** two other windows both have a focused pane in repository `tiili`
- **THEN** the submenu lists `tiili` and `tiili (2)`

### Requirement: A moved pane keeps its session
A moved terminal pane SHALL keep its running shell, scrollback, folder, tint and chip, show output written during the move, and tell the shell its new size so full-screen programs redraw. The shell SHALL then belong to the target window. A moved Heynote pane SHALL save its notes and reopen in the target window.

#### Scenario: Move to a new window

- **WHEN** a window has two terminal panes and the user presses ⌃⌘N in one running `vim`
- **THEN** a new window opens holding that pane, `vim` keeps running and redraws there, and the source window keeps the other pane

#### Scenario: Scrollback and output during the move
- **WHEN** a pane whose shell is printing output is moved to another window
- **THEN** the target pane shows the earlier scrollback followed by everything the shell wrote, with nothing lost or repeated

#### Scenario: Heynote pane moves
- **WHEN** the user moves a Heynote pane to another window
- **THEN** its notes are saved and Heynote reopens in the target window showing them

#### Scenario: Moved shell follows its window
- **WHEN** a moved pane's shell changes folder, runs a program or exits, or the target window closes
- **THEN** the chip and tint update in the target window, the pane closes there on exit, and closing the target window ends the shell

### Requirement: Moving a window's last pane
Moving a window's last pane out SHALL close that window without ending the moved shell. Move to New Window on a window's only pane SHALL do nothing.

#### Scenario: Last pane moves out
- **WHEN** a window's only pane is moved to another window
- **THEN** the source window closes and the moved shell keeps running

#### Scenario: Only pane to a new window
- **WHEN** a window has one pane and the user chooses Move to New Window
- **THEN** nothing happens
