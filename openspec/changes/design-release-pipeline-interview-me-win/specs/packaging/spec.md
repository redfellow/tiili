## MODIFIED Requirements

### Requirement: Installers per platform
The project SHALL build installers through Tauri's bundler: a universal `.dmg` on macOS, an NSIS setup `.exe` on Windows, and `.AppImage` and `.deb` on Linux. Each installer SHALL carry the product name `tiili`, the version from `package.json` and the short description.

#### Scenario: Local bundle on the host
- **WHEN** a developer runs `npm run bundle`
- **THEN** the installers for the host platform are produced, unsigned by default

#### Scenario: Windows installer format
- **WHEN** `npm run bundle` runs on Windows
- **THEN** it produces an NSIS setup `.exe` and no `.msi`

## ADDED Requirements

### Requirement: Release command
The project SHALL provide `npm run release <patch|minor|major>`. It SHALL refuse to run when the working tree has uncommitted changes or the argument is missing or unknown. Otherwise it SHALL bump the version by that kind in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` to the same value, commit them, tag the commit `v<version>` and push the commit and tag.

#### Scenario: Minor release
- **WHEN** the version is `0.1.3` and `npm run release minor` runs on a clean tree
- **THEN** all four files read `0.2.0` and the tag `v0.2.0` is pushed

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
