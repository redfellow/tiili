# Tasks

- [ ] 1.1 Make the macOS overlay top bar 38px tall and keep the title centred (`.top-bar[data-overlay]` and `.top-bar-title` in src/styles.css)
  - proof: `grep -nE "height: 38px" src/styles.css`
- [ ] 1.2 Centre the macOS window buttons in the bar with `trafficLightPosition` on the main window in src-tauri/tauri.conf.json, and line up the bar's left padding with it
  - proof: `grep -n "trafficLightPosition" src-tauri/tauri.conf.json`
  - proof: `node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8'))"`

## Manual checks after merge (The user)
- On macOS, the top bar is noticeably taller, and the window buttons, title and right-hand buttons all sit vertically centred.
- On macOS, dragging the bar still moves the window, and the panes start right below the bar.
