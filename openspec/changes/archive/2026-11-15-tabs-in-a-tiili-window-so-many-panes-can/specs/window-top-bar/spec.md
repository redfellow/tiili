## ADDED Requirements

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
