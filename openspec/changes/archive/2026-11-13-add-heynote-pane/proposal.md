## Why
Reijo wants a scratchpad next to his terminals without switching apps. Heynote (https://github.com/heyman/heynote) is the one he uses. It is an Electron app, so it can't run inside tiili as it is. But it also has a web build: the same Vue and CodeMirror editor, with a small bridge (`webapp/bridge.js`) in place of Electron. This change is an experiment to see whether that build works well as a tiili pane before asking Heynote's author about it.

## What Changes
- A Heynote button in the top bar, right after New pane, opens a Heynote pane, or focuses it when one is already open. It tiles, resizes, swaps and closes like any other pane.
- `public/heynote/` holds Heynote's web build, made by `npm run heynote` from a pinned Heynote commit. Heynote's LICENSE ships alongside it.
- `heynote/bridge.js`, derived from Heynote's web bridge, keeps notes in tiili's files instead of the browser's localStorage. The files are `heynote/notes/**` and `heynote/state.json` in the app config folder, written by new Tauri commands (`src-tauri/src/notes.rs`).
- tiili's pane, layout and settings shortcuts work while Heynote has the keyboard. On macOS, the Edit menu's Copy, Paste and Select All, plus ⌘X, act on Heynote.

## Outcome
- Scratchpad
  - Before: Heynote runs as a separate Electron app
  - After: Heynote opens in a tiili pane, with notes saved as files

## Assumptions
- Licence: Heynote is MIT with the Commons Clause, which takes away only the right to sell it. tiili is free and MIT, so bundling it with its LICENSE notice is allowed. If tiili is ever sold, the Heynote pane must be removed first, or Heynote's author must agree. Reijo will still ask the author before this ships in a release.
- One Heynote pane at most: each Heynote page keeps its own copy of the notes, so two open pages would overwrite each other's edits.
- The built Heynote is committed (about 8 MB), so tiili's build and checks need neither the network nor Heynote's dependencies. It loads only when a Heynote pane opens.
- The global hotkey, the tray, ripgrep search and watching the notes folder for outside edits stay Electron-only. Search uses the web build's JavaScript search.
- Heynote's currency conversion still fetches rates from Heynote's server, as the web app does.
- Out of scope: following tiili's theme (Heynote keeps its own light and dark setting), a keyboard shortcut for the button, and more than one Heynote pane.
