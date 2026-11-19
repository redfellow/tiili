# Tasks

- [x] 1.1 Add a pure `macos_relaunch_command(current_exe: &Path, pid: u32) -> Option<String>` to `src-tauri/src/updates.rs`. It finds the `.app` root from `…/Contents/MacOS/<bin>`, and its command waits until the PID has exited (`while kill -0 PID; do sleep 0.2; done`) and then runs `/usr/bin/open '<bundle>'`, with single quotes escaped. Add a table-driven unit test: a normal bundle, a path with spaces and `'`, and a binary outside a bundle (None).
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib updates`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
- [x] 1.2 Add the `relaunch_after_update` Tauri command and register it. On macOS it spawns `/bin/sh -c <command>` detached (stdio null), then calls `app.exit(0)`. Elsewhere, or when there is no command, it calls `app.restart()`. In `src/updates.ts`, replace `relaunch()` with `invoke("relaunch_after_update")`, and drop the import if nothing else uses it.
  - Tests to update: none pin the `relaunch` call; check with `grep -rn relaunch src`.
  - proof: `npx eslint src/updates.ts`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- On macOS, with tiili pinned in the Dock, install an update from the dialog: one tiili icon remains, at the pinned spot, and the windows come back.
- Do the same with tiili not pinned: no second tiili icon appears.
