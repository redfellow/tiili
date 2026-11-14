## Why
tiili has no way to search a terminal's scrollback. Finding an error or a path in long output means scrolling by eye.

## What Changes
- New capability `terminal-search`: a per-pane find bar overlay using `@xterm/addon-search` on the focused pane, with incremental search, a match count (`3/17`, `1000+`), case / whole-word / regex options, invalid-regex error state, Enter / Shift+Enter navigation and Esc to close.
- Highlights: active match in `--accent`, other matches in brick blended into `--term-bg` (computed `#RRGGBB`), marks in the 8 px overview ruler, recomputed on theme change; the xterm theme gains a `selectionBackground` distinct from both.
- `clipboard`: the macOS Edit menu gains Find… ⌘F, Find Next ⌘G, Find Previous ⇧⌘G; Windows/Linux use Ctrl+Shift+F, F3, Shift+F3 (Ctrl+F stays with the shell).
- `pane-layout`: the terminal scrollbar shows search match marks.
- In a Heynote pane, ⌘F / Find… opens Heynote's own search instead.
- Direction: this card is part 1 of 3 of "terminal-find-and-links"; links and scrollback/Option-drag are separate cards. The direction repeats the origin's scope and adds the shared constraints (all three platforms, no key conflicts, brand tokens, Heynote skipped like zoom); it did not change the idea.

## Outcome
- Find bar
  - After: an overlay at the top right of the terminal with a field, a count such as `3/17`, toggles `Aa`, `W`, `.*`, and previous / next / close buttons
- macOS Edit menu
  - Now: `Copy ⌘C`, `Paste ⌘V`, `Select All ⌘A`
  - After: `Copy ⌘C`, `Paste ⌘V`, `Select All ⌘A`, separator, `Find… ⌘F`, `Find Next ⌘G`, `Find Previous ⇧⌘G`
- Over the addon limit
  - After: `1000+`
- No match
  - After: `0/0`

## Assumptions
- "Narrow" means a pane under 360 px wide; then the bar spans the pane width. Alternative: a different breakpoint.
- Find Next / Find Previous with the bar closed open it with the last query and step; with no query they only open the bar. Alternative: do nothing while closed.
- Toggling options is per pane and not persisted across restarts. Alternative: saving them in settings.
- Heynote's search is opened by sending its page the key/command it already handles for ⌘F (through the existing frame handle); on Windows/Linux Ctrl+Shift+F in a Heynote pane is left to Heynote. Alternative: a new bridge message.
- The bar's buttons have tooltips naming their keys; no right-click "Find" item is added. Alternative: a context menu item.
