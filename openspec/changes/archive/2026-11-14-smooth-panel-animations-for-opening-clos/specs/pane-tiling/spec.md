## ADDED Requirements

### Requirement: Pane motion
When panes are opened, closed, re-flowed, reset or swapped, each pane SHALL animate from its old place and size to its new one in about 180 ms. A new pane SHALL grow in and a closing pane SHALL shrink and fade out. When the OS asks for reduced motion, the change SHALL apply instantly. Dragging a divider SHALL stay instant. Each pane's PTY SHALL be resized once, to its final size.

#### Scenario: Opening a pane animates
- **WHEN** 2 panes are open and the user opens a third
- **THEN** the new pane grows into its place and the panes that move glide to their new places

#### Scenario: Closing a pane animates
- **WHEN** a pane is closed
- **THEN** it shrinks and fades out while the remaining panes glide to fill the grid

#### Scenario: Swap animates
- **WHEN** two panes swap
- **THEN** each slides from its old place to the other's

#### Scenario: Reduced motion
- **WHEN** the OS asks for reduced motion and a pane opens, closes or swaps
- **THEN** the panes take their new places instantly
