## Why

The default Grid mode picks its column count from the pane count alone (`ceil(sqrt(n))` in `columnsFor()`, `src/layout.ts`). In a tall, narrow window this gives unreadable ~45-column panes and a half-empty last row: Grid is unusable in portrait windows.

## What Changes

- Grid mode (only) chooses columns × rows from the pane area's size in character cells: for each column count c, panes are W/c × H/ceil(n/c) cells, scored by |log(pane aspect / 80:24)| plus a small penalty per empty cell; layouts with panes under ~60 columns are avoided whenever another layout is possible. Wide grid, Tall grid, Side by side and Stacked stay fixed.
- Hysteresis: the layout only flips between the landscape and portrait choice when the area's aspect is clearly past the threshold (landscape above 1.15, portrait below 0.87, relative to the current choice).
- Grid re-chooses when a pane opens or closes, the tiling mode changes, a session is restored, and when a window resize has settled (debounced), not on every resize frame. Crossing the threshold rearranges panes; divider sizes reset only for axes whose track count changes.
- `gridFor(n, mode, size?)`: without a size, today's behaviour is kept.
- Session restore checks the saved sizes against the saved `cols`/`rows` (Grid's chosen shape), so restore keeps the divider sizes.
- Settings: the Grid tile's picture is drawn for the current window's shape, so it shows rows in a portrait window.

## Outcome

- 3 panes in a portrait window (~790 px wide)
  - Now: 2 columns × 2 rows, two ~45-column panes over a full-width pane
  - After: 1 column × 3 rows, each pane full width
- 2 panes in a portrait window
  - Now: side by side
  - After: one above the other
- Landscape windows
  - Now: 2 side by side, 4 as 2×2
  - After: the same
- Settings Grid tile picture
  - Now: always the 7-pane 3-column picture
  - After: the picture follows the window's shape (Grid's choice for 7 panes at the window's size)

## Assumptions

- "Grid dot affected by aspect ratio" is read as: the Grid tile's picture is drawn for the current window's shape; the label "Grid" and tooltip stay. Ruled out: changing the label to "Grid · fits the window".
- Settled resize = 250 ms after the last resize event; ruled out re-choosing on every frame.
- Target pane shape 80×24 cells, minimum comfortable width 60 columns, empty-cell penalty 0.15 per cell; ruled out a user setting for these.
- Cell size comes from the font metrics already used for pane sizing; when unknown (0), a 0.5 width:height cell ratio is assumed.
- Saved sessions without stored cols/rows fall back to `gridFor` without size (today's check).
