## ADDED Requirements

### Requirement: Asset catalog in step with the icon bundle
Compiling the macOS app icon SHALL record a fingerprint of the Icon Composer bundle it compiled beside `Assets.car`. The icon check SHALL fail when the fingerprint is missing or differs from the committed bundle, so that the icon macOS shows at launch and while tiili is closed is always the current design.

#### Scenario: Bundle changed without recompiling
- **WHEN** `AppIcon.icon` changes and `Assets.car` is not recompiled
- **THEN** the icon check fails and names the stale `Assets.car`

#### Scenario: Recompiled asset catalog
- **WHEN** `Assets.car` is compiled from the committed `AppIcon.icon`
- **THEN** the icon check passes

#### Scenario: Launching shows the current icon
- **WHEN** tiili is installed with `npm run install-app` and launched
- **THEN** the Dock shows the current light or dark icon from the first moment, with no older design before the run-time icon appears
