## Why

tiili can open several full windows (the multi-window foundation, `pane-tiling` "New window"), but a pane is stuck in the
window it was opened in. Moving a running pane to another window, or out into a new one, lets the user regroup work
without restarting shells or losing scrollback. `docs/concept.md` still lists popping a pane out as out of scope.

## What Changes

- The pane's right-click menu and the macOS Shell menu gain **Move to New Window** (⌃⌘N on macOS, Ctrl+Alt+Shift+N on
  Windows and Linux) and **Move to Window ▸**, a submenu of the other open windows (no shortcut). The submenu names each
  window by its focused pane's chip text (repository or folder, or `Heynote`), with ` (2)`, ` (3)`… added when two
  entries would read the same. It is absent or disabled when no other window is open.
- A moved terminal pane keeps its running shell, scrollback, folder, tint and chip; full-screen programs (vim, htop,
  coding agents) redraw in the new window. Output the shell writes during the move is kept and shown, not lost.
- A Heynote pane moves too: it saves its notes and reopens in the target window.
- The target window comes to the front and the moved pane is focused there, last in its grid.
- Moving the last pane out of a window closes that window without ending the moved shell. Move to New Window on a
  window's only pane does nothing.
- Rust: each session's output goes through a swappable sink that buffers during a handoff; new `pty_detach` /
  `pty_attach(id, channel)` commands; the session's `pane-cwd`, `pane-command` and `pty-exit` events and its window
  ownership follow it to the new window; windows report their menu name to the core.
- Frontend: `@xterm/addon-serialize` is added; `PaneTerminal` gains a detach that keeps the shell running.
- `docs/concept.md`: "Popping a pane out into its own window" leaves the out-of-scope list.
- Not in this change: dragging a pane out of a window.

## Outcome

- Right-click menu of a pane
  - After: `Move to New Window` and `Move to Window ▸` items, the submenu listing e.g. `tiili`, `härvääjä`, `tiili (2)`
- macOS Shell menu
  - After: `Move to New Window  ⌃⌘N` and `Move to Window ▸` under New Window
- docs/concept.md out-of-scope list
  - Now: `Popping a pane out into its own window.`

## Assumptions

- The dev browser backend (single page, no windows) leaves both move items out of its menu; ruled out: faking a move there.
- The submenu numbers duplicates in window-open order; ruled out: adding the window label or pane count.
- A pane's zoom offset moves with it; ruled out: resetting zoom on move.
- Moving a pane that is still starting (no session yet) does nothing; ruled out: queueing the move.
- No top-bar button for moving; ruled out: adding one (the card names only the two menus).
