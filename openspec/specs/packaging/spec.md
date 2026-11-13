# packaging Specification

## Purpose
How tiili is packaged for release: installers for macOS, Windows and Linux built with Tauri's bundler, and the app icon set they carry.

## Requirements

### Requirement: Installers per platform
The project SHALL build installers through Tauri's bundler: a universal `.dmg` on macOS, an NSIS setup `.exe` on Windows, and `.AppImage` and `.deb` on Linux. Each installer SHALL carry the product name `tiili`, the version from `package.json` and the short description.

#### Scenario: Local bundle on the host
- **WHEN** a developer runs `npm run bundle`
- **THEN** the installers for the host platform are produced, unsigned by default

#### Scenario: Windows installer format
- **WHEN** `npm run bundle` runs on Windows
- **THEN** it produces an NSIS setup `.exe` and no `.msi`

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

### Requirement: Release command
The project SHALL provide `npm run release <patch|minor|major>`. It SHALL refuse to run when the working tree has uncommitted changes or the argument is missing or unknown. Otherwise it SHALL bump the version by that kind in `package.json`, `package-lock.json` and `src-tauri/Cargo.toml` to the same value, leave `src-tauri/tauri.conf.json` taking its version from `package.json` (`"../package.json"`), commit them, tag the commit `v<version>` and push the commit and tag.

#### Scenario: Minor release
- **WHEN** the version is `0.1.3` and `npm run release minor` runs on a clean tree
- **THEN** `package.json`, `package-lock.json` and `src-tauri/Cargo.toml` read `0.2.0`, `src-tauri/tauri.conf.json` still takes its version from `package.json`, and the tag `v0.2.0` is pushed

#### Scenario: Dirty tree
- **WHEN** `npm run release patch` runs with uncommitted changes
- **THEN** it exits with an error and changes nothing

### Requirement: Release build on tag
Pushing a tag `v<version>` SHALL build the installers on macOS, Windows and Linux and attach them all to a draft GitHub Release for that tag. The build SHALL fail when the tag does not match the version in `package.json`. Signing variables SHALL be passed only from secrets that are set, so the release is unsigned when none are.

#### Scenario: Tag pushed
- **WHEN** the tag `v0.2.0` is pushed
- **THEN** a draft release `v0.2.0` holds the universal `.dmg`, the setup `.exe`, the `.AppImage` and the `.deb`

#### Scenario: Tag and version disagree
- **WHEN** the tag `v0.3.0` is pushed but `package.json` says `0.2.0`
- **THEN** the release build fails before bundling

### Requirement: Third-party licence list
The repository SHALL list, with name, version and licence, every third-party npm package the frontend ships and every Rust crate compiled into the app (`THIRD_PARTY_LICENSES.md`, from `npm run licenses`), and every package and asset in the Heynote build (`public/heynote/THIRD_PARTY.md`, from `npm run heynote`). The README's License section SHALL be its last section and SHALL link both lists, the fonts' licences and Heynote's licence.

#### Scenario: Regenerate after a dependency change
- **WHEN** a dependency is added and `npm run licenses` runs
- **THEN** `THIRD_PARTY_LICENSES.md` lists the new package with its licence

#### Scenario: Heynote bundle
- **WHEN** `npm run heynote` finishes
- **THEN** `public/heynote/THIRD_PARTY.md` lists the npm packages in the bundle and Heynote's bundled fonts and scripts
