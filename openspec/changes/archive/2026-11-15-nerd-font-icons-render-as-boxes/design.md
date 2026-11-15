## Approach

- Asset: download `NerdFontsSymbolsOnly.zip` from the latest ryanoasis/nerd-fonts release into a temp dir, take `SymbolsNerdFontMono-Regular.ttf`, convert to woff2 (e.g. `woff2_compress` or fontTools `pyftsubset --flavor=woff2` with no subsetting), save as `src/assets/fonts/SymbolsNerdFontMono-Regular.woff2`. Copy the release's `LICENSE` text into `src/assets/fonts/NerdFonts-LICENSE.txt`.
- CSS: `@font-face { font-family: "Symbols Nerd Font Mono"; src: url(...) format("woff2"); font-weight: 100 900; font-display: block; unicode-range: U+E000-F8FF, U+F0000-FFFFD, <other icon-only ranges found in the cmap>; }`. Weight range so bold cells use it without synthesis mismatch.
- `fontFamilyList(family)`: `"<family>", "Geist Mono", "Symbols Nerd Font Mono", monospace` (Geist Mono alone: `"Geist Mono", "Symbols Nerd Font Mono", monospace`). Export the name as a constant.
- Loading: `document.fonts.load(font, text)` only fetches faces whose unicode-range matches `text` (default is a space), so `loadFont` adds a load with a private-use sample (e.g. `""`) for the regular weight; otherwise the face loads lazily after xterm has measured and the first icon draws late/as a box.
- Why a fallback in the list rather than a CSS-only trick: WebKit's per-glyph fallback walks the font-family list, and unicode-range keeps the face from ever matching letters.
