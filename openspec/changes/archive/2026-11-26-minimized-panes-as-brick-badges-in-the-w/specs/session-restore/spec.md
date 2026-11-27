## ADDED Requirements

### Requirement: Minimized panes reopen minimized
A pane minimized when the app ended SHALL reopen minimized in its tab, with its folder, zoom, title and scrollback. Its program SHALL not run again. Its badge SHALL read `was running: <command>` when a command was recorded, and restoring it SHALL show the pane as other restored panes show, so Up then Enter runs the command again.

#### Scenario: Dev server badge after relaunch
- **WHEN** a minimized pane was running `npm run dev` at quit and tiili relaunches
- **THEN** the bar shows a badge reading `was running: npm run dev` and nothing runs

#### Scenario: Restore and re-run
- **WHEN** the user clicks that badge, presses Up and Enter
- **THEN** the pane is in the grid and `npm run dev` runs
