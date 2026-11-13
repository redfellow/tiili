## 1. Core
- [x] 1.1 Add a command tracker in `src-tauri/src/` (OSC 0/2 title scanner, foreground process name per platform, title-cleared-on-process-change rule) with unit tests, and emit `pane-command` from the PTY session
  - proof: `cargo test --manifest-path src-tauri/Cargo.toml --lib`
  - proof: `cargo fmt --manifest-path src-tauri/Cargo.toml --check`

## 2. Frontend
- [x] 2.1 Add `chipLabel` to `src/paneChip.ts` with a table test in `src/paneChip.test.ts`; listen for `pane-command` in `src/panes.ts` (and the dev WebSocket backend if it forwards events) and show the combined label
  - Tests to update: src/paneChip.test.ts
  - proof: `npx vitest run src/paneChip.test.ts`
  - proof: `npx eslint src/paneChip.ts src/paneChip.test.ts src/panes.ts src/backend.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate --all --strict`

## Manual checks after merge (The user)
- Run `top` in a pane: chip reads `<folder> · top`; quit it: chip reads `<folder> · zsh`.
- In a repository pane the repo part keeps its tint.
- Open vim or another program that sets a title and see it in the chip.
