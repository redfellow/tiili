# In-app updates

## Why
Installed tiili should update itself from the latest GitHub release, so users don't have to download installers by hand.

## What Changes
- Add Tauri 2's updater (`tauri-plugin-updater`, `@tauri-apps/plugin-updater`, plus `tauri-plugin-process` for the restart) with endpoint `https://github.com/redfellow/tiili/releases/latest/download/latest.json` and the owner's public key in `plugins.updater.pubkey`.
- On startup the first tiili window checks at most once a day (when automatic checks are on). A newer, not-skipped version opens an in-app "Install update?" dialog with the release notes and Install now / Later / Skip this version.
- Linux `.deb` installs get "A new version is available" with a link to the release instead of installing.
- Settings → Behaviour gets an Updates section: "Check for updates automatically" (default on) and a "Check for updates" button with an inline result.
- `bundle.createUpdaterArtifacts` on; the release workflow signs updater bundles from `TAURI_SIGNING_PRIVATE_KEY(_PASSWORD)` secrets, then a job assembles `latest.json` (via a tested script) and uploads it to the draft release; without the secrets it builds installers and skips `latest.json` with a warning.
- README, site and docs say plainly that the update check is one anonymous request to GitHub and can be turned off.

## Outcome
- Update found
  - After: `Install update?` dialog, `tiili 0.3.0 is available (you have 0.2.0).`, release notes, buttons `Install now`, `Later`, `Skip this version`
- Linux .deb
  - After: `A new version is available` with `Open release page`
- Settings Behaviour tab
  - After: section `Updates` with `Check for updates automatically` and button `Check for updates`; results `tiili is up to date.` / `Couldn't check for updates.`
- README privacy line
  - Now: `No accounts, no sync, no telemetry.`
  - After: `No accounts, no sync, no telemetry. tiili checks GitHub once a day for a new version: one anonymous request, which you can turn off in Settings.`

## Assumptions
- The daily-check time and skipped version are kept in the frontend's localStorage, not in the settings file (alternative: settings.json; they are state, not choices).
- Only the first (`main`) window does the startup check and shows the dialog (alternative: every window).
- A `.deb` install is detected as Linux without the `APPIMAGE` environment variable (alternative: querying dpkg).
- "Later" does nothing beyond closing; the next check is the next day's startup.
- Release notes are shown as plain preformatted text, not rendered Markdown (alternative: a Markdown renderer dependency).
- A manual "Check for updates" ignores a skipped version and the once-a-day limit.
