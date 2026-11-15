## Why
`openspec validate --all --strict` fails on hv/main because the pane-tiling requirement "Pane motion" is over 500 characters. The check stays red until it is fixed, and auto merge waits on it.

## What Changes
- Split "Pane motion" in `pane-tiling` in two. "Pane motion" keeps the open, close, re-flow, swap, reduced-motion, divider and PTY rules. A new requirement, "Gliding pane content scaling", holds the even text and title scaling, with a new scenario. The existing "Gliding text scales evenly" scenario stays under "Pane motion", because a MODIFIED requirement cannot drop scenarios.
- Behaviour, code and tests stay the same.

## Assumptions
- The scaling rules move to a new requirement and are not shortened in place. Shortening them in place would mean dropping wording.
