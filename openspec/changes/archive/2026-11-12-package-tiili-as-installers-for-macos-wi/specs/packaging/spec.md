## ADDED Requirements

### Requirement: Installers per platform
The project SHALL build installers through Tauri's bundler: a universal `.dmg` on macOS, `.msi` on Windows, and `.AppImage` and `.deb` on Linux. Each installer SHALL carry the product name `tiili`, the version from `package.json` and the short description.

#### Scenario: Local bundle on the host
- **WHEN** a developer runs `npm run bundle`
- **THEN** the installers for the host platform are produced, unsigned by default

### Requirement: Complete icon set
The repository SHALL contain app icons generated from the brand SVGs at every size each platform expects. Sizes of 32 px and below SHALL come from the small icon.

#### Scenario: Icon set check
- **WHEN** the icon check runs
- **THEN** it passes only if every icon file required for macOS, Windows and Linux exists at the expected size

### Requirement: Signing off by default
Code signing and notarisation SHALL be configurable through environment variables only. They SHALL be off when those variables are unset, and no secret SHALL be stored in the repository.

#### Scenario: No secrets set
- **WHEN** `npm run bundle` runs without signing variables
- **THEN** the build succeeds unsigned
