# pane-layout Specification

## Purpose
Manual control over the tiled pane grid in the tiili window: dragging dividers to resize grid rows and columns, swapping panes, resetting the layout, and keeping applicable manual sizes when the grid re-flows; each pane's PTY follows its new size.

## Requirements

### Requirement: Resize grid rows and columns
The user SHALL be able to drag the divider between two grid columns or rows to resize them, and each pane whose size changed SHALL have its new rows and columns sent to its pseudo-terminal once the drag ends.

#### Scenario: Divider drag resizes PTYs on release
- **WHEN** the user drags a column divider and releases it
- **THEN** the columns on both sides change width and each pane in those columns gets one PTY resize with its new size

#### Scenario: Minimum size
- **WHEN** a divider is dragged past a neighbour's minimum size
- **THEN** the neighbour stops at its minimum size

### Requirement: Swap panes
The user SHALL be able to swap two panes by dragging one pane's top edge onto another pane, and SHALL be able to move the focused pane left, right, up or down with ⌃⌘+arrow on macOS and Ctrl+Alt+Shift+arrow on Windows and Linux.

#### Scenario: Drag swap
- **WHEN** the user drags pane A's top edge onto pane B
- **THEN** A and B exchange grid positions and keep their sessions

#### Scenario: Keyboard move
- **WHEN** the focused pane has a right-hand neighbour and the user presses the move-right shortcut
- **THEN** the two panes swap, focus stays on the moved pane, and the key is not sent to the shell

#### Scenario: Edge of grid
- **WHEN** the focused pane is in the leftmost column and the user presses move-left
- **THEN** nothing changes

### Requirement: Reset layout
⌃⌘0 on macOS and Ctrl+Alt+Shift+0 on Windows and Linux SHALL reset all row and column sizes to the automatic even grid.

#### Scenario: Reset
- **WHEN** the user has resized panes and presses the reset shortcut
- **THEN** all rows and columns return to equal sizes

### Requirement: Re-flow keeps applicable manual sizes
When a terminal opens or closes, the layout SHALL keep manual sizes for each axis whose track count is unchanged and reset only an axis whose track count changed.

#### Scenario: Same shape
- **WHEN** a 2×2 grid with resized columns gains or loses a pane and stays 2×2
- **THEN** the manual column and row sizes are kept

#### Scenario: Shape changes
- **WHEN** the grid changes from 2 columns × 1 row to 2 × 2 after the column widths were resized
- **THEN** the column widths are kept and the rows are equal

### Requirement: Pane drag feedback
Once a pane's grab strip has been dragged more than 3 px, a label with the pane's chip name (or "Terminal") SHALL follow the pointer. The source pane SHALL dim and the pointer SHALL show grabbing everywhere until the drop or cancel, which SHALL remove all of these.

#### Scenario: Drag shows a ghost
- **WHEN** the user drags a pane's grab strip 10 px
- **THEN** a label naming the pane follows the pointer and the source pane is dimmed

### Requirement: Terminal scrollbar
Each terminal's scrollbar SHALL be 8 px wide and SHALL NOT show an overview-ruler border.

#### Scenario: Slim scrollbar
- **WHEN** a terminal has scrollback
- **THEN** its scrollbar is 8 px wide with no hairline beside it
