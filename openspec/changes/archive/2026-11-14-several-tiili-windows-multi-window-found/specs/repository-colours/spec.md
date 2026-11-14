## ADDED Requirements

### Requirement: Tints are shared across windows
Project tints SHALL be assigned once for the whole app, so a repository has the same tint in every window, and the least-used rule SHALL count open panes in all windows.

#### Scenario: Same repository in two windows
- **WHEN** a pane in one window and a pane in another window are in the same repository
- **THEN** both show the same tint
