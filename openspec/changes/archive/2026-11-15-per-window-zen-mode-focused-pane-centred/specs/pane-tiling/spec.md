## ADDED Requirements

### Requirement: Zen mode
Each window SHALL have a Zen mode that shows only one pane, centred horizontally at the Zen width and full height of the pane area, with the window background on both sides. Other panes SHALL stay open, hidden, keeping their shells, output and PTY size. Leaving Zen SHALL restore the grid with its order, sizes and tiling mode. With one pane, Zen SHALL not apply.

#### Scenario: Enter and leave
- **WHEN** three panes are open and the user turns Zen on in the second, then off
- **THEN** only the second pane shows centred, and afterwards the grid returns as it was

#### Scenario: Width clamp
- **WHEN** the Zen width is 140 columns and the window's pane area is narrower than 140 columns plus margins
- **THEN** the Zen pane is 90% of the pane area wide

#### Scenario: Last-but-one closed
- **WHEN** Zen is on with two panes and one closes
- **THEN** Zen ends and the remaining pane fills the window

### Requirement: Zen toggle
Each pane's title row SHALL have a Zen icon at its right end, hidden with one pane, lit in the accent colour while that pane is in Zen, with tooltip "Zen mode" and the shortcut. Clicking it, double-clicking the title row, ⇧⌘↩ on macOS, Ctrl+Shift+Enter on Windows and Linux, and Shell ▸ Zen Mode on macOS SHALL toggle Zen for the focused pane. The shortcut SHALL not reach the shell.

#### Scenario: Shortcut toggles
- **WHEN** two panes are open and the user presses Ctrl+Shift+Enter on Linux
- **THEN** the focused pane enters Zen and the shell receives nothing

### Requirement: Zen follows focus
While Zen is on, focusing a pane by number or by the attention shortcut, opening a new pane from the user, or closing the Zen pane SHALL show the newly focused pane in Zen. A pane opened through pane control SHALL join the hidden grid without changing the Zen pane. Moving the Zen pane to another window SHALL end Zen in this window; the pane arrives normal.

#### Scenario: Focus by number in Zen
- **WHEN** Zen shows pane 1 and the user presses ⌘3
- **THEN** pane 3 is shown in Zen

#### Scenario: Agent opens a pane
- **WHEN** Zen is on and `tiili open` opens a pane in this window
- **THEN** the Zen pane stays shown and the new pane is hidden in the grid
