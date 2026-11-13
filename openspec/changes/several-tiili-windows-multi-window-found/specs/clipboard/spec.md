## ADDED Requirements

### Requirement: Menus act on the focused window
On macOS the Edit, Shell and app menu items SHALL act only on the focused window.

#### Scenario: Copy with two windows open
- **WHEN** two windows are open and the user chooses Edit › Copy
- **THEN** only the focused window's focused pane copies its selection
