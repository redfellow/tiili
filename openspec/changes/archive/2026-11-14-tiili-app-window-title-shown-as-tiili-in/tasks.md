## 1. Window title

- [x] 1.1 Add `src/windowTitle.ts` with `windowTitle(command?)` and a table-driven fast test `src/windowTitle.test.ts` (command, blank/whitespace, undefined)
  - proof: `npx vitest run src/windowTitle.test.ts`
  - proof: `npx eslint src/windowTitle.ts src/windowTitle.test.ts`
- [x] 1.2 Set the window title from `Panes` in `src/panes.ts` on focus, command change, close and move, via a backend `setTitle` (Tauri: `getCurrentWindow().setTitle`; browser backend: no-op); add `core:window:allow-set-title` to `src-tauri/capabilities/default.json`
  - proof: `npx eslint src/panes.ts src/backend.ts src/backend-tauri.ts src/backend-ws.ts`
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
- [x] 1.3 Use `tiili >_` as the starting title in `src-tauri/tauri.conf.json` and wherever the Rust core builds new windows
  - proof: `grep -F '"title": "tiili >_"' src-tauri/tauri.conf.json`
  - proof: `grep -F '.title("tiili >_")' src-tauri/src/windows.rs`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Open two windows running different programs; alt-tab (and Mission Control / taskbar) shows `<program> — tiili >_` for each.
- Move focus between panes and close a pane; the title follows. A Heynote pane shows `tiili >_`.
