## 1. Window

- [x] 1.1 Set the main window to `titleBarStyle: "Overlay"` and `hiddenTitle: true` in `src-tauri/tauri.conf.json`, and add `core:window:allow-start-dragging` to `src-tauri/capabilities/default.json`
  - proof: `node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8'));JSON.parse(require('fs').readFileSync('src-tauri/capabilities/default.json','utf8'))"`

## 2. Top bar

- [x] 2.1 Add `src/topBar.ts` rendering the drag-region header with New pane, Close pane, Reset layout and Settings icon buttons, tooltips naming each with the platform's shortcut, and a macOS inset for the traffic lights
  - proof: `npx eslint src/topBar.ts`
- [x] 2.2 Mount the bar in `index.html`/`src/main.ts`, wiring buttons to `Panes.act`, `Panes.actLayout("reset")` and the settings dialogue and refocusing the current pane; lay out `src/styles.css` so the panes root fills the space below the bar
  - proof: `npx eslint src/main.ts src/topBar.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate settings-icon-in-the-window-top-bar-righ --strict`

## Manual checks after merge (The user)

- On macOS the traffic lights sit in the top bar, dragging the bar moves the window and the four buttons sit at the right.
- On Windows and Linux the bar sits below the native title bar.
- Each button does what its shortcut does, the gear opens settings, and terminals resize correctly under the bar.
