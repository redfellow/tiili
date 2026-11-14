## 1. Shared pieces and layout

- [ ] 1.1 Drop the `group` field from PROMPT_STYLES and rename Off's label to "Off" in src/promptStyles.ts; update its uses
  - proof: `npx eslint src/promptStyles.ts`
- [ ] 1.2 In src/settingsDialog.ts add the card grid, segmented control, info button, DEFAULT tag and row helpers; remove `.settings-header`; restructure the form into tabs / preview / scrolling body / pinned footer; widen the dev `<dialog>`
  - proof: `npx eslint src/settingsDialog.ts`
- [ ] 1.3 Rewrite the "Settings dialogue" block of src/styles.css for the new layout, cards, tags, tooltips, segmented control, rows and 100vh settings page, using brand tokens
  - proof: `grep -c "settings-preview" src/styles.css`

## 2. Tabs

- [ ] 2.1 Style tab: theme card grid (System, dark, light; swatchColours and "Aa" removed), prompt card grid with ⓘ, Terminal rows (Cursor segmented + Blink, Inactive panes, Dock icon segmented on macOS)
  - proof: `npx eslint src/settingsDialog.ts`
- [ ] 2.2 Typography tab: two-column Font fieldset, family list 268px beside the slider rows, Ligatures example
  - proof: `npx eslint src/settingsDialog.ts`
- [ ] 2.3 Behaviour tab: Tiling cards, Panes rows, App rows with "Check now" and its status span, Remote shells switch with one snippet and a Copy button (view state reset with the form)
  - proof: `npx vitest run src/remoteSnippets.test.ts`
  - proof: `npx eslint src/settingsDialog.ts`
- [ ] 2.4 Live preview strip rendered from the draft on every change and in `show()`; hidden on Behaviour
  - proof: `npx eslint src/settingsDialog.ts`
- [ ] 2.5 Wire `read()`, `lock()`, Esc while asking Reset, `adopt()`, reset focus on the theme grid with the selected card scrolled into view, and late installed fonts through the new controls
  - proof: `npx vitest run src/settingsSession.test.ts src/settings.test.ts`
  - proof: `npm run typecheck`

## 3. Spec

- [ ] 3.1 Keep the delta spec valid
  - proof: `openspec validate compact-settings-window-theme-and-prompt --strict`

## Manual checks after merge (The user)
- In `npm run dev:browser` and in the app at 720×640 on macOS (Dock icon row present), each tab's body has scrollHeight ≤ clientHeight and Cancel/Save stay visible at smaller sizes.
- Every grid, segmented control and ⓘ works by keyboard as described in the card; the preview follows theme, prompt, cursor, font and inactive changes, Reset, Cancel and adopt.
- Add screenshots of all three tabs in Koski and in tiili Light to the PR.
