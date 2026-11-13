# window-top-bar Specification

## Purpose
A top bar across the tiili window that holds the settings gear and the everyday pane actions, so they can be found without knowing a shortcut.

## Requirements

### Requirement: Window top bar
The tiili window SHALL show a top bar above the panes. On macOS it SHALL sit in an overlay title bar beside the native window buttons and SHALL move the window when dragged; on Windows and Linux it SHALL be a slim bar below the native title bar. The panes SHALL fill the window below the bar.

#### Scenario: Panes below the bar
- **WHEN** the window opens
- **THEN** the top bar is shown across the top and the pane grid fills the space below it

### Requirement: Top bar buttons
The right-hand side of the top bar SHALL hold, in order, New pane, Close pane, Reset layout and Settings buttons. Each SHALL do the same as its shortcut, return keyboard focus to the focused pane, and show its name and the platform's shortcut as a tooltip.

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
