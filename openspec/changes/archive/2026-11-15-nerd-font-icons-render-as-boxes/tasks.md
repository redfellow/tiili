## 1. Bundled symbols font

- [x] 1.1 Add `src/assets/fonts/SymbolsNerdFontMono-Regular.woff2` from the latest NerdFontsSymbolsOnly release (download and convert in a temp dir), its licence as `src/assets/fonts/NerdFonts-LICENSE.txt`, and a LICENSES.md row noting MIT with per-icon-set licences and the release version; reword the "All are under the SIL OFL" line to except it
  - proof: `test -s src/assets/fonts/SymbolsNerdFontMono-Regular.woff2 && grep -q "Symbols Nerd Font Mono" src/assets/fonts/LICENSES.md && test -s src/assets/fonts/NerdFonts-LICENSE.txt`
- [x] 1.2 Add the `@font-face` for "Symbols Nerd Font Mono" in `src/styles.css` with `unicode-range` U+E000-F8FF, U+F0000-FFFFD and the other icon-only ranges in the font's cmap (no box drawing or letters)
  - proof: `grep -n "Symbols Nerd Font Mono" src/styles.css`

## 2. Font list and loading

- [x] 2.1 Put "Symbols Nerd Font Mono" in `fontFamilyList` after Geist Mono, before monospace (exported constant), and update the expected lists in `familyCases`
  - Tests to update: src/settings.test.ts
  - proof: `npx vitest run src/settings.test.ts`
  - proof: `npx eslint src/settings.ts src/settings.test.ts`
- [x] 2.2 In `loadFont` (src/terminal.ts) also `document.fonts.load` the family list with a private-use sample text so the symbols face is loaded before xterm measures
  - proof: `npx eslint src/terminal.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- `printf " \U000f0219\n"` in a pane shows icons, not boxes, with Geist Mono and with each bundled font.
- With an installed Nerd Font picked in Settings, its own icons render.
- Oh My Pi's status line shows its icons.
