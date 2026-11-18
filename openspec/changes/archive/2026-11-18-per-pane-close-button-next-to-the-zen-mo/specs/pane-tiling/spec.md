## ADDED Requirements

### Requirement: Pane close icon
Each pane's title row SHALL have a close icon right of the Zen icon, shown only while the pointer is over the pane, hidden with one pane, with tooltip "Close pane" and the platform's close shortcut. Clicking it SHALL close that pane, whichever pane has focus, and the layout SHALL re-flow.

#### Scenario: Close on hover
- **WHEN** two panes are open and the pointer is over the first
- **THEN** the first pane shows the close icon and the second does not

#### Scenario: Closes the clicked pane
- **WHEN** pane 2 has focus and the user clicks pane 1's close icon
- **THEN** pane 1 closes and pane 2 keeps the focus

#### Scenario: One pane
- **WHEN** only one pane is open
- **THEN** it shows no close icon
