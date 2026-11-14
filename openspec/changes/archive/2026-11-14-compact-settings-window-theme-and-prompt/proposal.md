## Why
At the settings window's default size (720×640, `SETTINGS_WINDOW_SIZE` in src-tauri/src/settings.rs) the Style tab scrolls: a "Settings" heading repeats the OS title bar, the theme list scrolls in its own box, prompts take one row each with group headings, hints take paragraphs, and Cancel/Save scroll out of view. The owner approved a compact prototype; the card's text is the full spec (docs/brand/explorations/settings-compact-prototype.html is not in the repo).

## What Changes
- Remove the header (h2 "Settings" and ×). Tabs flush at the top, a live two-pane preview strip on Style and Typography, a scrolling body, and a pinned footer (version, Reset to defaults, Cancel, Save). The settings-window page becomes exactly 100vh with only the body scrolling; the dev `<dialog>` widens to min(720px, 100vw − var(--space-6)).
- New shared pieces in src/settingsDialog.ts: card grid listbox picker (2-D arrow keys), "DEFAULT" tag, ⓘ info button with tooltip (hints keep their wording), segmented radiogroup, label/control rows.
- Style: theme card grid (System, dark, light; no groups, swatch "Aa" removed), prompt card grid (4 in a row, Off label becomes "Off", `group` field dropped), Terminal section (Cursor segmented + Blink; Inactive panes Opacity + Desaturate; Dock icon segmented on macOS).
- Typography: family list beside the slider rows; Ligatures with an example.
- Behaviour: Tiling cards, Panes rows (Responsive text, Hover), App rows (Startup, Updates with "Check now"), Remote shells with a bash/zsh/fish switch showing one snippet and one Copy button.
- Spec delta for openspec/specs/settings/spec.md.

## Outcome
- Window header
  - Now: `Settings ×` heading above the tabs
  - After: tabs at the very top; no heading or ×
- Default theme
  - Now: `Koski (default)`
  - After: Koski card with a `DEFAULT` tag on its top edge
- Off prompt
  - Now: `Off (your shell's own) (default)` row
  - After: `Off` card showing `your shell's own` with a `DEFAULT` tag
- Update button
  - Now: `Check for updates`
  - After: `Check now`
- Live preview
  - After: two terminal panes with `git log --oneline -2` and `npm run dev` above the Style and Typography panels

## Assumptions
- The prototype HTML is absent, so the card text is the only spec (ruled out: waiting for the file).
- The Off prompt card's "your shell's own" text is a preview line, not part of the label (ruled out: keeping it in the label).
- No new unit test: the form has no existing tests and the change is layout and keyboard wiring; compact fit and keyboard use are checked by hand (ruled out: adding a jsdom test of the form).
