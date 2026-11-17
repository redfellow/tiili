## MODIFIED Requirements

### Requirement: Programs are not re-run
tiili SHALL never re-run a program on restore. A pane that was running a command SHALL show a dim line `— was running: <command> —`, or `— was connected to <host> —` for a remote pane, and with tiili's zsh, bash or PowerShell integration a local pane's command SHALL be the newest entry of that shell's history so Up then Enter runs it. A remote pane SHALL never seed history. Other shells SHALL show the foreground program name only.

#### Scenario: Up re-runs
- **WHEN** a zsh pane was running `npm run dev` at quit and tiili relaunches
- **THEN** the pane shows `— was running: npm run dev —`, nothing runs, and Up puts `npm run dev` on the prompt

#### Scenario: Remote command is not seeded
- **WHEN** a pane connected to a host had a recorded command at quit and tiili relaunches
- **THEN** the pane shows `— was connected to <host> —` and the command is not added to the local shell's history
