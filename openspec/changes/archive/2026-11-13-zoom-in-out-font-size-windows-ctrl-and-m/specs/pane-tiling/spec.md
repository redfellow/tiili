## ADDED Requirements

### Requirement: Pane zoom
The app SHALL zoom the focused terminal pane's font size with ⌘+ (or ⌘=) and ⌘− on macOS and Ctrl++ (or Ctrl+=) and Ctrl+− on Windows and Linux, one pixel per press within 6–48 px, and SHALL reset it to the Settings font size with ⌘0 / Ctrl+0. Zoom SHALL affect only the focused pane, SHALL NOT be saved or change the Settings font size, and the keys SHALL NOT reach the shell. The pane's PTY SHALL follow its new size.

#### Scenario: Zoom in one pane
- **WHEN** two panes are open at font size 14 and the user presses ⌘+ (Ctrl++ on Windows and Linux) twice in the first
- **THEN** the first pane draws at 16 px, the second stays at 14 px, and no key reaches either shell

#### Scenario: Reset zoom
- **WHEN** a pane is zoomed to 11 px and the user presses ⌘0 (Ctrl+0)
- **THEN** the pane returns to the Settings font size

#### Scenario: Zoom not saved
- **WHEN** a pane is zoomed and the app restarts
- **THEN** every pane starts at the Settings font size
