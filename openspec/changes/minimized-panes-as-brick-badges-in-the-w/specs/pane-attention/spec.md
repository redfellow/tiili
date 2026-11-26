## ADDED Requirements

### Requirement: Attention for minimized panes
A minimized pane SHALL be marked, counted, notified and reached by the attention shortcut as any other unfocused pane. When its process exits with a non-zero code while minimized, it SHALL be marked with the message `exited with code N`.

#### Scenario: Crash while minimized
- **WHEN** a minimized pane's process exits with code 1 while the window is in the background
- **THEN** the pane is marked `exited with code 1`, the attention count rises, and the app icon is badged

#### Scenario: Clean exit
- **WHEN** a minimized pane's process exits with code 0
- **THEN** no mark is added
