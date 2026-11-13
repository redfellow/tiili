## Why
`openspec validate --all --strict` fails on hv/main since #39: the pane-tiling requirement "Focus appearance" is longer than 500 characters, so auto merge is on hold.

## What Changes
- Split "Focus appearance" into two requirements with the same meaning: "Focus appearance" (gaps, accent line, cursor) and a new "Inactive pane dimming" (content-only fade, desaturation, solid background, mouseover highlight).
- Keep the existing scenarios under "Focus appearance" (archive refuses to drop them), add a focus-accent scenario there and two scenarios for the new requirement.
- No behaviour or code changes.

## Assumptions
- The split is purely editorial; the alternative of rewording to drop detail was ruled out because it would loosen the contract.
