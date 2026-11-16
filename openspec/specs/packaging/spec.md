# packaging Specification

## Purpose
How tiili is packaged for release: installers for macOS, Windows and Linux built with Tauri's bundler, and the app icon set they carry.

## Requirements

### Requirement: Installers per platform
The project SHALL build installers through Tauri's bundler: an Apple Silicon `.dmg` on macOS, an NSIS setup `.exe` on Windows, and `.AppImage` and `.deb` on Linux. Each installer SHALL carry the product name `tiili`, the version from `src-tauri/Cargo.toml` and the short description.

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

### Requirement: macOS bundle icon follows the appearance
The macOS app bundle SHALL carry an asset catalog icon, compiled from the light and the dark brand icons, so that Finder and the Dock show the icon matching the OS appearance while tiili is not running. Both icons SHALL be a near-black tile with one wide brick holding `>_` in its centre. The bundle SHALL keep `icon.icns` as the fallback for systems without asset catalog icons.

#### Scenario: Closed app in dark mode
- **WHEN** tiili is installed with `npm run install-app`, is not running, and the Mac's icon style is Dark
- **THEN** the Dock and Finder show the dark icon (near-black tile, savi brick with a near-black `>_`)

#### Scenario: Closed app in light mode
- **WHEN** tiili is installed, is not running, and the Mac's icon style is Default in light mode
- **THEN** the Dock and Finder show the light icon (near-black tile, klinkkeri brick with a white `>_`)

#### Scenario: Appearance icon check
- **WHEN** the icon check runs on macOS
- **THEN** it passes only if `Assets.car` holds the app icon in both the light and the dark appearance

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

### Requirement: Version of a local install
`npm run install-app` SHALL build the app with the version from git: the tag's version on a `vX.Y.Z` tag, `<next patch>-dev.<commits since the tag>+<commit>` past the last tag, and `src-tauri/Cargo.toml`'s version when there is no tag. It SHALL leave `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` as they were.

#### Scenario: Unreleased build
- **WHEN** `npm run install-app` runs on a commit 145 commits past the tag `v0.3.0`
- **THEN** the installed app reports version `0.3.1-dev.145+<commit>` and the working tree is unchanged afterwards

#### Scenario: Release build
- **WHEN** it runs on the commit tagged `v0.3.0`
- **THEN** the installed app reports version `0.3.0`

### Requirement: Release command
The project SHALL provide `npm run release <patch|minor|major|x.y.z>`. It SHALL refuse an unknown argument. It SHALL take the version from the highest `vX.Y.Z` tag on GitHub bumped by the argument, tag origin/main's commit `v<version>` without making a commit, push only the tag, follow the release workflow and publish the draft once the workflow succeeds. An unpublished earlier release SHALL be finished first.

#### Scenario: Minor release
- **WHEN** the highest tag on GitHub is `v0.1.3`, it is published, and `npm run release minor` runs
- **THEN** the tag `v0.2.0` is pushed at origin/main's commit, no commit is made, and the release is published after its workflow succeeds

#### Scenario: Dirty tree
- **WHEN** `npm run release patch` runs with uncommitted changes in the checkout
- **THEN** it tags origin/main's commit, so the uncommitted changes are neither released nor touched

#### Scenario: Unpublished release resumed
- **WHEN** `v0.2.0` is tagged but its release is still a draft and `npm run release patch` runs
- **THEN** it finishes and publishes `v0.2.0` instead of cutting `v0.2.1`

#### Scenario: Stale local tag
- **WHEN** a local tag `v0.2.0` points at an older commit than origin/main and is not on GitHub
- **THEN** the tag is moved to origin/main's commit before it is pushed

### Requirement: Release build on tag
Pushing a tag `v<version>` SHALL build the installers on macOS, Windows and Linux with the version stamped from the tag, and attach them to a draft GitHub Release for that tag. A tag that is not `vX.Y.Z` SHALL fail the build. Signing variables SHALL be passed only from secrets that are set, and only after dependencies are installed, so the release is unsigned when none are.

#### Scenario: Tag pushed
- **WHEN** the tag `v0.2.0` is pushed
- **THEN** a draft release `v0.2.0` holds the Apple Silicon `.dmg`, the setup `.exe`, the `.AppImage` and the `.deb`, all reporting version `0.2.0`

#### Scenario: Tag and version disagree
- **WHEN** the tag `v0.3.0` is pushed and the repository's version files hold another version
- **THEN** the build stamps `0.3.0` from the tag into them before bundling and the installers report `0.3.0`

#### Scenario: Tag is not a version
- **WHEN** the tag `v0.3` is pushed
- **THEN** the release build fails before bundling

### Requirement: Updater artifacts on release
The release build SHALL sign the updater bundles (macOS `.app.tar.gz`, Windows NSIS setup `.exe`, Linux `.AppImage`) from the updater signing secrets and, after every platform's bundle job, upload a `latest.json` to the draft release with the tag's version, the notes, `pub_date` and a url and signature for `darwin-aarch64`, `windows-x86_64` and `linux-x86_64`.

#### Scenario: Secrets set
- **WHEN** the tag `v0.3.0` is pushed with the signing secrets set
- **THEN** the draft release holds the installers, the signed updater bundles and a `latest.json` for version `0.3.0`

### Requirement: Bundling without the updater key
Without the updater signing key, the release build and local `npm run bundle` SHALL still build the installers, leaving out the updater artifacts; the release build SHALL skip `latest.json` with a warning.

#### Scenario: Secrets missing
- **WHEN** the tag is pushed without the signing secrets
- **THEN** the installers are uploaded, no `latest.json` is, and the run shows a warning

#### Scenario: Local bundle without the key
- **WHEN** `npm run bundle` runs without `TAURI_SIGNING_PRIVATE_KEY`
- **THEN** the installers are produced and the build succeeds
