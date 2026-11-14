## Approach

- **Rust `src-tauri/src/links.rs`**: pure `classify_url(uri) -> Allow | Confirm | Deny` and `resolve_path(cwd, home, text) -> Option<Resolved{abs, is_dir, reveal_only}>`; commands `link_open(uri, confirmed)` (re-runs `classify_url`; refuses Deny and unconfirmed Confirm), `path_resolve(pane_id, candidates)` (uses the pane's tracked cwd/host from `cwd.rs`/registry; returns nothing for remote or WSL hosts), `path_open(abs)` (refuses reveal-only) and `path_reveal(abs)`, all via `tauri_plugin_opener` from Rust so the webview capability stays as is.
- **TS `src/links.ts`**: pure parser `findPathCandidates(line)` (regex for the path forms and `:l[:c]`/`(l,c)` suffixes) and `isOpenGesture(event, platform)`; `src/terminalLinks.ts` wires per terminal: `WebLinksAddon` and `linkHandler` both route to `backend.openLink`; a `registerLinkProvider` for paths that calls `path_resolve` for the hovered line only, debounced, cached per pane by cwd+text (cleared on `pane-cwd` change). Each provider's `hover/leave` updates a per-pane `hoveredLink` and a hint element inside the pane.
- **Mouse-reporting TUIs**: xterm only activates links when the mouse is not tracked; a capture-phase `mousedown` on the pane checks the gesture with `hoveredLink` set, opens it and stops propagation so the click never reaches the app.
- **Confirm dialog**: small HTML dialog styled from brand tokens, showing scheme and URI.
- **Menus**: `attachClipboardMenus` gains a `linkItems()` hook that returns items for the hovered link, prepended before Copy/Paste.
- **Backend**: `Backend` gains `openLink`, `resolvePaths`, `openPath`, `revealPath`; the WS dev backend stubs them (no paths, opens URLs with `window.open` in a new tab only for http/https).
- Heynote panes get none of this.
