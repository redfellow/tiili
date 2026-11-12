# Give the packaging spec a real Purpose

## Why
`openspec validate --all --strict` fails on hv/main because `openspec/specs/packaging/spec.md` still has the placeholder Purpose `TBD - created by archiving change ...`, which holds auto merge.

## What Changes
- Replace the placeholder `## Purpose` in `openspec/specs/packaging/spec.md` (main spec, edited directly) with: "How tiili is packaged for release: installers for macOS, Windows and Linux built with Tauri's bundler, and the app icon set they carry." Requirements unchanged.

## Acceptance
- `openspec validate packaging --type spec --strict` passes; the openspec check is green.

## Citations
- openspec/specs/packaging/spec.md:4 (placeholder Purpose)

## Assumptions
- Purpose wording drawn from the spec's existing requirements (installers, icon set); ruled out adding new requirements.
