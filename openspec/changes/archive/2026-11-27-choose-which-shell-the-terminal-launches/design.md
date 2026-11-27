## Approach

**Setting.** `Settings.shell: string`, `""` for System default; `normalize` turns anything that is not a string
into `""` and trims it. The frontend passes `settings().shell` to `backend.spawn` as a trailing optional argument
(so existing positional calls stay valid); `pty_spawn` takes `shell: Option<String>`, empty meaning none.

**Installed shells.** A new `src-tauri/src/shells.rs` holds:
- `parse_etc_shells(text) -> Vec<String>`: absolute paths from `/etc/shells`, comments and blanks skipped, in file
  order, duplicates (also via symlinked `/bin` → `/usr/bin` on merged-usr systems, compared after canonicalising)
  dropped; `installed()` keeps only files that exist. On Windows `installed()` lists
  `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`, `pwsh.exe` found on `PATH`, and `%COMSPEC%`.
- `resolve(chosen: Option<&str>) -> Option<PathBuf>`: the chosen path when it is an executable file, else `None`
  (system default).
- A Tauri command `shells_installed` returning `{ default: <program name of the system default>, shells: [...] }`
  for the dialogue; `Backend.installedShells()` wraps it, and the ws backend returns the default only.

**Starting the shell.** `shell_integration::shell_command(prompt, shell, dir)` gets the resolved shell. On Unix it
keeps `CommandBuilder::new_default_prog()` and sets `SHELL` on the builder to the resolved path: portable-pty's
`get_shell` reads `SHELL` from the builder's own env and starts it as a login shell (`-name` argv0), so the chosen
shell starts exactly as the default does, and every shell gets `SHELL` naming what it runs (with System default,
the shell `get_shell` picked). On Windows the chosen program is started with `CommandBuilder::new(path)`. Either
way `command_for(&shell, …)` still applies the zsh/bash/PowerShell integration to the resolved shell.
`pane_command`, `spawn_restored`/`spawn_tracked` and `PtySession::spawn_in` take the choice through, and the
`CommandTracker` is named after the resolved shell instead of `command::shell_name()`.

**Dialogue.** A `Shell` section first on the Behaviour tab: a `<select>` filled from `installedShells()`, with
`System default (<name>)`, the shell paths, and `Other…`; `Other…` (or a saved path not in the list) shows a text
field holding the path. It saves with the other settings; it has no live preview since open panes keep their shell.

## Why

Reusing portable-pty's own default-shell path keeps login-shell start-up identical for chosen and default shells
without guessing each shell's `--login` flag, and doubles as the `SHELL` variable the user asked for.
