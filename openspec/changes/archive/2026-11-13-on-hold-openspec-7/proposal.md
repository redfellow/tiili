## Why
`openspec validate --all --strict` fails on hv/main because the pane-tiling requirement "Automatic grid layout" is longer than 500 characters. This holds auto merge.

## What Changes
- Shorten "Automatic grid layout" to the column counts, the row count and the fill and stretch rules.
- Move the re-flow rule out into a new requirement, "Grid re-flow", with a scenario for changing the tiling mode. "Automatic grid layout" keeps all four of its scenarios.
- No behaviour changes.

## Assumptions
- Splitting the requirement in two was chosen over cutting its wording down. Splitting keeps every rule and scenario name as it is.
