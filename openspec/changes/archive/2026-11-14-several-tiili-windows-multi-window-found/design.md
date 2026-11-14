# Design

## Windows (Rust, `src-tauri/src/windows.rs`)

- A `window_new(cwd: Option<String>)` command builds a `WebviewWindow` labelled `window-<n>` (atomic counter) from
  the same `index.html`, sized like the focused window and positioned 28 px down and right of it, titled `tiili`,
  with the same decorations as `tauri.conf.json`'s main window. The starting folder goes in as a URL query
  (`?cwd=`) that `main.ts` reads for its first pane.
- macOS: Shell menu gets `New Window` (⌘N, id `new-window`); its handler asks the focused window for its focused
  pane's folder by emitting `new-window` to it, and that window calls `window_new` with `pty_cwd` of its focused
  pane, the same path ⌘T takes. Windows/Linux: keymap gains `{ type: "newWindow" }` for Ctrl+Shift+N.
- Menu routing: `on_menu_event` looks up the focused webview window (`app.webview_windows()` with `is_focused`),
  falling back to the last focused label kept from `WindowEvent::Focused`, and uses `emit_to(label, …)`.
- Shell ownership: `pty_spawn` takes the calling `WebviewWindow`; its cwd/command/exit callbacks use
  `emit_to(window.label(), …)`. A `WindowSessions` map (label → session ids) is filled on spawn and emptied on
  `pty_close`; on `WindowEvent::Destroyed` the remaining sessions of that label are closed.
- Quitting: Tauri exits when the last window is destroyed; keep `RunEvent::ExitRequested` untouched so macOS quits
  as today.
- Window state: the plugin gets `.with_filter(|label| label == "main")`, so only the main window is saved and
  restored. `reset_off_screen_window` already reads only `main`.
- Capabilities: `"windows": ["main", "window-*"]`.

## App-wide tints

`TintAssigner` moves to Rust (`src-tauri/src/tints.rs`, pure logic with unit tests) as managed state behind a mutex.
Open counts are counted in Rust: the tint is attached to each session when its `pane-cwd` is emitted (the event
gains a `tint: number | null` field), and a session's count leaves when it closes. The frontend drops
`TintAssigner` and uses the event's tint. `tintKey` (remote host keys from the active remote-panes change) is
mirrored in Rust; if remote-panes lands first, the build ports its key rule as it is then.

## Settings in every window

After `settings_save` succeeds, Rust emits `settings-changed` with the saved value to every window except the
sender; `main.ts` listens and applies it like a dialogue apply (theme, font, layout, icon) and calls `dialog.adopt`.

## Heynote across windows

Managed `HeynoteOwner(Option<label>)`: `heynote_claim(label)` returns the owner label when another window holds it;
the frontend then calls `heynote_focus`, which sets that window focused and emits `heynote-focus` to it. The owner
is released when its Heynote pane closes or its window is destroyed.

## Why

Keeping ownership, tints and routing in Rust gives one source of truth across webviews; each window keeps its own
`Panes`, so per-window behaviour is unchanged.
