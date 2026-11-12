# Write the Purpose of the clipboard and terminal-session specs

## Why
`openspec validate --all --strict` fails on main since d1bebda0e44c because both main specs still carry the placeholder Purpose `openspec archive` wrote. Auto merge is on hold until it is green.

## What Changes
- `openspec/specs/clipboard/spec.md`: replace the `TBD - ...` Purpose with a real one, e.g. "Copy and paste between the tiili terminal and the system clipboard with each platform's usual shortcuts and context menu, without taking Ctrl+C away from the shell."
- `openspec/specs/terminal-session/spec.md`: replace it with e.g. "The one terminal window of tiili: a terminal connected to the user's default shell through a pseudo-terminal, how it looks, and what happens when the shell exits."
- No requirement or scenario changes.

## Acceptance
`openspec validate --all --strict` passes.

## Citations
- openspec/specs/clipboard/spec.md:4
- openspec/specs/terminal-session/spec.md:4

## Assumptions
- Purpose wording is derived from the existing requirements; alternative of asking the user for wording ruled out as it changes no behaviour.
