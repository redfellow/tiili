## ADDED Requirements

### Requirement: Pull request number in a dev build's settings
For a dev build whose branch has a pull request, found with `gh` at build time, the settings footer SHALL read `tiili dev build · PR #` followed by its number. When no pull request is found, or for a release, the footer SHALL be as before.

#### Scenario: Dev build with a pull request
- **WHEN** a dev build made on a branch with pull request 123 opens settings
- **THEN** the footer reads `tiili dev build · PR #123`

#### Scenario: Dev build without a pull request
- **WHEN** a dev build made where `gh` finds no pull request opens settings
- **THEN** the footer reads `tiili dev build`
