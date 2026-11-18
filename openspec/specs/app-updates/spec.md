# app-updates Specification

## Purpose
Keep an installed tiili up to date from its latest GitHub release, with the user's consent and a single anonymous request.

## Requirements

### Requirement: Daily update check
When automatic checks are on, the first tiili window SHALL check `https://github.com/redfellow/tiili/releases/latest/download/latest.json` at startup and whenever it gains focus, at most once in 24 hours, and send nothing else. A check SHALL NOT open a second update dialog while one is open.

#### Scenario: Checked today already
- **WHEN** tiili starts 3 hours after the last check
- **THEN** no request is made

#### Scenario: Checks off
- **WHEN** automatic checks are off and tiili starts
- **THEN** no request is made

#### Scenario: Focused a day later
- **WHEN** tiili has been open for 25 hours since the last check and the user focuses its window
- **THEN** one request is made

#### Scenario: Focused soon after a check
- **WHEN** the user focuses the window 2 hours after the last check
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
The update dialog SHALL show the release body rendered as basic Markdown (headings, paragraphs, lists, bold, italic, inline code and links), with a link to the release page, and SHALL NOT show `<details>` blocks, the Full changelog line, HTML tags or Markdown markers as text. Only `https:` links SHALL be clickable, opening in the system browser; other links show their text.

#### Scenario: Body with What's new
- **WHEN** the release body has a What's new list followed by a details block and a Full changelog line
- **THEN** the dialog shows the What's new heading and its items as a list, without the details block or changelog line, and a See all changes link

#### Scenario: Body without What's new
- **WHEN** the release body has a `Highlights` heading and items like `- **Tabs in a window.** Open several tabs`
- **THEN** the dialog shows a heading and a list whose items start with bold text, with no `#`, `-` or `**` markers

#### Scenario: Unsafe link
- **WHEN** the body contains `[x](javascript:alert(1))`
- **THEN** the dialog shows `x` as plain text, not a link
