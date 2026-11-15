# Session restore

## Why
Quitting tiili loses everything but the main window's rect: extra windows, panes, layout, folders and scrollback all start fresh. The user wants tiili to reopen as it was.

## What Changes
- On launch, reopen every window open when the app ended (Cmd+Q, or closing the last window), each with its size, place, maximised/fullscreen state, tiling mode, pane order, column/row sizes, focused pane and, per pane, kind (shell or Heynote), folder, font zoom and `tiili open --title` chip title.
- Restore each shell pane's normal-buffer scrollback above a dim `restored from last session` divider (on by default; new setting to turn it off).
- Never re-run programs: a dim reminder line (`— was running: npm run dev —`, `— was connected to devbox —`), and the command is put at the top of that shell's history so Up then Enter re-runs it.
- tiili's zsh/bash/PowerShell integration reports each command line just before it runs; other shells fall back to the foreground program name for the reminder only.
- Missing folder: nearest existing parent, else home, with a dim note.
- State in `session.json` (versioned, `windows[] -> tabs[]`) plus one scrollback file per pane in the app data folder, user-only (0600). Layout written debounced on change; scrollback and commands written at app end.
- window-state: every restored window keeps its own rect; tiili's session state replaces tauri-plugin-window-state.

## Outcome
- Restored pane with scrollback
  - After: `restored from last session` divider under the old output
- Pane that was running a program
  - After: `— was running: npm run dev —`
- Pane that had ssh'd
  - After: `— was connected to devbox —`
- Folder gone
  - After: `— folder ~/old/proj no longer exists; opened ~/old —`
- Settings, Behaviour tab
  - After: `Restore scrollback and commands` checkbox, on

## Assumptions
- tiili's own session file takes over window rects and the window-state plugin is removed; its old `.window-state.json` main-window rect is read once as a fallback when no session exists. Ruled out keeping the plugin beside the session (two sources of truth).
- Pane ids are re-issued on restore; saved ids only key scrollback files. Ruled out keeping old ids.
- An unreadable or newer-version session.json is ignored (fresh window) and left on disk untouched. Ruled out deleting it.
- Scrollback saved is capped at the pane's scrollback setting. Ruled out unbounded saving.
- History injection: zsh `print -s`, bash `history -s`, PowerShell `[Microsoft.PowerShell.PSConsoleReadLine]::AddToHistory`, run by the integration script at the first prompt from an env var/file tiili passes; not added to the user's history file beyond what the shell itself does.
- Exact wording of the folder note and setting label is as in Outcome.
