# Smaller font size in the Settings view

## Why
Reijo: "Settings font size is too big". He confirmed he means the Settings view's own text (not the terminal font), about one step smaller.

## What Changes
- In `src/styles.css`, the Settings dialogue and Settings window text drops about one step: body text 13.5px → 12.5px (`dialog.settings`, `.settings-page`), the heading 24px → 20px, legends 11.5px → 11px, slider values 12px → 11.5px, and the other settings-only sizes (close button glyph, list headings, small 12px texts in the settings block) shrink by the same step.
- Inputs, selects and buttons inherit the font, so they follow. Terminal font settings are untouched.

## Outcome
- Settings text
  - Now: body text 13.5 px, heading 24 px
  - After: body text 12.5 px, heading 20 px

## Acceptance
- Every Settings text is about one step smaller; nothing outside the Settings rules changes.

## Citations
- `openspec/specs/settings/spec.md`: no requirement pins the dialogue's text sizes, so no spec change.
- `src/styles.css` lines ~405–790: the settings rules.

## Assumptions
- Only font sizes change; spacing, control heights (32 px fields) and dialogue width stay (ruled out a compact re-layout).
- Same sizes in the dialogue and the separate settings window (ruled out treating them differently).
