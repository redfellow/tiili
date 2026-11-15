## 1. Model and keys
- [x] 1.1 Add the `zen.width` setting (default 140, clamp 80–400, fallback) in src/settings.ts and a row in the table-driven loader test
  - proof: `npx vitest run src/settings.test.ts`
- [x] 1.2 Add `zenAction` (⇧⌘Enter macOS, Ctrl+Shift+Enter Windows/Linux) to src/keymap.ts with table rows in keymap.test.ts
  - proof: `npx vitest run src/keymap.test.ts`
- [x] 1.3 Add a pure `zenWidthPx` clamp helper (80 cols min, 90% of area max) in src/layout/ with a table-driven test in src/layout/zen.test.ts (`// @harvaaja-test-tier: fast`)
  - proof: `npx vitest run src/layout/zen.test.ts`

## 2. View and behaviour
- [x] 2.1 Zen render path in src/layout/view.ts: hidden panes stay in the DOM, centred Zen box, two edge handles with symmetric drag (holdSize/releaseSize) saving the width, FLIP motion
  - proof: `npx eslint src/layout/view.ts`
- [x] 2.2 `Panes.zen` and the rules in src/panes.ts (follow focus, pane-control open, close, move away, layout actions leave Zen, swap no-op, hold hidden PTY sizes, shortcut swallowed, viaMenu `zen`); Zen icon, tooltip, double-click and attention dot on the pane title; styles in src/styles.css; Zen width field in src/settingsDialog.ts
  - proof: `npx eslint src/panes.ts src/settingsDialog.ts src/topBar.ts`
  - proof: `npx vitest run src/attention.test.ts src/layout/model.test.ts src/layout/motion.test.ts`
- [x] 2.3 macOS Shell menu item "Zen Mode" Shift+Cmd+Enter in macos_menu() (src-tauri/src/lib.rs) emitting the "pane" app event
  - proof: `grep -nE "Zen Mode" src-tauri/src/lib.rs`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- With three panes, ⇧⌘↩ / icon / double-click / Shell ▸ Zen Mode enter and leave Zen; the grid returns with the same sizes.
- Hidden panes keep running output; leaving Zen after a window resize refits them once.
- Edge drag is symmetric and the new width shows in Settings and in another window.
- ⌘1–9, ⌘J, ⌘T and ⌘W follow the Zen rules; `tiili open` does not change the view; ⌃⌘0 leaves Zen and resets.
- A bell in a hidden pane shows the dot on the Zen icon.
- Font zoom in the Zen pane widens it, still capped at 90%.
