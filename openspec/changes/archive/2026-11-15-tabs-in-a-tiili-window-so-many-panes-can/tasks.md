## 1. Pure model and keys
- [x] 1.1 `src/tabs.ts` pure helpers (label, wrap next/previous, reorder, insert beside, cross-tab list order, tab of session, badge count) with table-driven `src/tabs.test.ts` (`// @harvaaja-test-tier: fast`)
  - proof: `npx vitest run src/tabs.test.ts`
- [x] 1.2 `TabAction` / `tabAction` in src/keymap.ts (new tab, next/previous, move pane next/previous, per platform) with table rows in src/keymap.test.ts; check paneAction/layoutAction no longer clash
  Tests to update: src/keymap.test.ts
  - proof: `npx vitest run src/keymap.test.ts`

## 2. Window and tabs
- [x] 2.1 Split src/panes.ts into a window part and `Tab` (src/tab.ts) with its own LayoutState, TileView, container and focus; hide/show with holdSize/releaseSize; tab lifecycle; ⌘1–9 in shown tab; shortcuts swallowed; window name/title from shown tab; order reported tab by tab
  Tests to update: src/windowMenu.test.ts
  - proof: `npx eslint src/panes.ts src/tab.ts`
  - proof: `npx vitest run src/layout/model.test.ts src/windowTitle.test.ts src/windowMenu.test.ts`
- [x] 2.2 Tab strip in src/topBar.ts and src/styles.css: hidden with one tab, labels in tint, attention brick and count, click to show, drag reorder, pane grab strip drop onto a tab, right-click menu (inline Rename, Pop Out, Close Tab with confirm); Move to Tab ▸ in the pane menu
  - proof: `npx eslint src/topBar.ts src/panes.ts`
- [x] 2.3 Attention: `focusSession` shows the holding tab; marks per tab feed the badge; `tiili open` adds to caller's tab without showing it
  - proof: `npx vitest run src/attention.test.ts`
  - proof: `npx eslint src/panes.ts src/attention.ts`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test control_server`

## 3. Pop Out and menus
- [x] 3.1 Pop Out: `MovePayload` tab variant in src/backend.ts (and ws backend), sending all sessions and layout under one token; arrive builds the tab in the new window; only-tab no-op; update src-tauri/src/windows.rs if it inspects the payload
  Tests to update: src/backend.test.ts
  - proof: `npx vitest run src/backend.test.ts src/backend-ws.test.ts`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --test window_state`
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib windows::tests`
- [x] 3.2 macOS Shell menu items New Tab, Next Tab, Previous Tab, Move Pane to Next/Previous Tab in macos_menu() (src-tauri/src/lib.rs), emitted through the "pane" event and handled in viaMenu()
  - proof: `grep -nE "New Tab|Next Tab|Previous Tab" src-tauri/src/lib.rs`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Create, switch, rename, reorder and close tabs; strip hides again at one tab.
- A hidden tab's shell keeps running; on showing, `stty size` matches the pane.
- ⌘J switches to the tab of a marked pane; background tab shows brick and count.
- Move to Tab ▸, drag onto a tab and the move-pane keys; Move to Window lands in the shown tab.
- Pop Out a three-pane tab keeps layout and scrollback; Pop Out on the only tab does nothing.
- `tiili open` from a hidden tab stays there; `tiili list` lists tab by tab.
- On GNOME, KDE, Ubuntu and Windows the new tab keys reach tiili and do not trigger system actions.
