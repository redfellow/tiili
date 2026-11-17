## Why
Reijo runs several dev builds side by side and wants the settings footer to say which pull request each one is.

## What Changes
- At build time, vite.config.ts asks `gh pr view --json number` for the checked-out branch and bakes the number into the frontend as `__APP_PR__` (empty when there is no PR, gh is missing or fails, or the build is a release).
- The settings footer shows `tiili dev build · PR #123` for a dev build with a PR; otherwise unchanged.

## Outcome
- Dev build of a branch with a PR
  - Now: `tiili dev build`
  - After: `tiili dev build · PR #123`
- Dev build with no PR: stays `tiili dev build`. Release: stays `tiili v1.2.3`.

## Assumptions
- The lookup runs once when Vite loads its config, with a short timeout, never failing the build (rather than failing loudly).
- Only the settings footer changes, not the splash (the card names settings).
