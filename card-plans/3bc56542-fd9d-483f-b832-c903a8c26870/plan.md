# Write the pane-tiling Purpose

## Why
`openspec validate --all --strict` fails on hv/main: `openspec/specs/pane-tiling/spec.md` still has the archive placeholder Purpose ("TBD - created by archiving change ..."), which blocks auto merge.

## What Changes
- Replace the placeholder under `## Purpose` in `openspec/specs/pane-tiling/spec.md` with a real sentence, e.g.: "Several terminal panes in the one tiili window, each with its own shell, laid out in an automatic grid that grows as terminals open, with shortcuts to open, close and move focus between panes."
- No requirement changes.

## Acceptance
- `openspec validate pane-tiling --type spec --strict --no-interactive` passes.

## Citations
- openspec/specs/pane-tiling/spec.md:4 (placeholder Purpose)
- openspec/specs/pane-tiling/spec.md:8-59 (requirements the Purpose summarises)

## Assumptions
- Purpose wording is drawn from the spec's own requirements; ruled out asking the user for wording.
