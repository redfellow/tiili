## ADDED Requirements

### Requirement: Tabs
A window SHALL hold one or more tabs and show one. Each tab SHALL have its own grid layout, order, column and row sizes and focused pane; the tiling mode SHALL follow Settings for all tabs. Shells in hidden tabs SHALL keep running, and their terminals SHALL keep their size while hidden and refit once when shown. Tabs SHALL only be created by the user.

#### Scenario: Separate grids
- **WHEN** tab 1 has three panes and tab 2 has one, and the user switches to tab 2
- **THEN** one pane fills the grid, and switching back shows the three panes with their sizes and focus as before

#### Scenario: Hidden shells keep running
- **WHEN** a command prints output in a hidden tab
- **THEN** the output is in the pane when the tab is shown, and the shell never got a tiny size

### Requirement: Tab lifecycle
A new tab SHALL open beside the shown tab with one pane in the focused pane's folder and be shown. Closing a tab's last pane SHALL close the tab; closing a window's last tab SHALL close the window.

#### Scenario: Last pane of a tab
- **WHEN** a window has two tabs and the user closes the only pane of the shown tab
- **THEN** that tab closes and the other tab is shown

### Requirement: Tab shortcuts
New tab SHALL be ⇧⌘T on macOS and Ctrl+Alt+Shift+T on Windows and Linux. Next/previous tab SHALL be ⇧⌘] / ⇧⌘[ and Ctrl+Tab / Ctrl+Shift+Tab on macOS, Ctrl+PageDown / Ctrl+PageUp elsewhere, wrapping. Moving the focused pane to the next/previous tab SHALL be ⌃⇧⌘] / ⌃⇧⌘[ and Ctrl+Shift+PageDown / Ctrl+Shift+PageUp. On macOS they SHALL be Shell menu items. No key SHALL reach the shell.

#### Scenario: Next tab
- **WHEN** a Linux window has two tabs and the user presses Ctrl+PageDown on the second
- **THEN** the first tab is shown and the shell receives nothing

#### Scenario: Move pane to next tab
- **WHEN** the user presses ⌃⇧⌘] in a pane of the first of two tabs
- **THEN** the pane moves last into the second tab's grid, that tab is shown and the pane is focused

### Requirement: Move a pane to another tab
The pane's right-click menu SHALL offer Move to Tab ▸, listing the window's other tabs and New Tab. Dragging a pane's grab strip onto a tab in the strip SHALL move it there. A moved pane SHALL keep its shell and scrollback, join the target grid last, and that tab SHALL be shown with the pane focused.

#### Scenario: Move to New Tab
- **WHEN** a tab has two panes and the user chooses Move to Tab ▸ New Tab on one
- **THEN** a new tab holds that pane alone and the old tab keeps the other

## MODIFIED Requirements

### Requirement: Pane shortcuts
The app SHALL open a new pane with ⌘T on macOS and Ctrl+Shift+T on Windows and Linux, close the focused pane with ⌘W / Ctrl+Shift+W, and focus pane N (1–9) of the shown tab with ⌘N on macOS and Alt+N on Windows and Linux. Clicking a pane SHALL focus it. Closing the last pane SHALL close the window.

#### Scenario: Open and close
- **WHEN** the user presses the platform's new-terminal shortcut, then the close shortcut
- **THEN** a new focused pane appears, and then it closes and the layout re-flows

#### Scenario: Focus by number
- **WHEN** three panes are open and the user presses ⌘2 (Alt+2 on Windows and Linux)
- **THEN** the second pane gets focus and the key is not sent to any shell

#### Scenario: Focus by number in a tab
- **WHEN** the shown tab has two panes and another tab has three, and the user presses ⌘3
- **THEN** nothing changes

#### Scenario: Last pane closed
- **WHEN** one pane is open and the user presses the close shortcut
- **THEN** the window closes

### Requirement: Move a pane to another window
The pane's right-click menu and the macOS Shell menu SHALL offer Move to New Window (⌃⌘N on macOS, Ctrl+Alt+Shift+N on Windows and Linux) and Move to Window, a submenu of the other open windows with no shortcut. Moving SHALL add the pane last in the target window's shown tab, bring that window to the front and focus the pane.

#### Scenario: Move to an existing window
- **WHEN** two windows are open, one whose focused pane is in repository `härvääjä`, and the user chooses Move to Window ▸ `härvääjä` for a pane
- **THEN** the pane appears last in that window's grid, the window comes to the front and the pane is focused

#### Scenario: Target has tabs
- **WHEN** the target window has two tabs and shows the second
- **THEN** the pane lands last in the second tab
