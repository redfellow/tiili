# Proposal

## Why

tiili has one window. The user wants several full tiili windows (each with its own top bar, grid, panes and shortcuts)
as the foundation for moving panes between windows later. Today the menus broadcast to every webview with
`app.emit`, the capabilities only cover `main`, repository tints are assigned per `Panes` instance, and settings are
applied only in the window that saved them, so a second window would misbehave.

## What Changes

- New Window: ⌘N on macOS (a Shell menu item), Ctrl+Shift+N on Windows and Linux, opens a full tiili window with one
  pane, cascaded from the focused window; its pane starts in the focused pane's folder, as a new pane does.
- Menu items (Shell, Edit, Settings…) act only on the focused window (`emit_to` the focused window's label).
- Shell events (`pane-cwd`, `pane-command`, `pty-exit`) go only to the window that started the shell.
- Capabilities cover the new windows' labels (`main` and `window-*`).
- Repository tints are assigned app-wide in Rust, so a repository has the same colour in every window.
- Saving settings applies them in every open window.
- Heynote stays app-wide: at most one Heynote pane across all windows; asking for it in another window brings the
  window holding it forward and focuses that pane.
- Closing a window ends its shells and closes only that window; when the last window closes tiili quits (macOS too).
- Relaunch opens only the main window at its saved size and place; extra windows are not remembered and their
  geometry never reaches the saved window state.
- Out of scope: moving panes between windows (a separate card), restoring extra windows on relaunch.

## Outcome

- Shell menu on macOS
  - After: `New Window ⌘N` above the pane items
- A second window
  - After: a full tiili window with one pane, offset from the focused one, its pane in the focused pane's folder

## Assumptions

- ⌘N for New Window does not clash: pane focus on macOS is ⌘1–⌘9, never ⌘N with a letter. Ruled out: another chord.
- Extra windows are labelled `window-<n>` with a growing counter; ruled out reusing labels of closed windows.
- Cascade offset is 28 px right and down from the focused window, same size; ruled out a fixed screen position.
- New Window is offered only in the Tauri app; the dev browser backend ignores it. Ruled out opening browser tabs.
- terminal-session needs no delta: "the window" now reads as the pane's own window, which the pane-tiling delta
  states. Ruled out rewording each terminal-session requirement.
