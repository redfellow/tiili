## Purpose

Let coding agents drive tiili: a Claude Code skill that fans work out into tiili tiles, starting with side-by-side pull request reviews, and a command that installs it.

## ADDED Requirements

### Requirement: Fan-out skill opens one tile per task
The tiili-tiles Claude Code skill SHALL open one tiili tile per task with `tiili open --cwd <dir> -- claude "<prompt>"`, and its first recipe SHALL be pull request review.

#### Scenario: Reviewing named pull requests
- **WHEN** the user asks the skill to review PRs 12 and 15 in a git repository
- **THEN** each PR gets its own fresh git worktree checked out with `gh pr checkout` and one tile running a Claude review session for that PR

#### Scenario: No pull requests named
- **WHEN** the user names no PRs
- **THEN** the skill takes the three most recent open PRs from `gh pr list`

#### Scenario: Missing tools
- **WHEN** `gh`, `claude` or `tiili` is not on PATH, or `gh` is not signed in
- **THEN** the skill says which one and opens no tiles

### Requirement: Installing the skill
`tiili install-claude-skill` SHALL write the bundled skill to `~/.claude/skills/tiili-tiles/SKILL.md`, creating folders as needed, print the path and exit without opening a window.

#### Scenario: Fresh install
- **WHEN** the user runs `tiili install-claude-skill` and `~/.claude/skills` does not exist
- **THEN** the folder is created, the skill file written and its path printed

#### Scenario: Reinstall
- **WHEN** the skill file already exists
- **THEN** it is overwritten with the bundled version
