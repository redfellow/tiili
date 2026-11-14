## Why

URLs, OSC 8 hyperlinks and file paths printed in a tiili pane are dead text today: the user retypes or copies them by hand. xterm's default OSC 8 handler also uses `confirm()`/`window.open`, which a desktop webview must never do.

## What Changes

- New capability **terminal-links**:
  - Plain URLs (via `@xterm/addon-web-links`) and OSC 8 hyperlinks (via xterm's `linkHandler`, replacing the default) become links; nothing ever navigates the webview.
  - Open with ⌘-click on macOS, Ctrl-click on Windows/Linux; plain click never opens.
  - Hover underlines the link and shows a small hint inside the pane, middle-truncated; for OSC 8 it always shows the real target.
  - `http`, `https`, `mailto` open directly; other schemes only after a confirm dialog showing scheme and full URI; `javascript:`, `data:`, `blob:` and `file://` with a non-local host never open.
  - Opening goes through a Rust command `open_link` that validates the scheme and calls the opener; the webview opener capability stays limited to the release URL.
  - Path links: relative, `./`, `../`, `~/`, absolute and Windows `C:\` paths with optional `:line[:col]` or `(line,col)`. Only existing files/folders become links, resolved and stat'ed in Rust against the pane's current cwd, async and cached.
  - Files open in the OS default app (line dropped; hint says so); folders open in Finder/Explorer/Files. Executables and launcher types are reveal-only.
  - Paths in remote panes (ssh) and WSL panes stay plain text.
- Modified **clipboard**: right-click on a hovered link puts Open Link, Copy Link above Copy and Paste; on a path: Open, Reveal in Finder / Show in Explorer / Show in Folder, Copy Path (absolute).

Direction changed the idea: the three "Settle" items are now decided by the user — modifier-click on a link wins even when a TUI (Claude Code) reports the mouse; path existence is checked only for the hovered line (debounced, cached), never for streaming output; WSL `/mnt/c` paths stay plain text this round.

## Outcome

- Hovering a URL
  - After: underline and a hint `⌘-click to open` (`Ctrl-click to open` on Windows/Linux)
- Hovering an OSC 8 link whose text differs from its target
  - After: `⌘-click to open https://example.com/very/lo…/target`
- Hovering a file path
  - After: `⌘-click to open in default app (line ignored)`
- Right-click on a URL
  - Now: `Copy`, `Paste`, `Settings…`
  - After: `Open Link`, `Copy Link`, separator, `Copy`, `Paste`, `Settings…`
- Right-click on a path (macOS)
  - After: `Open`, `Reveal in Finder`, `Copy Path`, separator, `Copy`, `Paste`, `Settings…`

## Assumptions

- Hint and menu labels are as in Outcome; alternative was other wording.
- The confirm dialog for other schemes is tiili's own HTML dialog (like the update dialog), not a native one; alternative was a Tauri dialog plugin.
- Executables are offered Reveal and Copy Path, but Open is absent from their menu; alternative was a disabled Open item.
- The path cache is per pane, keyed by cwd and path, cleared when the cwd changes; alternative was a time-based expiry.
- Folders are links too (they open in the file manager), as the origin implies; alternative was files only.
