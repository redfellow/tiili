## 1. Rust core

- [ ] 1.1 Add `src-tauri/src/shells.rs` (registered in `lib.rs`): `parse_etc_shells` (absolute paths, comments and blanks skipped, file order, duplicates dropped), `installed()` (Unix: existing files from `/etc/shells`; Windows: Windows PowerShell, `pwsh.exe` on `PATH`, `%COMSPEC%`) and `resolve(chosen)` (the path when it is an executable file, else `None` for the system default). Add one table-driven `#[test]` for `parse_etc_shells` and one for `resolve` (existing executable, missing path, a folder, empty string) in the module.
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib shells`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- [ ] 1.2 Take the choice through the spawn path: `shell_integration::shell_command(prompt, shell, dir)`, `pty::pane_command`, `SessionRegistry::spawn_tracked`/`spawn_restored` and `PtySession::spawn_in` get the chosen shell. On Unix keep `CommandBuilder::new_default_prog()` and set `SHELL` on the builder to the resolved path, or to `get_shell()`'s answer for System default (portable-pty then starts it as a login shell); on Windows start a chosen program with `CommandBuilder::new`. Run the zsh/bash/PowerShell integration on the resolved shell, and name the `CommandTracker` after the resolved shell instead of `command::shell_name()`. Update every caller, including `src-tauri/src/bin/dev-bridge.rs` (System default). In `tests/pty_registry.rs`'s `shell_sees_the_variables_and_commands_get_the_callers_path`, add cases asserting `SHELL` is the chosen executable path, and that a missing chosen path leaves the system default.
  - Tests to update: `src-tauri/tests/pty_registry.rs`, `src-tauri/tests/pty_session.rs`, `src-tauri/tests/repo_tracking.rs`, `src-tauri/src/shell_integration.rs` (unit tests)
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib shell_integration`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_registry`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test pty_session`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test repo_tracking`
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib --test pty_registry --test pty_session --test repo_tracking -- -D warnings`
- [ ] 1.3 In `src-tauri/src/lib.rs`, give `pty_spawn` a `shell: Option<String>` argument (empty or absent meaning System default) passed to `spawn_restored`, and add a `shells_installed` command returning `{ default, shells }` (the default shell's program name and `shells::installed()`), registered in the invoke handler.
  - proof: `cargo clippy --manifest-path src-tauri/Cargo.toml --lib -- -D warnings`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 2. Frontend

- [ ] 2.1 Add `shell: string` to `Settings` in `src/settings.ts` (default `""`, System default); `normalize` keeps a trimmed string and turns any other type into `""`. Add the cases to one table-driven test in `src/settings.test.ts`.
  - Tests to update: `src/settings.test.ts`
  - proof: `npx vitest run src/settings.test.ts`
  - proof: `npx eslint src/settings.ts src/settings.test.ts`
- [ ] 2.2 Give `Backend.spawn` a trailing optional `shell` argument and add `installedShells(): Promise<{ default: string; shells: string[] }>` in `src/backend.ts`; the Tauri backend passes `shell` (`null` when empty) to `pty_spawn` and invokes `shells_installed`; the ws backend ignores the shell and returns its default only. `src/terminal.ts` passes `settings().shell`. Extend the `pty_spawn` test in `src/backend.test.ts` so a chosen shell and an empty one reach `pty_spawn` as the path and `null`.
  - Tests to update: `src/backend.test.ts`, `src/backend-ws.test.ts`
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
  - proof: `npx eslint src/backend.ts src/backend-tauri.ts src/backend-ws.ts src/terminal.ts src/backend.test.ts`
- [ ] 2.3 Add the Shell section first on the Behaviour tab in `src/settingsDialog.ts`: a menu filled from `installedShells()` with `System default (<name>)`, the shell paths and `Other…`, the hint `Applies to new panes.`, and a path field shown for `Other…` or for a saved path not in the list; it saves, cancels and resets with the other settings.
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- On CachyOS with fish as the login shell, choose `/usr/bin/zsh` in Settings → Behaviour → Shell, save, open a new pane: it runs zsh, `echo $SHELL` shows `/usr/bin/zsh`, and the fish pane that was already open keeps running fish.
- Choose Other…, type a shell path, save, restart tiili: the restored panes run that shell and Settings shows Other… with the path.
- Choose Other… with a path that does not exist, save, open a pane: it runs the system default shell.
- On macOS and Windows, open the Shell menu and check it lists that machine's shells; choosing PowerShell on Windows opens PowerShell panes.
