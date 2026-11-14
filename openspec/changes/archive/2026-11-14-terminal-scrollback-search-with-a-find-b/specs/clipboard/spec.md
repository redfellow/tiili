## MODIFIED Requirements

### Requirement: Platform copy and paste shortcuts
The app SHALL copy the terminal selection and paste clipboard text with platform shortcuts: ⌘C, ⌘V and ⌘A (Select All) through an Edit menu on macOS; Ctrl+Shift+C and Ctrl+Shift+V on Windows and Linux. The macOS Edit menu SHALL also have Find… (⌘F), Find Next (⌘G) and Find Previous (⇧⌘G) acting on the focused pane.

#### Scenario: macOS Edit menu
- **WHEN** the app runs on macOS
- **THEN** the menu bar has an Edit menu with Copy (⌘C), Paste (⌘V) and Select All (⌘A) that act on the terminal, and Find… (⌘F), Find Next (⌘G) and Find Previous (⇧⌘G) that act on the focused pane

#### Scenario: Windows and Linux shortcuts
- **WHEN** the user presses Ctrl+Shift+C with text selected, or Ctrl+Shift+V, on Windows or Linux
- **THEN** the selection is copied, or the clipboard text is pasted into the shell, and the key is not sent to the shell
