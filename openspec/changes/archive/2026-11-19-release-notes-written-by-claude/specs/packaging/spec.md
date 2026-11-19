## ADDED Requirements

### Requirement: Release notes written by Claude
On a terminal with the `claude` CLI, `npm run release` SHALL, before it tags, have Claude write the notes' "What's new" from the descriptions of the release's pull requests, ordered by impact and worded for users. It SHALL show them and ask whether to use them, edit them first or keep the workflow's notes. Chosen notes SHALL be on the published release and in its `latest.json`.

#### Scenario: Notes accepted
- **WHEN** `npm run release minor` runs on a terminal and the user answers y to Claude's notes
- **THEN** the tag is pushed after the answer, and the published release and its `latest.json` carry those notes

#### Scenario: Notes declined
- **WHEN** the user answers n
- **THEN** the release has the notes the release workflow wrote

### Requirement: Workflow's notes without Claude
Off a terminal, without the `claude` CLI, with `TIILI_RELEASE_NOTES=auto` or when Claude gives no bullet list, `npm run release` SHALL say why and release with the workflow's notes.

#### Scenario: Off a terminal
- **WHEN** `npm run release patch` runs with its output going to a file
- **THEN** it releases with the workflow's notes without asking

#### Scenario: Claude fails
- **WHEN** `claude` is missing or gives no bullet list
- **THEN** the command says so and releases with the workflow's notes
