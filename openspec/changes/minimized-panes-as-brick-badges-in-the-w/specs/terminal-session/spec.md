## MODIFIED Requirements

### Requirement: Shell exit closes its pane
When a pane's shell exits, the app SHALL close that pane as the close shortcut does, without offering a new shell, unless the pane is minimized: a minimized pane SHALL stay, its badge showing the exit code. When the closed pane was the last pane, the window SHALL close.

#### Scenario: Exit closes the pane
- **WHEN** two panes are open and the shell in one exits
- **THEN** that pane closes and the layout re-flows

#### Scenario: Last shell exit closes the app
- **WHEN** one pane is open and its shell exits
- **THEN** the window closes

#### Scenario: Minimized pane stays
- **WHEN** a minimized pane's shell exits with code 0
- **THEN** the pane stays minimized and its badge shows the exited state with `0`
