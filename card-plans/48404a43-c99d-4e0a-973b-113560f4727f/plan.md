# Make openspec green: shorten two long settings requirements

## Why
`openspec validate --all --strict` fails on hv/main since #102: in `openspec/specs/settings/spec.md` the requirements "Settings dialogue placement" (requirements[1]) and "Prompt choice" (requirements[14]) are over 500 characters, which strict mode treats as failing.

## What Changes
- "Settings dialogue placement": keep the core statement (own OS window, movable/resizable beyond the tiili window, opens centred, does not dim or block). Move the "open again brings it to front" rule into the existing "Open settings twice" scenario (already says it) and the "closing a tiili window closes its settings window without saving" rule into a new scenario "Closing the tiili window closes settings".
- "Prompt choice": keep the options, default and fallback rule, and that the choice applies to new shells and open local zsh/bash/PowerShell shells with the default prompt. Move "zsh redraws an idle prompt at once; other shells switch at their next prompt; nothing is typed" into the scenarios ("Open panes switch" already covers zsh; add "Other shells switch at next prompt").
- Every requirement keeps a SHALL/MUST and stays under 500 characters. Meaning is unchanged.

## Acceptance
`openspec validate settings --type spec --strict` and `openspec validate --all --strict` pass.

## Citations
- openspec/specs/settings/spec.md, Requirement: Settings dialogue placement
- openspec/specs/settings/spec.md, Requirement: Prompt choice

## Assumptions
- Edit the main spec directly (no OpenSpec change) because no behavior changes; ruled out a new change folder.
- Rules moved into scenarios instead of splitting into new requirements; ruled out new requirement headings.
