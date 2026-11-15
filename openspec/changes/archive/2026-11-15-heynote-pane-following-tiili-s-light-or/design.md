# Design

- **Theme kind**: a pure `themeKind(themeId, prefersDark)` in src/themes.ts returns `"light" | "dark"` from `Theme.kind` (`system` resolves by `prefersDark`). The parent window exposes it to Heynote as `window.tiiliTheme = { kind(), onChange(cb) }`, updated when settings or the OS scheme change.
- **Bridge** (heynote/bridge.js): `themeMode.get` computes `system` from `window.parent.tiiliTheme?.kind()` (falling back to the page's media query in the browser preview) and calls `themeCallback` on tiili's change as it does for the media query today.
- **No flash**: `openHeynote` sets the iframe's `color-scheme` and a background of Heynote's ground for the expected mode before `src` is set, keeps it `visibility: hidden` until `load` plus one animation frame, then shows it. The build (scripts/heynote.mjs) adds an inline `<style>` in Heynote's index.html head giving `html` that background and `color-scheme` from `parent.tiiliTheme` before any script runs.
- Why: the white comes from the empty iframe canvas and Heynote's unstyled page; covering both and revealing after paint removes it without touching Heynote's sources beyond the existing build patch.
