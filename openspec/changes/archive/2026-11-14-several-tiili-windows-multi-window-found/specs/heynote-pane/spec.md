## ADDED Requirements

### Requirement: One Heynote across windows
At most one Heynote pane SHALL be open across all windows. Asking for Heynote in a window that does not hold it SHALL bring the window holding it forward and focus its Heynote pane.

#### Scenario: Heynote open in another window
- **WHEN** Heynote is open in one window and the user clicks the Heynote button in another
- **THEN** no new pane opens and the window holding Heynote comes forward with its Heynote pane focused
