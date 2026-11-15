## ADDED Requirements

### Requirement: Attention from the command line
`tiili attention [MSG]` SHALL mark the caller's own pane as an attention signal with MSG as the message, through the same safety, rate limit and needs-you rules as escape-code signals. `tiili attention --clear` SHALL clear the caller's mark. It SHALL never act on another pane or move focus.

#### Scenario: Agent asks for the user
- **WHEN** a process in an unfocused pane runs `tiili attention "Review ready"`
- **THEN** the pane is marked with `Review ready`, counted, and a notification is sent as for OSC 9

#### Scenario: Focused pane
- **WHEN** the caller's pane is the focused pane in the front window
- **THEN** nothing is marked

#### Scenario: Agent clears
- **WHEN** a marked pane's process runs `tiili attention --clear`
- **THEN** its mark clears
