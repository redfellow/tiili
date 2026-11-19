# Self-update replaces the existing tiili app in the macOS dock

## Why

After Install now, the updated tiili shows up as a second app in the macOS Dock instead of taking the place of the running one. `src/updates.ts` calls `relaunch()` from plugin-process. That calls tauri 2.12.5's `restart`, which runs `/usr/bin/open -n <bundle>` while the old process is still alive. `-n` forces a new instance, so LaunchServices starts a second tiili beside the old one, and the old one then has to finish exiting, including the session save that `session_app::exit_requested` may hold up. The updater also swaps bundles with `renamex_np`, which moves the old bundle's file identity into a temp folder. That may make a pinned Dock tile follow the old copy.

## What Changes

- A new Rust command, `relaunch_after_update`, replaces `relaunch()` in the update install path. On macOS it starts a small detached helper (`/bin/sh -c`), which waits until this tiili's PID has exited and then runs `/usr/bin/open <bundle path>` (no `-n`). The app then exits through the normal path (`app.exit(0)`), so the session is saved and the single-instance lock is released before the new tiili starts. Only one tiili is ever running, so the Dock shows one icon at the bundle's path. Other platforms keep calling `app.restart()`.
- The bundle path and the helper's shell command are built by a pure function in `src-tauri/src/updates.rs` and unit tested there. The path is quoted for the shell, and the function returns nothing when the binary is not inside a `.app`.

## Acceptance

- After an in-app update on macOS, exactly one tiili icon is in the Dock, in the place of the earlier one (pinned or not).
- The session (windows and panes) is restored after the update, as before.

## Citations

- openspec/specs/app-updates/spec.md: Requirement: Install update prompt ("Install now SHALL … restart tiili")
- src/updates.ts:181 (`await relaunch()`)
- tauri-2.12.5 src/process.rs `restart_macos_app` (`open -n` while still alive)

## Assumptions

- Waiting for the PID in a shell helper, not a Rust helper binary (simpler; same result).
- Nothing changes on Windows and Linux (the alternative would be to change all platforms).
- The pinned tile following the swapped-out bundle is left to the manual check. If the Dock still shows the old bundle, a follow-up card handles it.
