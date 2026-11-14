## 1. Search logic
- [x] 1.1 Add `@xterm/addon-search` and `src/search.ts` (count label, regex check, hex blend, decoration options from theme tokens) with table-driven `src/search.test.ts` (`@harvaaja-test-tier: fast`)
  - proof: `npx vitest run src/search.test.ts`
  - proof: `npx eslint src/search.ts src/search.test.ts`
- [x] 1.2 Add `selectionBackground` distinct from match colours to `terminalTheme` in `src/theme.ts`
  Tests to update: src/theme.test.ts
  - proof: `npx vitest run src/theme.test.ts`
  - proof: `npx eslint src/theme.ts`

## 2. Keys and menu
- [x] 2.1 Add `findAction` to `src/keymap.ts` (⌘F/⌘G/⇧⌘G; Ctrl+Shift+F, F3, Shift+F3; plain Ctrl+F null) with cases in `src/keymap.test.ts`
  Tests to update: src/keymap.test.ts
  - proof: `npx vitest run src/keymap.test.ts`
  - proof: `npx eslint src/keymap.ts src/keymap.test.ts`
- [x] 2.2 Add Find…, Find Next, Find Previous to the macOS Edit menu in `src-tauri/src/lib.rs`, emitted to the focused window
  - proof: `cargo check --manifest-path src-tauri/Cargo.toml --lib`
  - proof: `grep -nE "Find Next|Find Previous" src-tauri/src/lib.rs`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 3. Find bar
- [x] 3.1 Add `src/findBar.ts` overlay and styles in `src/styles.css`; load the addon in `src/terminal.ts`, recompute decorations on theme refresh
  - proof: `npx eslint src/findBar.ts src/terminal.ts`
- [x] 3.2 Dispatch find keys and menu payloads in `src/panes.ts` / `src/main.ts`; Heynote panes open Heynote's search
  - proof: `npx eslint src/panes.ts src/main.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate terminal-scrollback-search-with-a-find-b --strict`

## Manual checks after merge (The user)
- macOS: Edit › Find…, ⌘G, ⇧⌘G open and step through matches; count and ruler marks show; Esc clears and refocuses.
- Windows/Linux: Ctrl+Shift+F, F3, Shift+F3 work; Ctrl+F reaches the shell.
- Theme switch recolours highlights; terminal size unchanged when the bar opens; narrow pane gets a full-width bar.
- Heynote pane: ⌘F opens Heynote's search.
