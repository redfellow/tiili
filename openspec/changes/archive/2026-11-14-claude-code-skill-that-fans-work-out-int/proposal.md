## Why

Reviewing several pull requests with coding agents means juggling checkouts and terminals by hand. tiili already tiles terminals and tints them by repository; a Claude Code skill can fan the work out into side-by-side tiles in one step.

## What Changes

- New Claude Code skill `integrations/claude/skills/tiili-tiles/SKILL.md`: a generic "spawn one tile per task with this prompt" recipe, with PR review as its first recipe. For PR review it runs `gh pr list`, takes the PRs the user named (or the three most recent open ones), creates a fresh git worktree per PR, runs `gh pr checkout <N>` inside it, and opens a tile with `tiili open --cwd <worktree> -- claude "<review prompt for PR #N>"`.
- The skill checks first that `gh`, `claude` and `tiili` are on PATH and that `gh auth status` succeeds, and says plainly which is missing.
- New CLI subcommand `tiili install-claude-skill` that writes the bundled skill into `~/.claude/skills/tiili-tiles/SKILL.md` (the skill text is embedded in the binary) and prints where it went.
- README: a short "Coding agents" section with both install routes (the command, or copying the file).

## Outcome

- Installing the skill
  - After: `tiili install-claude-skill` prints `Installed the tiili-tiles skill to ~/.claude/skills/tiili-tiles/SKILL.md`
- Reviewing PRs
  - After: three tiles, one per PR, sharing the repository tint, each chip naming its PR branch, each running a Claude review session.

## Assumptions

- The skill targets the `tiili open --cwd <dir> -- <cmd…>` form named on the depended-on card; ruled out: inventing another launch path.
- Worktrees go under `<repo>/../<repo>-pr-<N>` (reused if already present); ruled out: a temp folder that vanishes.
- Re-running the install command overwrites the existing skill file; ruled out: refusing when it exists.
- The install subcommand runs before the GUI starts and exits without opening a window; ruled out: a menu item.
