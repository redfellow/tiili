## REMOVED Requirements

### Requirement: Shell exit offers a new shell
**Reason**: An exited shell now closes its pane instead of offering a restart.
**Migration**: Open a new pane with the new-terminal shortcut.

## ADDED Requirements

### Requirement: Shell exit closes its pane
When a pane's shell exits, the app SHALL close that pane as the close shortcut does, without offering a new shell. When it was the last pane, the window SHALL close.

#### Scenario: Exit closes the pane
- **WHEN** two panes are open and the shell in one exits
- **THEN** that pane closes and the layout re-flows

#### Scenario: Last shell exit closes the app
- **WHEN** one pane is open and its shell exits
- **THEN** the window closes
