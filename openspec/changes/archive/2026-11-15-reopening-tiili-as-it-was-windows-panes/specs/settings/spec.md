## ADDED Requirements

### Requirement: Restore scrollback setting
The Behaviour tab SHALL have a "Restore scrollback and commands" setting, on by default. With it off, tiili SHALL write neither scrollback nor command lines to disk and SHALL delete any already saved; layout, folders and reminder lines are still saved.

#### Scenario: Turned off
- **WHEN** the setting is off and the user quits and relaunches
- **THEN** panes reopen in their folders without scrollback, and no command lines are on disk
