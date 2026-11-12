# Fix placeholder Purpose in pane-layout spec

## Why
`openspec validate --all --strict` fails on hv/main since #20: archiving `resize-and-rearrange-tiled-panes` left `TBD - created by archiving change ...` as the Purpose of `openspec/specs/pane-layout/spec.md`.

## What Changes
Replace the placeholder Purpose line in `openspec/specs/pane-layout/spec.md` with a written one, e.g.: "Manual control over the tiled pane grid in the tiili window: dragging dividers to resize grid rows and columns, swapping panes, resetting the layout, and keeping applicable manual sizes when the grid re-flows; each pane's PTY follows its new size." No requirements change.

## Acceptance
`openspec validate pane-layout --type spec --strict` passes.

## Citations
- openspec/specs/pane-layout/spec.md:4 (placeholder), requirements at lines 8, 19, 34, 41.

## Assumptions
- Edit the main spec directly, as the validator says; ruled out a new change with a delta Purpose (ignored for existing capabilities).
