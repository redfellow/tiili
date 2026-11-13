## 1. Close on exit

- [ ] 1.1 In `src/terminal.ts`, remove `EXIT_MESSAGE` and the Enter-restart branch; add an `onExit` callback to `openTerminal` called when its session exits (input after exit is dropped).
  - proof: `npx eslint src/terminal.ts`
- [ ] 1.2 In `src/panes.ts`, pass an `onExit` that closes that pane through `close(index)` (looking up its current index), so the last pane's exit closes the window.
  - proof: `npx eslint src/panes.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- With two panes, type `exit` in one: it closes and the other fills the window.
- With one pane, press Ctrl+D: tiili closes.
