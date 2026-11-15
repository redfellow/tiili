## ADDED Requirements

### Requirement: Skill lists the agent intents
The tiili-tiles skill SHALL carry the agent intents and their recipes generated from tiili's intent table, and a test SHALL fail when they differ.

#### Scenario: Table changes
- **WHEN** an intent's recipe changes in the table but not in SKILL.md
- **THEN** the intents test fails
