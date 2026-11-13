## Context
tiili's panes each hold an xterm.js terminal. Heynote's web build is a single-page Vue app that talks to the outside world only through `window.heynote`, which its `webapp/bridge.js` provides over localStorage.

## Decisions
- **Same-origin iframe.** Heynote is served from tiili's own origin (`heynote/index.html` in `public/`), so it reaches tiili's note store as `window.parent.tiiliHeynote`. tiili, in turn, can reach the page's window to add a capturing keydown listener and to call `tiiliFlush`. Alternative: mounting Heynote's Vue app directly in tiili's document. Rejected: Heynote's global styles and keymaps would leak into the terminals.
- **Bridge swapped at build time.** `scripts/heynote.mjs` copies `heynote/bridge.js` over Heynote's bridge, builds with `vite build webapp --base ./ --target es2022`, and restores Heynote's files. The bridge loads the whole library with top-level await. The page's start script imports `main.js` only after the bridge has resolved, so Heynote starts with its notes in place.
- **Load once, write through.** The page holds the notes in memory and writes each change to tiili's store. That store is Tauri commands in the app and localStorage in the browser dev server. Writes go to a temporary file that is then renamed over the note. Paths may only be plain relative paths inside the notes folder.
- **One Heynote pane.** Pressing the button again focuses the open one (see the Assumptions in proposal.md).
- **Keys and clipboard.** A capturing keydown listener in the page runs tiili's pane, layout and settings shortcuts first. On macOS, tiili's Edit menu items are custom, so they send events to tiili instead of the page. When the focused pane is Heynote, those events act on the page instead of a terminal: Copy writes the page's selection, Paste inserts the text with `insertText`, and Select All uses `selectAll`. tiili handles ⌘X itself, because the menu has no Cut item. On Windows and Linux the page handles the clipboard keys natively.
- **Flush on close.** Closing the pane first calls `tiiliFlush`, which saves all open notes the way Heynote does when its window closes. Heynote also autosaves every 2 seconds.

## Risks
- Edits made in the last 2 seconds before the whole window quits may be lost, if the WebView does not fire `beforeunload` in the frame.
- `execCommand` is deprecated, but every WebView tiili runs on still supports it.
- Heynote updates mean running `npm run heynote` again; the script stops if Heynote's `webapp/index.html` no longer matches.
