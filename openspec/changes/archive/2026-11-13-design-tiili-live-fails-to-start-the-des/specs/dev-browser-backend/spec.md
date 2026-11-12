## ADDED Requirements

### Requirement: Bridge reports a shell it cannot start
When the dev bridge accepts a connection but cannot open a pseudo-terminal or start the shell, it SHALL send the page an error message with the reason and close the connection. The browser terminal SHALL show one line, `The dev bridge could not open a shell: <reason>`, and the rest of the interface SHALL stay usable. When the shell starts, the bridge SHALL tell the page it is ready.

#### Scenario: No pseudo-terminal available
- **WHEN** the bridge's attempt to open a PTY fails with a reason
- **THEN** the terminal shows `The dev bridge could not open a shell: <reason>` and no shell runs

#### Scenario: Shell starts
- **WHEN** the bridge starts the shell
- **THEN** it sends a ready message, and the terminal runs the user's shell
