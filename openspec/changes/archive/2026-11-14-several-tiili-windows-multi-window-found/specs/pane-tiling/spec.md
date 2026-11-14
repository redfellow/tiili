## ADDED Requirements

### Requirement: New window
tiili SHALL open a new window with ⌘N on macOS (also from the Shell menu's New Window item) and Ctrl+Shift+N on Windows and Linux. The new window SHALL be a full tiili window with its own top bar, grid, panes and shortcuts, holding one pane that starts in the focused pane's folder, placed cascaded from the focused window. Every pane requirement applies to each window on its own; "the window" means the pane's own window.

#### Scenario: Open a second window
- **WHEN** the focused pane is in `~/work/tiili` and the user presses ⌘N on macOS
- **THEN** a new tiili window opens offset from the focused one with one pane whose shell starts in `~/work/tiili`

#### Scenario: Shortcuts act in their own window
- **WHEN** two windows are open and the user presses ⌘T in the focused one
- **THEN** a pane opens only in the focused window

### Requirement: Closing a window
Closing a window, by its close button or by closing its last pane, SHALL end that window's shells and close only that window. When the last window closes, tiili SHALL quit, on macOS too.

#### Scenario: Close one of two windows
- **WHEN** two windows are open and the user closes one
- **THEN** that window's shells end and the other window and its shells stay

#### Scenario: Last window closes
- **WHEN** the last open window closes
- **THEN** tiili quits
