# app-version Specification

## Purpose
Show which version of tiili is running, so the user can tell builds apart and report it.

## Requirements

### Requirement: Version on the splash
The startup splash SHALL show the app version, as `v` followed by the version from the app's package, small and muted at the bottom-right corner, and SHALL remove it when the splash goes.

#### Scenario: Splash shows the version
- **WHEN** the startup splash plays
- **THEN** the bottom-right corner shows the app version, such as `v0.1.1`

### Requirement: Splash after an update
With the startup splash turned on, it SHALL play at the first start of each local day and again at the first start in a version it has not played in, whatever the day.

#### Scenario: New version plays the splash
- **WHEN** the splash already played today and tiili starts for the first time after an update
- **THEN** the splash plays

#### Scenario: Once a day otherwise
- **WHEN** the splash already played today in this version and tiili starts again
- **THEN** the splash does not play

### Requirement: Splash never blocks startup
The splash SHALL never keep the terminals from starting: it SHALL lay its wall once the window has a size, and a splash that fails SHALL be cleared so the panes, or a start-up error, show.

#### Scenario: Hidden window at startup
- **WHEN** the splash starts while the window is still hidden and measures 0×0
- **THEN** the splash plays once the window is shown and the panes open under it

### Requirement: Version in settings
The settings dialogue SHALL show `tiili` followed by the app version at the left of its footer, on every tab.

#### Scenario: Settings shows the version
- **WHEN** the user opens the settings dialogue
- **THEN** the footer shows the app version, such as `tiili 0.1.1`

### Requirement: Pull request number in a dev build's settings
For a dev build whose branch has a pull request, found with `gh` at build time, the settings footer SHALL read `tiili dev build · PR #` followed by its number. When no pull request is found, or for a release, the footer SHALL be as before.

#### Scenario: Dev build with a pull request
- **WHEN** a dev build made on a branch with pull request 123 opens settings
- **THEN** the footer reads `tiili dev build · PR #123`

#### Scenario: Dev build without a pull request
- **WHEN** a dev build made where `gh` finds no pull request opens settings
- **THEN** the footer reads `tiili dev build`
