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
The right-hand side of the top bar SHALL hold, in order, New pane, Heynote, Reset layout and Settings buttons. Each SHALL do the same as its shortcut, if it has one, return keyboard focus to the focused pane, and show a popover tooltip with its name, and the platform's shortcut where there is one, as soon as the pointer is over it.

#### Scenario: New pane button
- **WHEN** the user clicks New pane
- **THEN** a new focused pane opens, as with the new-terminal shortcut

#### Scenario: Heynote button
- **WHEN** the user clicks Heynote
- **THEN** the Heynote pane opens, or takes the focus when it is already open

#### Scenario: Close pane button
- **WHEN** the user looks at the top bar
- **THEN** it has no Close pane button; each pane's title row has its own close icon

#### Scenario: Reset layout button
- **WHEN** the user has resized panes and clicks Reset layout
- **THEN** all rows and columns return to equal sizes

#### Scenario: Settings button
- **WHEN** the user clicks the gear
- **THEN** the settings dialogue opens

#### Scenario: Instant tooltip
- **WHEN** the pointer moves over the New pane button
- **THEN** a tooltip reading New pane and the platform's shortcut shows at once

### Requirement: Tab strip
While a window has two or more tabs, the top bar SHALL show a tab strip on its left (after the native window buttons on macOS); with one tab it SHALL be hidden. A tab SHALL be labelled with its focused pane's chip text in that pane's tint until renamed. Clicking a tab SHALL show it; dragging tabs SHALL reorder them.

#### Scenario: Strip appears
- **WHEN** a window with one tab gets a second tab
- **THEN** the strip shows both tabs, the shown one highlighted

#### Scenario: Reorder
- **WHEN** the user drags the second tab before the first
- **THEN** the strip order and `tiili list` order follow

### Requirement: Tab menu
Right-clicking a tab SHALL open a menu with Rename…, Pop Out and Close Tab. Rename SHALL set a lasting name; an empty name SHALL restore the automatic label. Pop Out SHALL move the whole tab, layout, panes and sessions, to a new window, and SHALL do nothing for a window's only tab. Close Tab SHALL ask first when the tab holds more than one pane.

#### Scenario: Pop Out
- **WHEN** a window has two tabs and the user chooses Pop Out on one with three panes
- **THEN** a new window opens with those three panes in the same layout, shells and scrollback intact, and the old window keeps one tab

#### Scenario: Clear the name
- **WHEN** the user renames a tab to an empty name
- **THEN** its label follows the focused pane's chip again

#### Scenario: Close a busy tab
- **WHEN** the user chooses Close Tab on a tab with two panes
- **THEN** tiili asks first and closes both panes only when confirmed
