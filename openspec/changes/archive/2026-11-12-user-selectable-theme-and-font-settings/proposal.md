## Why

tiili has one look: the brand light/dark scheme following the system, and Geist Mono at 14 px. Reijo wants a settings dialogue where users choose a theme and font settings, and where every later tiili setting lives.

## What Changes

- A settings dialogue in the window, opened with ⌘, (macOS, also **tiili › Settings…** in the app menu) or Ctrl+, (Windows, Linux), and from a **Settings…** entry in the terminal's right-click menu. Esc or a close button dismisses it. Changes apply live.
- Theme choice:
  - **System** (default): brand light/dark following the OS, as today.
  - **tiili Light**, **tiili Dark**: the brand schemes, fixed.
  - tiili variants built from the brand palettes Reijo supplied: **Savi** (warm light ground), **Muratti** (warm dark ground with ivy/birch accents), **Koski** (rapids at night: koski ground, savi and ikkuna accents) and **Laasti** (mortar-grid light). Each gets its own derived ANSI 0–15 set.
  - Well-known schemes with their published palettes: Solarized Light, Solarized Dark, Gruvbox Dark, Nord, Dracula.
- Font settings: family (any installed font typed by name, with Geist Mono as default and fallback), size, normal and bold weight, ligatures on/off, line height, letter spacing. A **Reset to defaults** button.
- Settings persist in `settings.json` in the OS app config folder, read and written by the Rust core; a missing or broken file falls back to defaults.
- New spec `settings`; `terminal-session` "Branded terminal appearance" changes from fixed to the default of the user's choice.

## Outcome

- Pressing ⌘, (Ctrl+, on Windows/Linux)
  - After: a `Settings` dialogue with `Theme` and `Font` sections opens over the terminal.
- Choosing `Koski` in Theme
  - After: the terminal switches immediately to the Koski colours, and stays so after restart.
- Font family `JetBrains Mono`, ligatures on
  - After: the terminal uses that font and draws `=>` as a ligature.
- Right-click on the terminal
  - After: menu has `Copy`, `Paste`, `Settings…`.

## Assumptions

- Variant names and the exact derived ANSI sets are the builder's, based on the palettes in design.md (core colours, warm grounds, mockups, round 1 combinations); Reijo reviews them in the PR. Ruled out: waiting for further palette input.
- Well-known schemes: Solarized Light/Dark, Gruvbox Dark, Nord, Dracula. Ruled out: a larger catalogue or theme import.
- A fixed theme also recolours the app chrome (bg, surface, fg, accent, gap tokens), not only the terminal. Ruled out: terminal-only themes.
- Font family is a free-text field with a datalist of common monospace fonts; an unavailable font falls back to Geist Mono. Ruled out: enumerating system fonts from Rust.
- Ligatures use `@xterm/addon-ligatures` (new dependency, from npm, already reachable). Ruled out: hand-rolled ligature rendering.
- Ranges: size 8–32 px, weights 100–900 in steps of 100, line height 1.0–2.0, letter spacing 0–5 px; out-of-range or wrong-type values in the file are replaced by defaults per field.
- Defaults: theme System, Geist Mono, 14 px, normal 400, bold 700, ligatures off, line height 1.0, letter spacing 0 (today's look).
- The dialogue is an in-window modal, not a second OS window.
- Settings are global for all panes once auto-tiling lands; the build adapts to whatever pane module exists after merging `origin/main`.
