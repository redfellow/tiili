## MODIFIED Requirements

### Requirement: Pane motion
When panes are opened, closed, re-flowed, reset or swapped, each pane SHALL animate from its old place and size to its new one with an ease-out motion in about 280 ms. A new pane SHALL rise, grow and fade in, with a slight spring, in about 380 ms. A closing pane SHALL shrink and fade out above the other panes in about 180 ms, and its terminal SHALL stay visible until then. When the OS asks for reduced motion, the change SHALL apply instantly. Dragging a divider SHALL stay instant.

#### Scenario: Opening a pane animates
- **WHEN** 2 panes are open and the user opens a third
- **THEN** the new pane grows into its place and the panes that move glide to their new places

#### Scenario: Closing a pane animates
- **WHEN** a pane is closed
- **THEN** it shrinks and fades out while the remaining panes glide to fill the grid

#### Scenario: Swap animates
- **WHEN** two panes swap
- **THEN** each slides from its old place to the other's

#### Scenario: Gliding text scales evenly
- **WHEN** a pane shrinks to half its width because another pane opens
- **THEN** its terminal re-wraps once and its text shrinks gradually over the glide without stretching, and its title keeps its size

#### Scenario: Reduced motion
- **WHEN** the OS asks for reduced motion and a pane opens, closes or swaps
- **THEN** the panes take their new places instantly
- **THEN** the column widths are kept and the rows are equal

## ADDED Requirements

### Requirement: Gliding pane content scaling
While a pane glides, its terminal and title SHALL scale evenly rather than stretch. The terminal's line wrapping SHALL change once at the start, and its text SHALL then scale smoothly from its old size to its new one, while the title keeps a constant size. Each pane's PTY SHALL be resized once, to its final size.

#### Scenario: Gliding pane keeps its proportions
- **WHEN** a pane grows to twice its width because another pane closes
- **THEN** its terminal and title are never drawn stretched or squashed during the glide
