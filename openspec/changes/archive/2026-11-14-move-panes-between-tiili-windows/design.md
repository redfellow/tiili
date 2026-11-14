## Context

`pty_spawn` (src-tauri/src/lib.rs) captures the output `Channel` in the session's output closure and emits `pane-cwd`,
`pane-command` and `pty-exit` to the spawning window's label, fixed for the session's life. `WindowSessions`
(src-tauri/src/windows.rs) records ownership so a closing window kills its shells. Scrollback exists only in xterm.js.
`PaneTerminal.dispose()` (src/terminal.ts) always closes the session.

## Decisions

1. **Swappable output sink.** New Tauri-free module `src-tauri/src/sink.rs`: `OutputSink` holding either a target
   (`Box<dyn FnMut(&[u8]) + Send>`) or a buffer. `detach()` switches to buffering; `attach(target)` flushes the buffer
   to the new target, in order, then streams. One `Arc<Mutex<OutputSink>>` per session in a `SessionSinks` map;
   pty_spawn's output closure writes to it. Unit tests cover order, no loss and no repeat across detach/attach.
2. **Session owner label is shared state.** A `SessionOwners` map (or an `Arc<Mutex<String>>` per session) replaces the
   captured label in the cwd/command/exit closures; `WindowSessions::reassign(id, to)` moves ownership so closing the
   target window ends the shell and closing the source does not.
3. **Commands.** `pty_detach(id)` (buffer from now), `pty_attach(id, on_output)` (reassign to the calling window, swap
   sink, re-emit the latest `pane-cwd` and `pane-command` to the new window so chip and tint show at once).
   `pane_move(target: Option<String>, payload)` stores the move in a `PendingMoves` map under a token and either opens
   a window via the `window_new` path with `?move=<token>` (no `cwd`, no fresh shell) or emits `pane-arrive {token}`
   to the target window and focuses it. `pane_move_take(token)` hands the payload to the target once.
   Payload: `{ kind: "terminal", session, scrollback, zoom } | { kind: "heynote" }`.
4. **Frontend handoff.** Source: flush Heynote, or serialize the xterm buffer (`@xterm/addon-serialize`), call
   `pty_detach`, then `PaneTerminal.detach()` (frees xterm, keeps the session), remove the pane (closing the window
   via existing close-last logic only after `pane_move` returns, with the session already reassigned/pending so the
   window's destroy hook does not kill it). Target: create the pane, write scrollback, `pty_attach`, then `pty_resize`
   with the fitted size — a size change makes TUIs redraw; if the size is equal, send rows-1 then rows.
   `openTerminal` gains an "adopt session" mode instead of spawning.
5. **Window names.** Each window reports its focused pane's chip text with `window_set_name` whenever focus or the chip
   changes; `windows.rs` keeps `WindowNames` and exposes `window_list()` (other windows, open order). A pure TS
   function `menuEntries(windows)` adds ` (2)`… to duplicates (table-driven test). The macOS Shell menu's submenu is
   rebuilt in Rust on name/window changes; its items emit `move-to-window` with the label to the focused window.
6. **Shortcut.** `keymap.paneAction` adds `{ type: "moveToNewWindow" }` for ⌃⌘N (macOS) and Ctrl+Alt+Shift+N; on macOS
   the Shell menu item carries the accelerator `Ctrl+Cmd+N`.
7. **Context menu.** `MenuItem` gains a submenu variant `{ label, items }`; Tauri backend maps it to a native
   `Submenu`; the HTML menu (dev) need not render it because the dev backend omits move items.

## Risks

- Lost output between detach and attach: covered by buffering in the sink.
- Source window closing kills the moved shell: ownership is reassigned in `pane_move` before the source closes.
- Serialized scrollback of alternate-screen apps: the redraw after resize repaints the screen.
