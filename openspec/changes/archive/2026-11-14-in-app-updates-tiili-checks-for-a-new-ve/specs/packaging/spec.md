## ADDED Requirements

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
