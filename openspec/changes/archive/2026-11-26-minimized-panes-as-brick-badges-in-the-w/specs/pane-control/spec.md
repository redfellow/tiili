## ADDED Requirements

### Requirement: Open minimized
`tiili open --minimized [other flags] -- CMD ARGS...` SHALL open the pane as `tiili open` does, but minimized: it never joins the grid, and its badge shows in the window's top bar. Its PTY SHALL start at the caller's pane size. `--minimized` SHALL combine with `--key`, `--cwd`, `--title` and `--json`.

#### Scenario: Dev server out of the way
- **WHEN** a process runs `tiili open --minimized -- npm run dev`
- **THEN** the grid does not change, a badge reading `npm run dev` appears, and the pane's id is printed

### Requirement: Minimize and restore from the command line
`tiili minimize [PANE]` and `tiili restore [PANE]` SHALL minimize or restore the caller's own pane, or with PANE a pane the caller opened, and exit 0. They fail as `tiili close` does with `no_such_pane` or `not_opened_by_you`. Minimizing the only visible pane of its tab SHALL fail with `last_visible_pane`. Minimizing a minimized pane or restoring a visible one SHALL succeed and change nothing.

#### Scenario: Minimize own pane
- **WHEN** a process in pane 3, one of two visible panes, runs `tiili minimize`
- **THEN** pane 3 is minimized and the command exits 0

#### Scenario: Restore an opened pane
- **WHEN** pane 3 opened pane 8 minimized and runs `tiili restore 8`
- **THEN** pane 8 joins its tab's grid, the focus stays where it was, and the command exits 0

#### Scenario: Refuse another pane
- **WHEN** pane 3 runs `tiili minimize 5` for a pane it did not open
- **THEN** nothing changes and it fails with `not_opened_by_you`

#### Scenario: Last visible pane
- **WHEN** pane 3 is its tab's only visible pane and runs `tiili minimize`
- **THEN** nothing changes and it fails with `last_visible_pane`

## MODIFIED Requirements

### Requirement: List the window's panes

`tiili list` SHALL print one line per pane of the caller's window, in grid order, with the pane's id, working directory and title separated by tabs, and a fourth field `minimized` on minimized panes.

#### Scenario: List panes
- **WHEN** a process in a window with two terminal panes runs `tiili list`
- **THEN** two lines are printed, each with that pane's id, working directory and title

#### Scenario: Minimized pane listed
- **WHEN** pane 8 is minimized and `tiili list` runs
- **THEN** pane 8's line ends with a tab and `minimized`, and the other lines are unchanged

### Requirement: List as JSON
Each pane record in `tiili list --json`'s `panes` SHALL also carry `tab` (counting from 1, `null` when unknown), `key` (the `--key` it was opened with, else `null`), `opened_by_you` and `minimized`; a keyed `tiili open --json` that found its pane open SHALL add `"reused":true`.

#### Scenario: Own and opened panes
- **WHEN** pane 3 opened pane 8 with key dev and runs `tiili list --json`
- **THEN** pane 3 has `self` true, and pane 8 has `opened_by_you` true and `key` `dev`

#### Scenario: Minimized in JSON
- **WHEN** pane 8 is minimized and `tiili list --json` runs
- **THEN** pane 8 has `minimized` true and the other panes have `minimized` false
