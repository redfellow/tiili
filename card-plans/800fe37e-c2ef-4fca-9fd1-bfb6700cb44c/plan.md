# Shortlist of candidate ideas for upcoming product features

## Why

Reijo asked "Ideas for next features?" and chose a written ideas list only, with no code. He wanted ideas on terminal and panes, on agent workflows, and from any other area (question batch f8950b49).

## What Changes

- The build writes `card-plans/800fe37e-c2ef-4fca-9fd1-bfb6700cb44c/ideas.md`: a shortlist of 8 to 12 ideas, grouped under **Terminal & panes**, **Agent workflows** and **Other**. Each idea gets a title, one sentence on what the user gains, and the spec it builds on (from `openspec/specs/`).
- The list leaves out anything the specs already cover, and anything another card already has in progress, such as the 24-hour update check.
- No app code or specs change. Reijo makes cards from whichever ideas he picks.

Starting points to work from:
- Terminal & panes: tabs or workspaces in one window, sending typed input to several panes at once, splitting a pane in a chosen direction, zooming one pane to full window, and naming panes.
- Agent workflows: showing each pane's agent status (working, waiting or done) in the top bar, more fan-out skills beyond pull request reviews (for example parallel test-fix runs), and letting agents close or focus panes through the `tiili` command.
- Other: customising shortcuts, per-repository profiles, and a command palette.

## Acceptance

- `ideas.md` exists and has the three headings and at least 8 ideas.
- Every idea names an existing spec.

## Citations

- Question batch f8950b49 (Reading: Ideas list only; Focus: Terminal & panes, Agent workflows, Any area)
- openspec/specs/pane-tiling, pane-layout, pane-control, agent-skills, pane-attention, settings

## Assumptions

- The list is saved in the card's plan folder, not in `docs/`. The alternative, a roadmap document in the repository, was the option Reijo did not choose.
- The build does not create cards from the ideas. The alternative was filing them automatically; Reijo turns ideas into cards himself.
