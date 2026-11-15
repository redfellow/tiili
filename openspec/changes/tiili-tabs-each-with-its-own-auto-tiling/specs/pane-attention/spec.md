## ADDED Requirements

### Requirement: Attention in background tabs
A background tab with marked panes SHALL show a brick and the count of its marked panes in the tab strip, and no output-activity mark. The next-pane shortcut SHALL show the tab holding the marked pane before focusing it.

#### Scenario: Mark in a background tab
- **WHEN** a pane in a hidden tab rings the bell and the user presses ⌘J
- **THEN** the tab showed a brick and `1`, and now it is shown with that pane focused and the mark cleared
