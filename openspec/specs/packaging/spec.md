# packaging Specification

## Purpose
How tiili is packaged for release: installers for macOS, Windows and Linux built with Tauri's bundler, and the app icon set they carry.

## Requirements

### Requirement: Installers per platform
The project SHALL build installers through Tauri's bundler: a universal `.dmg` on macOS, `.msi` on Windows, and `.AppImage` and `.deb` on Linux. Each installer SHALL carry the product name `tiili`, the version from `package.json` and the short description.

#### Scenario: Local bundle on the host
- **WHEN** a developer runs `npm run bundle`
- **THEN** the installers for the host platform are produced, unsigned by default

### Requirement: Complete icon set
The repository SHALL contain app icons generated from the brand SVGs at every size each platform expects. Sizes of 32 px and below SHALL come from the small icon.

#### Scenario: Icon set check
- **WHEN** the icon check runs
- **THEN** it passes only if every icon file required for macOS, Windows and Linux exists at the expected size

### Requirement: Signing off by default
Code signing and notarisation SHALL be configurable through environment variables only. They SHALL be off when those variables are unset, and no secret SHALL be stored in the repository.

#### Scenario: No secrets set
- **WHEN** `npm run bundle` runs without signing variables
- **THEN** the build succeeds unsigned

### Requirement: Install the app on this Mac
The project SHALL provide `npm run install-app`. On macOS it SHALL build `tiili.app` for the host architecture, replace `/Applications/tiili.app` with it, and add tiili to the Dock only when it isn't already there. On other platforms it SHALL exit with an error that says it runs only on macOS.

#### Scenario: First install
- **WHEN** `npm run install-app` runs on a Mac where tiili isn't in the Dock
- **THEN** `/Applications/tiili.app` holds the new build and tiili is pinned to the Dock once

#### Scenario: Already pinned
- **WHEN** it runs again
- **THEN** the app is replaced and the Dock is left unchanged
