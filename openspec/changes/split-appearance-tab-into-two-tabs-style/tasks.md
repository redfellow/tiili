## 1. Split the tab

- [x] 1.1 In `src/settingsDialog.ts`, split the Appearance panel into Style (Theme, Cursor, Inactive terminals, app icon when shown) and Typography (Font) panels, name the tabs Style, Typography, Behaviour, append both panels to the form, update the doc comment, and rename any `settings-panel-appearance` selector in `src/styles.css`
  - proof: `npx eslint src/settingsDialog.ts`
  - proof: `npm run typecheck`
- [x] 1.2 Check the change's spec delta
  - proof: `openspec validate split-appearance-tab-into-two-tabs-style --strict`

## Manual checks after merge (The user)
- Open Settings: tabs read Style, Typography, Behaviour; it opens on Style with Theme, Cursor and Inactive terminals.
- Typography shows the full Font section; Left/Right arrows cycle through all three tabs.
