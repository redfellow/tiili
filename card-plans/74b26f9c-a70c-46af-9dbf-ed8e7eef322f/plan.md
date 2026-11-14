# Unblock openspec: shorten long requirements in repository-colours

## Why
`openspec validate --all --strict` fails on hv/main since #140: requirements[0] (Pane follows its working directory), [2] (Title chip) and [6] (Remote repository report) in `openspec/specs/repository-colours/spec.md` exceed 500 characters. Auto merge is on hold until it is green.

## What Changes
Reword those three requirements in the main spec so each requirement body states its core behaviour in under 500 characters, moving examples and edge cases into new or existing scenarios (or splitting into extra requirements). No behaviour changes; nothing is dropped.

## Acceptance
- `openspec validate repository-colours --type spec --strict` passes, and `openspec validate --all --strict` passes.
- Every rule and example from the old text is still present in a requirement or scenario.

## Citations
- openspec/specs/repository-colours/spec.md lines 8, 54, 106.

## Assumptions
- Edit the main spec directly rather than via a change, since the contract is unchanged (alternative: a new OpenSpec change with MODIFIED deltas).
