## ADDED Requirements

### Requirement: Pane control with tabs
`tiili open` SHALL add its pane to the caller's tab, even when that tab is not shown, without showing it. `tiili list` SHALL list the window's panes tab by tab in strip order, in grid order inside each tab.

#### Scenario: Open from a hidden tab
- **WHEN** a process in a pane of a hidden tab runs `tiili open -- npm test`
- **THEN** the new pane joins that tab's grid and the shown tab does not change

#### Scenario: List across tabs
- **WHEN** tab 1 has panes A, B and tab 2 has pane C, and `tiili list` runs
- **THEN** it prints A, B, C in that order
