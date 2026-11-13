# Fix openspec: shorten long settings requirements

## Why
`openspec validate --all --strict` fails on hv/main since aaa4945f83a3 (#37): in `openspec/specs/settings/spec.md` the requirements "Settings dialogue", "Theme choice" and "Font settings" exceed 500 characters, so auto merge is on hold.

## What Changes
- Edit `openspec/specs/settings/spec.md` only. Keep each of the three requirement headings, but move part of their text into new, separate requirements that each state one behaviour, for example:
  - Settings dialogue → keep opening + live preview; new "Settings dialogue placement" (no dimming, draggable within the window, opens centred), moving the "Drag the dialogue" scenario under it.
  - Theme choice → keep the list of themes, colours and contrast; new "Theme list" (System first, Dark and Light groups, swatches, arrow/click preview, moving "Arrowing previews themes") and new "Default theme" (Koski default with muted "(default)", moving "Koski by default").
  - Font settings → keep the settings and ranges, default, sliders, ligatures; new "Font family list" (Bundled and OS groups, arrowing applies at once, Geist Mono fallback, moving "Unavailable font" and "Arrowing previews fonts").
- Every new requirement has at least one scenario, uses SHALL, and stays under 500 characters. No SHALL is dropped or changed in meaning; all scenario titles stay word for word.

## Acceptance
- `openspec validate settings --type spec --strict` and `openspec validate --all --strict` pass.

## Citations
- openspec/specs/settings/spec.md (requirements[0], [2], [3])
- src/themes.test.ts names "Theme choice", which is kept.

## Assumptions
- Requirement headings that tests name are kept and new requirements are added, rather than renaming them.
- Main spec is edited directly as a wording-only fix, rather than through a new OpenSpec change, since no contract changes.
