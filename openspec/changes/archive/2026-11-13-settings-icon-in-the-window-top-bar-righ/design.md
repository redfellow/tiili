## Approach

- `src-tauri/tauri.conf.json`: main window gets `"titleBarStyle": "Overlay"` and `"hiddenTitle": true` (macOS-only options; ignored elsewhere). Capability adds `core:window:allow-start-dragging` so `data-tauri-drag-region` works.
- `index.html`/`src/topBar.ts`: a `<header class="top-bar" data-tauri-drag-region>` above the panes root. `createTopBar({ platform, onNewPane, onClosePane, onResetLayout, onSettings })` renders the buttons with tooltips built from the platform's shortcut labels. On macOS the bar gets a left inset for the traffic lights and the native title-bar height (28 px); on Windows/Linux and the browser preview it is a slim strip.
- `main.ts` wires the callbacks to existing `Panes.act({type:"new"})`, `Panes.act({type:"close"})`, `Panes.actLayout("reset")` and `dialog.open()`, so buttons and shortcuts share one code path, then refocuses the current pane.
- `styles.css`: body becomes a column flex; the panes root takes the remaining height, so the existing ResizeObserver-driven PTY sizing keeps working unchanged.

## Why

Overlay keeps native window controls and behaviour on macOS (chosen by Reijo) while giving us room for buttons; a fully custom frameless window on all platforms was rejected as more risk. Reusing the existing actions avoids duplicate behaviour.
