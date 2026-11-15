## Why

Nerd Font icons (private-use codepoints such as U+F0219) show as empty boxes in tiili, for example in Oh My Pi's status line, unless the user has installed and picked a Nerd Font. None of the bundled fonts has these glyphs and macOS has no system fallback for private-use codepoints. Ghostty and WezTerm avoid this by shipping a symbols-only Nerd Font as a built-in fallback.

## What Changes

- Bundle Symbols Nerd Font Mono (NerdFontsSymbolsOnly release from ryanoasis/nerd-fonts, Mono variant) as a woff2 in `src/assets/fonts/`.
- Add an `@font-face` in `src/styles.css` whose `unicode-range` covers only the private-use/icon ranges the font covers, so it never replaces letters.
- `fontFamilyList` puts it after the chosen font and Geist Mono, before `monospace`; a user-picked Nerd Font still wins.
- `loadFont` in `src/terminal.ts` also loads the symbols face before xterm measures cells.
- `LICENSES.md` gets a row for it (MIT, per-icon-set licences) and the licence text the release ships.

## Outcome

- Icons in a pane (`printf " \U000f0219\n"`)
  - Now: two empty boxes
  - After: a house and a folder icon, one cell each

## Assumptions

- The font version is the latest NerdFontsSymbolsOnly release at build time (rather than pinning a specific older one); the version is recorded in LICENSES.md.
- The unicode-range is the PUA ranges U+E000-F8FF and U+F0000-FFFFD plus any other icon ranges the font's cmap actually has outside letters (e.g. U+23FB-23FE, U+2665, U+26A1, U+2B58), checked against the font; ranges overlapping ordinary text such as box drawing (U+2500-259F) are left out so the chosen font draws those.
