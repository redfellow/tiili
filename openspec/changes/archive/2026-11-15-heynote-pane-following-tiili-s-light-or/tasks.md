## 1. Theme hand-off
- [x] 1.1 Add pure `themeKind(themeId, prefersDark)` to src/themes.ts with a table-driven case in src/themes.test.ts (every theme id, system both ways)
  - proof: `npx vitest run src/themes.test.ts`
- [x] 1.2 Expose `window.tiiliTheme` (kind, onChange) from the main window, updated on theme and OS scheme change; make heynote/bridge.js resolve Heynote's `system` theme from it and follow its changes
  - proof: `npx eslint src/themes.ts src/main.ts src/heynotePane.ts`

## 2. No flash
- [x] 2.1 In src/heynotePane.ts set the frame's background and `color-scheme` before loading and keep it hidden until load plus one frame; in scripts/heynote.mjs add an inline head style for Heynote's page ground from `parent.tiiliTheme`; update the `.pane-heynote` rule in src/styles.css
  - proof: `npx vitest run src/heynoteSaveOnClose.test.ts src/heynoteStore.test.ts`
  - proof: `npx vitest run src/themes.test.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- With Koski and the OS in light mode, open a Heynote pane: dark from the first frame, no white flash, Heynote dark.
- Switch tiili to tiili Light in Settings: an open Heynote pane turns light live.
- Choose Light inside Heynote, switch tiili back to dark: Heynote stays light.
