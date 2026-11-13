# Settings overhaul from the Design session: Koski default, cursor, fonts, tooltips

## Why
In one Design view session the user accepted a series of changes to tiili's settings, theme list, fonts and top bar. None of it is on main yet. Monaspace was never added to main, so removing it means only that it is not bundled. Reijo chose to build the whole session in this card.

## What Changes
- **Koski is the default theme.** It applies only when settings have never been saved or are reset. Saved themes are kept. An unknown saved theme falls back to Koski. Its Theme list row shows a muted `(default)` after the name.
- **New Cursor section in Settings.** A Style dropdown offers Brick, Underline and Bar, and a Blink checkbox sits under it. The default is Brick with blinking on. Changes apply live to every pane and are saved with the other settings. A missing or invalid saved value falls back to Brick with blinking.
- **Theme list.** System comes first, then a "Dark" group and a "Light" group. Each row starts with a small colour swatch on the left. The list is 4–5 rows high and uses the design system's input styles.
- **Theme contrast.** Theme colours are adjusted to meet the WCAG contrast targets. Each theme gets `--on-accent` and `--focus` tokens.
- **Font family list.** The family control becomes a keyboard-navigable list like the theme list, and moving focus applies the font. It has two groups: "Bundled" (Geist Mono, Victor Mono, Commit Mono, Recursive Mono, Cascadia Code) and "OS" (the fixed-width fonts installed on the machine). A saved family that is in neither group stays listed under OS.
- **Bundled fonts.** Geist Mono switches to its variable files (100–900). Victor Mono, Commit Mono, Recursive Mono and Cascadia Code are added, all under the OFL, with a `LICENSES.md` note. No Monaspace files are added. Berkeley Mono and Cartograph CF are commercial, so they are not bundled.
- **Default font and sliders.** The default font weight becomes 100. Weight and bold weight become sliders in steps of 10. Line height and letter spacing become sliders with a filled track and a readout. Letter spacing runs from −2 to 5 px in steps of 0.1.
- **Ligatures fix.** Turning on ligatures no longer fails with "You must set the allowProposedApi option".
- **Settings dialog.** It no longer dims the window; a drop shadow lifts it instead. It can be dragged by its header, stays inside the window, and returns to the centre each time it opens.
- **Top-bar tooltips.** The four top-bar buttons show a styled popover tooltip with the name and shortcut, right away on hover, instead of the native title tooltip.

## Outcome
- Theme list default
  - Now: `System` selected on first launch
  - After: `Koski (default)` selected on first launch, with "(default)" in muted text
- Cursor section
  - After: `Cursor` with `Style: Brick ▾` (options `Brick`, `Underline`, `Bar`) and `☑ Blink`
- Font family
  - Now: a text field with suggestions
  - After: a list with `Bundled` and `OS` headings, each name drawn in its own font
- Top-bar tooltip
  - Now: native tooltip `New pane (⌘T)` after a delay
  - After: a popover right away: `New pane  ⌘T`

## Assumptions
- Monaspace is not on main, so "remove Monaspace" only means it is never bundled. The alternative, treating the card as already done, is ruled out.
- The prototype's labels "Brick (block)" lose the "(block)" suffix, as the origin says.
- Tests cover what can be tested as pure logic: settings normalisation and theme contrast. The DOM dialog, sliders, dragging and tooltips are checked by hand, because the workspace has no DOM test environment. The alternative, adding jsdom and dialog tests, is ruled out.
- The bundled font files are taken from the upstream releases named in `LICENSES.md`. The alternative, including commercial or unlicensed files, is ruled out.
- The contrast targets are 4.5:1 for `--fg` and `--muted` on `--bg` and `--surface`, and 3:1 for `--focus` and ANSI bright black on their grounds. Stricter targets for every ANSI colour are ruled out, because they would change the published palettes.
