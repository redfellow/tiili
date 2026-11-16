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

### Requirement: Working app icon
While any pane is working, the running app icon SHALL show the "Hot cursor" working frames of its light or dark variant, swapping frames about every 333 ms. A pane is working while its foreground program is not its shell and it has printed output in the last 3 seconds. When the OS asks for reduced motion the icon SHALL hold frame 0. When no pane is working it SHALL show the normal icon and stop the frame timer.

#### Scenario: Script running
- **WHEN** a pane runs a script that keeps printing output
- **THEN** the app icon cycles the 8 working frames of the current variant

#### Scenario: Quiet foreground program
- **WHEN** a pane's foreground program is vim, or an agent waiting for an answer, and it has printed nothing for 3 seconds
- **THEN** the pane does not count as working and, with no other pane working, the normal icon shows

#### Scenario: Reduced motion
- **WHEN** a pane is working and the OS reduce-motion preference is on
- **THEN** the app icon shows working frame 0 and does not change frames

#### Scenario: Attention while working
- **WHEN** a pane is working and another pane marks attention while tiili is in the background
- **THEN** the badge and the bounce or flash appear as before and stay while the frames change

### Requirement: Working icon frames
The icon pipeline SHALL render 8 working frames for each of the light and dark icons from the brand SVGs, at the size of the run-time icons, using only the koivu and kalkki brand tokens for the cursor and its bloom.

#### Scenario: Frame set check
- **WHEN** the icon check runs
- **THEN** it passes only if `app-light-working-0.png` to `-7.png` and `app-dark-working-0.png` to `-7.png` exist at 512 px

### Requirement: Running macOS icon matches the Dock grid
On macOS, every icon tiili sets at run time (light, dark and working frames) SHALL be drawn with the tile inset to Apple's app icon grid: 824/1024 of the canvas, centred, on a transparent margin. That way the running icon is the same size as other apps' icons in the Dock. On other platforms the run-time icon SHALL stay full-bleed.

#### Scenario: Running icon size in the Dock
- **WHEN** tiili is running on macOS and shows its normal or working icon
- **THEN** its tile in the Dock is the same size as the neighbouring app icons

#### Scenario: Inset geometry
- **WHEN** the inset rectangle is computed for a canvas of 1024 px
- **THEN** it is 824 px square at offset 100 px on both axes

### Requirement: Idle running macOS icon is the bundle icon
On macOS, when the Dock icon choice follows the system and no pane is working, the running app SHALL show the bundle's asset catalog icon rather than a run-time PNG, so the Dock draws it with the system's Liquid Glass effects. A pinned light or dark choice and the working frames SHALL still use the run-time PNGs. A run without an asset catalog icon (such as `tauri dev`) SHALL show the run-time PNG instead.

#### Scenario: Idle icon keeps the system rim
- **WHEN** tiili runs from its app bundle on macOS with the Dock icon following the system and no pane working
- **THEN** the Dock shows the asset catalog icon with the same rim highlight as before launch

#### Scenario: Working after idle
- **WHEN** a pane starts working and then stops
- **THEN** the Dock shows the working frames, then the asset catalog icon again

### Requirement: Asset catalog in step with the icon bundle
Compiling the macOS app icon SHALL record a fingerprint of the Icon Composer bundle it compiled beside `Assets.car`. The icon check SHALL fail when the fingerprint is missing or differs from the committed bundle, so that the icon macOS shows at launch and while tiili is closed is always the current design.

#### Scenario: Bundle changed without recompiling
- **WHEN** `AppIcon.icon` changes and `Assets.car` is not recompiled
- **THEN** the icon check fails and names the stale `Assets.car`

#### Scenario: Recompiled asset catalog
- **WHEN** `Assets.car` is compiled from the committed `AppIcon.icon`
- **THEN** the icon check passes

#### Scenario: Launching shows the current icon
- **WHEN** tiili is installed with `npm run install-app` and launched
- **THEN** the Dock shows the current light or dark icon from the first moment, with no older design before the run-time icon appears

### Requirement: Compact release build
Release builds SHALL use link-time optimisation, a single codegen unit, stripped symbols and abort on panic, so that the binaries carry no debug symbols or unwinding tables. The macOS `.dmg` that `npm run bundle` produces SHALL be compressed with lzma (ULMO). When a signing identity is set, the `.dmg` SHALL be signed after it is converted.

#### Scenario: DMG converted after the build
- **WHEN** `npm run bundle` finishes the Tauri build on macOS
- **THEN** the `.dmg` is converted to ULMO in place, and re-signed if `APPLE_SIGNING_IDENTITY` is set

#### Scenario: Unsigned local bundle
- **WHEN** `npm run bundle` runs on macOS without `APPLE_SIGNING_IDENTITY`
- **THEN** the `.dmg` is converted and left unsigned
