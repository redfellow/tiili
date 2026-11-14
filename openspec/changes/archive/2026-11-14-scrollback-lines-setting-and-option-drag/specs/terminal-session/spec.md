## ADDED Requirements

### Requirement: Option-drag selects on macOS
On macOS, dragging with Option held SHALL select text even when the running program reports the mouse. A plain Option-click SHALL still move the shell cursor, and double-click and triple-click SHALL still select a word and a line.

#### Scenario: Select over vim
- **WHEN** vim with mouse reporting runs on macOS and the user Option-drags over its text
- **THEN** the text is selected and vim receives no mouse events

#### Scenario: Option-click at the prompt
- **WHEN** the user Option-clicks inside the command line at a shell prompt on macOS
- **THEN** the shell cursor moves to that place
