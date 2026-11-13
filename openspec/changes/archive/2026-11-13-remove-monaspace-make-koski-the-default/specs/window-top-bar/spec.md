## MODIFIED Requirements

### Requirement: Top bar buttons
The right-hand side of the top bar SHALL hold, in order, New pane, Close pane, Reset layout and Settings buttons. Each SHALL do the same as its shortcut, return keyboard focus to the focused pane, and show a popover tooltip with its name and the platform's shortcut as soon as the pointer is over it.

#### Scenario: New pane button
- **WHEN** the user clicks New pane
- **THEN** a new focused pane opens, as with the new-terminal shortcut

#### Scenario: Close pane button
- **WHEN** two panes are open and the user clicks Close pane
- **THEN** the focused pane closes and the layout re-flows

#### Scenario: Reset layout button
- **WHEN** the user has resized panes and clicks Reset layout
- **THEN** all rows and columns return to equal sizes

#### Scenario: Settings button
- **WHEN** the user clicks the gear
- **THEN** the settings dialogue opens

#### Scenario: Instant tooltip
- **WHEN** the pointer moves over the New pane button
- **THEN** a tooltip reading New pane and the platform's shortcut shows at once
