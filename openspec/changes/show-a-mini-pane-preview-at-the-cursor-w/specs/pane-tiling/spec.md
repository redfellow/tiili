## MODIFIED Requirements

### Requirement: Pane motion
When panes are opened, closed, re-flowed, reset or swapped, each pane SHALL animate from its old place and size to its new one. A pane that moves SHALL glide in about 280 ms, easing out. A new pane SHALL grow in over about 380 ms, rising slightly with a lifted shadow and a slight overshoot. A closing pane SHALL shrink and fade out over about 180 ms, easing in and dropping slightly, drawn above the other panes. While a pane glides, its terminal and title SHALL scale evenly from the old font size to the new one instead of re-flowing on each frame. A closing pane's terminal SHALL stay until its pane has faded out. When the OS asks for reduced motion, the change SHALL apply instantly and a closing pane's terminal SHALL be removed at once. Dragging a divider SHALL stay instant. Each pane's PTY SHALL be resized once, to its final size.

#### Scenario: Opening a pane animates
- **WHEN** 2 panes are open and the user opens a third
- **THEN** the new pane grows into its place in about 380 ms and the panes that move glide to their new places in about 280 ms

#### Scenario: Closing a pane animates
- **WHEN** a pane is closed
- **THEN** it shrinks and fades out in about 180 ms above the other panes while the remaining panes glide to fill the grid

#### Scenario: Swap animates
- **WHEN** two panes swap
- **THEN** each slides from its old place to the other's

#### Scenario: Content scales evenly during a glide
- **WHEN** a pane glides to a new size
- **THEN** its terminal text and title scale evenly from the old size to the new one, and the terminal is refit once at the end

#### Scenario: Closing terminal stays until faded
- **WHEN** a pane is closed and reduced motion is off
- **THEN** its terminal stays visible until the pane has faded out, and is disposed after that

#### Scenario: Reduced motion
- **WHEN** the OS asks for reduced motion and a pane opens, closes or swaps
- **THEN** the panes take their new places instantly
