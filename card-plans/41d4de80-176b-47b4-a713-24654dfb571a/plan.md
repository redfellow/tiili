# Build the remote-panes OpenSpec change

## Why
The OpenSpec change `remote-panes` (openspec/changes/remote-panes) landed through the fast lane with its proposal,
design, spec deltas and tasks but no code. This card builds it, continuing that change instead of creating a new one.

## What Changes
Implement everything in `openspec/changes/remote-panes/tasks.md` exactly as its design describes, and tick each task
there as it is done:
- OSC 7 keeps its host; a report from another host (or a driveless path on Windows = WSL) makes the pane remote: no
  local repository lookup, the repository comes only from OSC 1337 `SetUserVar=tiili_repo`.
- A remote state ends when the shell is back in the foreground (macOS/Linux) or a local OSC 7 arrives.
- tiili's zsh, bash and PowerShell prompt integration sends OSC 7 at every prompt.
- The chip reads `host:repo` or `host:folder`, tinted per host+repo, else per host.
- Settings > Behaviour gets a Remote shells section with copyable bash, zsh and fish snippets.
No spec text changes: the deltas under `openspec/changes/remote-panes/specs/` are the contract.

## Outcome
- Pane in a remote repository
  - After: `build-box:tiili`
- Pane in a remote folder without the snippet's repo report
  - After: `build-box:src`
- Settings > Behaviour
  - After: a `Remote shells` group with bash, zsh and fish snippets and a Copy button each

## Acceptance
The tasks below pass their proofs; `openspec validate --all --strict` passes; the change's tasks.md is fully ticked.

## Citations
- openspec/changes/remote-panes/proposal.md, design.md, tasks.md
- openspec/changes/remote-panes/specs/{repository-colours,terminal-session,settings}/spec.md

## Assumptions
- The change's own task 5.1 "check by hand" step and its `npm test` proof are moved to manual checks / narrower
  proofs here (rather than run in the sandbox), per this workspace's proof rules.
- Polish was not available because the change belongs to no card; routed as no-spec-change over the existing change
  rather than creating a new one.
