## Why
`openspec validate --all --strict` fails on hv/main: the settings requirement "Font family list" grew past 500 characters when the Nerd Font icon fallback was added (#155), so auto merge is on hold.

## What Changes
- Tighten the wording of "Font family list" to under 500 characters, keeping its meaning and all four scenarios unchanged (the "never replaces the chosen font's icons" rule stays pinned by the scenario "Picked Nerd Font keeps its icons").
- No behaviour or code changes.

## Assumptions
- Trim the wording instead of splitting into a new requirement: openspec refuses a MODIFIED block that drops scenarios, so a split would duplicate them.
