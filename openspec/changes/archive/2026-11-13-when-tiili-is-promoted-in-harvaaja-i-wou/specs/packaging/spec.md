## ADDED Requirements

### Requirement: Install the app on this Mac
The project SHALL provide `npm run install-app`. On macOS it SHALL build `tiili.app` for the host architecture, replace `/Applications/tiili.app` with it, and add tiili to the Dock only when it isn't already there. On other platforms it SHALL exit with an error that says it runs only on macOS.

#### Scenario: First install
- **WHEN** `npm run install-app` runs on a Mac where tiili isn't in the Dock
- **THEN** `/Applications/tiili.app` holds the new build and tiili is pinned to the Dock once

#### Scenario: Already pinned
- **WHEN** it runs again
- **THEN** the app is replaced and the Dock is left unchanged
