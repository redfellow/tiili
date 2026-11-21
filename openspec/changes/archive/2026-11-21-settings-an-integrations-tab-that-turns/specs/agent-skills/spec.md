## ADDED Requirements

### Requirement: Removing the skill
Turning the Claude Code tiili-tiles skill off in the Integrations tab SHALL remove the `~/.claude/skills/tiili-tiles` folder and leave other skills alone. `tiili install-claude-skill` SHALL keep working.

#### Scenario: Turn off
- **WHEN** the skill is installed and the user unticks it and saves
- **THEN** `~/.claude/skills/tiili-tiles` is gone and other folders in `~/.claude/skills` remain
