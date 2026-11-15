## ADDED Requirements

### Requirement: What's new after an in-app update
When the user chooses Install now, tiili SHALL save the new version and its release's What's new items locally before installing. On the first start of the first window where the running version equals the saved version, tiili SHALL show a "What's new in tiili X.Y.Z" panel with at most 6 of those items, a "See all changes" link to the release page and a Close button, and SHALL then clear the saved entry. It SHALL make no network request for this.

#### Scenario: Shown once after updating
- **WHEN** the user installs 0.4.0 with Install now and tiili restarts as 0.4.0
- **THEN** the What's new panel for 0.4.0 is shown, and it is not shown on the next start

#### Scenario: Version does not match
- **WHEN** a saved entry names 0.4.0 and tiili starts as 0.3.0
- **THEN** no panel is shown and the entry is cleared

#### Scenario: Updated outside the app
- **WHEN** tiili starts with no saved entry
- **THEN** no panel is shown

### Requirement: Release notes in the update dialog
The update dialog SHALL show the items under the release body's What's new heading as a list, with a link to the release page for the rest, and SHALL NOT show the raw body's headings, HTML, change list or changelog line. When the body has no What's new section, it SHALL show the body's text with HTML tags and markdown headings removed.

#### Scenario: Body with What's new
- **WHEN** the release body has a What's new list followed by a details block and a Full changelog line
- **THEN** the dialog lists only the What's new items and a See all changes link

#### Scenario: Body without What's new
- **WHEN** the release body has no What's new heading
- **THEN** the dialog shows its plain text without tags or heading markers
