# Design

## Store (Rust, `src-tauri/src/session.rs`)
- `Session { version: 1, windows: [{ rect, maximized, fullscreen, tabs: [{ layout, panes[], focused, zenPane?, name? }], activeTab }] }`; pane `{ id, kind, cwd, host?, zoom, title?, command?, program? }`.
- Pure functions: `parse(bytes) -> Option<Session>` (unknown/newer version → None), `write_atomic(dir, session)` (temp + rename, 0600 on unix; Windows relies on the per-user app data ACL), `nearest_existing(path)`, `plan_restore(session, monitors)` applying `window_state::is_on_screen` per window.
- Commands: `session_update(windowLabel, tabState)` (frontend, debounced 500 ms), `session_load()`; scrollback via `session_save_scrollback(paneId, text)` only when the setting is on.
- Lifecycle: a window closed while others stay is removed from the session. On app end (RunEvent::ExitRequested / last window close) the frontend is asked to flush scrollback and commands, with a short timeout, then the file is written. A window whose last pane exited is dropped.
- The window-state plugin is removed; `read_saved` stays only to migrate the old main-window rect once.

## Commands from the shell
- Integration scripts gain a preexec hook (zsh `add-zsh-hook preexec`, bash DEBUG trap guarded like bash-preexec, PowerShell PSReadLine `AddToHistoryHandler`) emitting `OSC 633;E;<escaped cmd>` style private sequence `ESC ] 1337;TiiliCmd=<base64> BEL`; parsed in the PTY sink, cleared at the next prompt mark. Kept in memory per pane; saved at app end.
- On restore tiili sets `TIILI_RESTORE_HISTORY=<file>`; the scripts add its line to the shell's history at startup and delete the file.
- Fallback: `command.rs` foreground program name → `program` (reminder only).

## Frontend
- `src/session.ts`: pure `snapshotWindow(panes, layout)` and `restorePlan(saved)` (folder notes, reminder lines); `Panes` calls update on every layout/pane/cwd change.
- Restore writes the saved scrollback into the new terminal, then the divider and reminder in dim SGR, before the shell starts printing.
- Heynote panes reopen as Heynote panes (notes already on disk).
