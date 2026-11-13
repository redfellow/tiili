## Why
The Heynote pane sits next to terminals, so it is narrow. Heynote opens its notes list on the left by default, which takes much of that width from the editor for every first-time user. It also uses its own Hack font, while tiili's look is set in Geist Mono.

## What Changes
- Heynote starts with its left panel (notes list and search) closed. Users can still open it with ⌘⇧S (Ctrl+Shift+S), the status-bar button, or library search, and Heynote remembers their choice.
- Heynote's default font is Geist Mono, the font tiili bundles, instead of Hack. A font picked in Heynote's settings still wins.

## Outcome
- First open
  - Before: notes list on the left, Hack font
  - After: editor across the whole pane, Geist Mono

## Assumptions
- The font is borrowed from tiili's own `@font-face` rules at run time instead of shipping a second copy in `public/heynote/`. When the page is opened outside tiili, it falls back to Hack.
- Users whose saved Heynote settings already show the panel keep it shown.
