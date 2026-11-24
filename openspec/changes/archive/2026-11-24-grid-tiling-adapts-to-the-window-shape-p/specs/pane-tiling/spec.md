## MODIFIED Requirements

### Requirement: Automatic grid layout
Panes SHALL be laid out in a grid whose column count for n panes depends on the tiling mode from settings (Grid by default), as the Column count per tiling mode scenario sets out. In every mode rows SHALL be ceil(n / columns), filled left-to-right, top-to-bottom, and an unfilled last row SHALL stretch its panes to share the full width.

#### Scenario: Column count per tiling mode
- **WHEN** n panes are open
- **THEN** in Grid mode the column count fits the window's shape as the Grid fits the window requirement sets out, and is ceil(sqrt(n)) when the size is unknown; it is ceil(n / floor(sqrt(n))) in Wide grid, floor(sqrt(n)) in Tall grid, n in Side by side and 1 in Stacked

#### Scenario: Grid sizes
- **WHEN** 1, 2, 3, 4, 5 or 9 panes are open in Grid mode in a landscape window
- **THEN** the grid is 1×1, 2×1, 2×2, 2×2, 3×2 and 3×3 (columns × rows) respectively

#### Scenario: Tiling mode sizes
- **WHEN** 5 panes are open in Wide grid, Tall grid, Side by side or Stacked mode, in any window shape
- **THEN** the grid is 3×2, 2×3, 5×1 or 1×5 respectively

#### Scenario: Short last row stretches
- **WHEN** 3 panes are open in a landscape window
- **THEN** two panes sit side by side on the top row and the third fills the full width of the bottom row

#### Scenario: Close re-flows
- **WHEN** 4 panes are open and one is closed
- **THEN** the remaining 3 panes re-flow into the 3-pane layout

### Requirement: Grid re-flow
Opening or closing a pane, changing the tiling mode, or a settled window resize that changes Grid mode's choice SHALL re-flow the grid layout.

#### Scenario: Tiling mode change re-flows
- **WHEN** 5 panes are open in Grid mode in a landscape window and the tiling mode is changed to Stacked
- **THEN** the panes re-flow from 3×2 to 1×5

#### Scenario: Settled resize re-flows
- **WHEN** 2 panes sit side by side in Grid mode and the window is resized to a clearly portrait shape
- **THEN** once the resize has settled the panes re-flow to one above the other, and not during the drag

## ADDED Requirements

### Requirement: Grid fits the window
In Grid mode the columns SHALL be chosen from the pane area's size in character cells so each pane is closest to an 80×24 terminal shape, with a small penalty for empty cells, avoiding panes under 60 columns when another layout exists. The choice SHALL only change when the shape is clearly past the threshold, so it does not flip back and forth.

#### Scenario: Portrait windows get rows
- **WHEN** 2 or 3 panes are open in Grid mode in a portrait window about 790 px wide
- **THEN** the grid is 1×2 or 1×3 respectively

#### Scenario: Hysteresis
- **WHEN** the window's shape moves only slightly past the point where another layout would score best
- **THEN** the grid keeps its current layout

#### Scenario: Restore keeps divider sizes
- **WHEN** a session saved with a Grid layout and dragged divider sizes is restored
- **THEN** the panes reopen in the saved columns × rows with the saved sizes

#### Scenario: Settings picture follows the window
- **WHEN** the settings dialogue opens in a portrait window
- **THEN** the Grid tile's picture shows Grid mode's layout for that window's shape
