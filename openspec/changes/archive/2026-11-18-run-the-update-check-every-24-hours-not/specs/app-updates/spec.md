## MODIFIED Requirements

### Requirement: Daily update check
When automatic checks are on, the first tiili window SHALL check `https://github.com/redfellow/tiili/releases/latest/download/latest.json` at startup and whenever it gains focus, at most once in 24 hours, and send nothing else. A check SHALL NOT open a second update dialog while one is open.

#### Scenario: Checked today already
- **WHEN** tiili starts 3 hours after the last check
- **THEN** no request is made

#### Scenario: Checks off
- **WHEN** automatic checks are off and tiili starts
- **THEN** no request is made

#### Scenario: Focused a day later
- **WHEN** tiili has been open for 25 hours since the last check and the user focuses its window
- **THEN** one request is made

#### Scenario: Focused soon after a check
- **WHEN** the user focuses the window 2 hours after the last check
- **THEN** no request is made
