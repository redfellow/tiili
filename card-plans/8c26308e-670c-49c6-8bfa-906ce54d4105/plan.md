# Application-wide default font size of 13 pixels

## Why
Reijo wants the default terminal font size (Settings → Typography → Size) to be 13 px. In the source it is 12 px today (`src/settings.ts:110`, set by #60). The 14 px Reijo saw after "Reset to defaults" most likely came from an older installed build made before #60.

## What Changes
- `DEFAULT_SETTINGS.font.size` in `src/settings.ts` changes from 12 to 13. Reset to defaults, a new install, and a missing or invalid saved size all use it. A size the user has saved is kept.

## Outcome
- Typography → Size after Reset to defaults
  - Now: `12` (14 in the older installed build)
  - After: `13`

## Acceptance
- `DEFAULT_SETTINGS.font.size` is 13, and the settings tests still pass. They compare against `DEFAULT_SETTINGS` and do not hard-code 12.

## Citations
- openspec/specs/settings/spec.md:79: no default size is specified, so no spec delta is needed.
- src/settings.ts:110
- commit 495d070 (the earlier change to 12, done the same way)

## Assumptions
- Only the terminal font default changes. The fixed interface text sizes in `src/styles.css` stay as they are; the user confirmed that the Typography size is meant.
