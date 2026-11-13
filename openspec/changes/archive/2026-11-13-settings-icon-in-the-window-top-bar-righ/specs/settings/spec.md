## MODIFIED Requirements

### Requirement: Settings dialogue
The app SHALL open a settings dialogue with ⌘, on macOS (also from the app menu's Settings… item) and Ctrl+, on Windows and Linux, from a Settings… item in the terminal's context menu, and from the gear at the right of the window's top bar. Changes SHALL apply immediately.

#### Scenario: Open by shortcut
- **WHEN** the user presses the platform's settings shortcut
- **THEN** the settings dialogue opens and the key is not sent to the shell

#### Scenario: Open from the top bar
- **WHEN** the user clicks the gear in the window's top bar
- **THEN** the settings dialogue opens
