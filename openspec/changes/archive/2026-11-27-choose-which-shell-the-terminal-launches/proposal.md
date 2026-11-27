## Why

tiili always starts the shell the system names as the user's default (`$SHELL`, `%COMSPEC%` on Windows). On CachyOS
fish is that default, and a user who wants zsh in tiili has no way to get it, although other terminals (Konsole and
the like) let them pick the shell they launch. tiili needs its own shell choice, independent of the system default.

## What Changes

- A new **Shell** section on the Behaviour tab of Settings: a menu with `System default (<name>)` first, then the
  shells installed on this machine (from `/etc/shells` on macOS and Linux; Windows PowerShell, PowerShell 7 when it
  is on `PATH`, and Command Prompt on Windows), then `Other…`, which shows a field for a shell's path.
- The choice is saved with the settings (`shell`, empty meaning the system default) and applies to panes opened
  after Save, including panes reopened by session restore and panes opened with `tiili open`. Open panes keep the
  shell they run.
- A chosen shell starts the way the default one does (a login shell on macOS and Linux) and still gets tiili's
  prompt integration when it is zsh, bash or PowerShell.
- On macOS and Linux, every shell tiili starts gets `SHELL` set to the shell it runs, so programs started from it
  (tmux, an editor's `:shell`, coding agents) use the chosen shell too.
- A chosen shell that is missing or not executable falls back to the system default shell, so a pane always opens.

## Outcome

- Behaviour tab, new Shell section
  - After: `Shell` heading with a menu reading `System default (fish)`, `/bin/bash`, `/bin/zsh`, `/usr/bin/fish`, …,
    `Other…`, and the hint `Applies to new panes.`
- Choosing a path by hand
  - After: choosing `Other…` shows a path field, e.g. `/opt/homebrew/bin/nu`
- In a new pane after choosing zsh on a fish system
  - Now: `echo $SHELL` shows `/usr/bin/fish` and the pane runs fish
  - After: `echo $SHELL` shows `/usr/bin/zsh` and the pane runs zsh

## Capabilities

### Modified Capabilities

- `terminal-session`: the pane's shell is the chosen one, the system default unless changed; `SHELL` follows it.
- `settings`: the Shell choice and its place on the Behaviour tab.

## Impact

- Rust: `src-tauri/src/shell_integration.rs`, `src-tauri/src/pty.rs`, `src-tauri/src/lib.rs`, a new
  `src-tauri/src/shells.rs` (installed shells, resolving the choice).
- Frontend: `src/settings.ts`, `src/backend.ts`, `src/backend-tauri.ts`, `src/backend-ws.ts`, `src/terminal.ts`,
  `src/settingsDialog.ts`.

## Assumptions

- The Shell section is the first section of the Behaviour tab, above Tiling, rather than a new tab or a row in Panes.
- Changing the shell applies only to panes opened afterwards; open panes are not restarted (ruled out: restarting or
  replacing open shells).
- On Windows `SHELL` is not set and `COMSPEC` is left alone; the chosen program is started directly (ruled out:
  rewriting `COMSPEC`, which programs expect to name cmd).
- A chosen shell that cannot be run silently falls back to the system default shell (ruled out: an error in the
  pane or the settings dialogue).
- The dev browser bridge keeps starting the default shell and lists only System default (ruled out: carrying the
  choice through the dev-only bridge).
- Finding the login `PATH` for coding-agent integrations keeps using the system's `$SHELL` (ruled out: reading it
  from the chosen shell).
- The shell's name in the Dock/taskbar foreground tracking follows the shell the pane really runs.
