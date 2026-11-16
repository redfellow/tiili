## MODIFIED Requirements

### Requirement: Release command
The project SHALL provide `npm run release <patch|minor|major|x.y.z>`. It SHALL refuse an unknown argument. It SHALL take the version from the highest `vX.Y.Z` tag on GitHub bumped by the argument, tag origin/main's commit `v<version>` without making a commit, push only the tag, follow the release workflow and publish the draft once the workflow succeeds. An unpublished earlier release SHALL be finished first.

#### Scenario: Minor release
- **WHEN** the highest tag on GitHub is `v0.1.3`, it is published, and `npm run release minor` runs
- **THEN** the tag `v0.2.0` is pushed at origin/main's commit, no commit is made, and the release is published after its workflow succeeds

#### Scenario: Dirty tree
- **WHEN** `npm run release patch` runs with uncommitted changes in the checkout
- **THEN** it tags origin/main's commit, so the uncommitted changes are neither released nor touched

#### Scenario: Unpublished release resumed
- **WHEN** `v0.2.0` is tagged but its release is still a draft and `npm run release patch` runs
- **THEN** it finishes and publishes `v0.2.0` instead of cutting `v0.2.1`

#### Scenario: Stale local tag
- **WHEN** a local tag `v0.2.0` points at an older commit than origin/main and is not on GitHub
- **THEN** the tag is moved to origin/main's commit before it is pushed

### Requirement: Release build on tag
Pushing a tag `v<version>` SHALL build the installers on macOS, Windows and Linux with the version stamped from the tag, and attach them to a draft GitHub Release for that tag. A tag that is not `vX.Y.Z` SHALL fail the build. Signing variables SHALL be passed only from secrets that are set, and only after dependencies are installed, so the release is unsigned when none are.

#### Scenario: Tag pushed
- **WHEN** the tag `v0.2.0` is pushed
- **THEN** a draft release `v0.2.0` holds the Apple Silicon `.dmg`, the setup `.exe`, the `.AppImage` and the `.deb`, all reporting version `0.2.0`

#### Scenario: Tag and version disagree
- **WHEN** the tag `v0.3.0` is pushed and the repository's version files hold another version
- **THEN** the build stamps `0.3.0` from the tag into them before bundling and the installers report `0.3.0`

#### Scenario: Tag is not a version
- **WHEN** the tag `v0.3` is pushed
- **THEN** the release build fails before bundling
