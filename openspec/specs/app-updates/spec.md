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
