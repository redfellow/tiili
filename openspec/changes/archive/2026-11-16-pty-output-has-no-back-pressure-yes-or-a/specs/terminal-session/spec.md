## ADDED Requirements

### Requirement: Output flow control
In the app, a pane's shell output SHALL be flow-controlled: the app SHALL stop reading a session's output once about 1 MiB is sent but not yet drawn by the terminal, and resume as the terminal acknowledges it. Heavy output SHALL neither grow memory without bound nor be discarded. Closing a pane or window SHALL release a waiting reader.

#### Scenario: Endless output
- **WHEN** `yes` runs in a pane for a minute
- **THEN** the app's memory stays flat, no output is discarded, and Ctrl+C stops it within a second

#### Scenario: Pane closed while output is held back
- **WHEN** a pane whose reader is waiting for acknowledgement is closed
- **THEN** the reader is released and the session ends
