# app-updates Specification

## Purpose
Keep an installed tiili up to date from its latest GitHub release, with the user's consent and a single anonymous request.

## Requirements

### Requirement: Daily update check
When automatic checks are on, the first tiili window SHALL check `https://github.com/redfellow/tiili/releases/latest/download/latest.json` at startup, at most once in 24 hours, and send nothing else.

#### Scenario: Checked today already
- **WHEN** tiili starts 3 hours after the last check
- **THEN** no request is made

#### Scenario: Checks off
- **WHEN** automatic checks are off and tiili starts
- **THEN** no request is made

### Requirement: Install update prompt
When a newer version than the running one is found and it is not the skipped version, tiili SHALL show an "Install update?" dialog with the new and current versions, the release notes, and Install now, Later and Skip this version. Install now SHALL download and install the update with visible progress and restart tiili; a failure SHALL be shown in the dialog. Later SHALL close it. Skip this version SHALL close it and stop automatic checks from offering that version.

#### Scenario: Skip a version
- **WHEN** the user skips 0.3.0 and the next day's check finds 0.3.0
- **THEN** no dialog is shown

#### Scenario: A newer version after a skip
- **WHEN** 0.3.0 was skipped and a check finds 0.3.1
- **THEN** the dialog is shown

### Requirement: Linux deb installs
On Linux installed from the `.deb`, tiili SHALL NOT install updates itself; it SHALL show "A new version is available" with the release notes and a link to the release page.

#### Scenario: Deb install finds an update
- **WHEN** a `.deb` install finds a newer version
- **THEN** the dialog offers Open release page instead of Install now

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
