## Approach

A pure `windowTitle(command?: string): string` in `src/windowTitle.ts` returns `${command} — tiili >_` for a non-empty
trimmed command, else `tiili >_`. `Panes` (src/panes.ts) calls a `showTitle()` helper wherever the focused pane or its
command changes (markFocused, the pane-command handler, remove/move), which skips repeat values and calls
`getCurrentWindow().setTitle()` through the backend (no-op in the browser backend). The capability
`src-tauri/capabilities/default.json` gains `core:window:allow-set-title`. `tauri.conf.json` and the Rust code that
builds new windows use `tiili >_` as the starting title.

Why: the command is already tracked per pane for the chip, so no new core work is needed; the frontend owns focus.
