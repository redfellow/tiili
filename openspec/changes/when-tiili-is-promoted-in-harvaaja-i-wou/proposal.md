## Why
Reijo wants to try each tiili release as a real Mac app from the Dock, without building it himself on the command line. härvääjä has no step that runs after a promotion yet. That has been asked of härvääjä as a separate idea. This change adds the part that lives in tiili: one command that builds the app and installs it.

## What Changes
- Add `scripts/install-app.mjs`, run as `npm run install-app` (macOS only). It builds `tiili.app` for this Mac's chip (`tauri build --bundles app`, no .dmg and no universal binary), replaces `/Applications/tiili.app` with it, and adds tiili to the Dock if it isn't there yet.
- docs/packaging.md gets a section on the command.

## Outcome
- Installing
  - After: `npm run install-app` puts tiili in /Applications and pins it to the Dock

## Assumptions
- Dock pinning edits the `com.apple.dock` `persistent-apps` defaults and restarts the Dock with `killall Dock`, only when tiili isn't already pinned. This rules out depending on a third-party tool such as dockutil.
- tiili is quit first if it is running (`osascript` quit), so the copy can replace the app. The alternative was refusing to install while it runs.
- On other platforms the command exits with a clear message.
- Automatic running after promotion is out of scope here. It waits on the härvääjä hook.
