## Why

Five pane-tiling requirements are within 60–80 characters of OpenSpec's 500-character strict limit. `openspec validate <change> --strict` doesn't check MODIFIED blocks, so a small edit to one of them only fails after it is archived. That put hv/main on hold and has caused fix rounds on 7 cards.

## What Changes

- Shorten the text of Automatic grid layout, Pane zoom, New window, Window title follows the focused pane and Pane motion to about 350 characters or fewer, keeping their names.
- Move details out of the text and into scenarios: the per-mode column formulas, the zoom keys and limits, the Shell menu item, how a pane's title is chosen, the close/move-away update, and the motion timings and divider drag. Most go into new scenarios.
- No behaviour or code changes. Every behaviour stated today is still stated.

## Assumptions

- Details go into new or extended scenarios rather than into new split requirements, so the names stay the same. The other option was to split requirements into new ones.
- Pane zoom ends up at about 350 characters, which counts as "about 350". The other option was to cut it further at the cost of clarity.
