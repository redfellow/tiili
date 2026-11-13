## MODIFIED Requirements

### Requirement: Automatic grid layout
Panes SHALL be laid out in a grid whose column count depends on the tiling mode from settings. For n panes:
- Grid (default): ceil(sqrt(n)) columns.
- Wide grid: ceil(n / floor(sqrt(n))) columns.
- Tall grid: floor(sqrt(n)) columns.
- Side by side: n columns.
- Stacked: 1 column.

In every mode rows SHALL be ceil(n / columns), filled left-to-right, top-to-bottom, and an unfilled last row SHALL stretch its panes to share the full width. Opening or closing a pane, or changing the tiling mode, SHALL re-flow the layout.

#### Scenario: Grid sizes
- **WHEN** 1, 2, 3, 4, 5 or 9 panes are open in Grid mode
- **THEN** the grid is 1×1, 2×1, 2×2, 2×2, 3×2 and 3×3 (columns × rows) respectively

#### Scenario: Tiling mode sizes
- **WHEN** 5 panes are open in Wide grid, Tall grid, Side by side or Stacked mode
- **THEN** the grid is 3×2, 2×3, 5×1 or 1×5 respectively

#### Scenario: Short last row stretches
- **WHEN** 3 panes are open
- **THEN** two panes sit side by side on the top row and the third fills the full width of the bottom row

#### Scenario: Close re-flows
- **WHEN** 4 panes are open and one is closed
- **THEN** the remaining 3 panes re-flow into the 3-pane layout
