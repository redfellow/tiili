## MODIFIED Requirements

### Requirement: macOS bundle icon follows the appearance
The macOS app bundle SHALL carry an asset catalog icon, compiled from the light and the dark brand icons, so that Finder and the Dock show the icon matching the OS appearance while tiili is not running. Both icons SHALL be a near-black tile with one wide brick holding `>_` in its centre. The bundle SHALL keep `icon.icns` as the fallback for systems without asset catalog icons.

#### Scenario: Closed app in dark mode
- **WHEN** tiili is installed with `npm run install-app`, is not running, and the Mac's icon style is Dark
- **THEN** the Dock and Finder show the dark icon (near-black tile, savi brick with a near-black `>_`)

#### Scenario: Closed app in light mode
- **WHEN** tiili is installed, is not running, and the Mac's icon style is Default in light mode
- **THEN** the Dock and Finder show the light icon (near-black tile, klinkkeri brick with a white `>_`)

#### Scenario: Appearance icon check
- **WHEN** the icon check runs on macOS
- **THEN** it passes only if `Assets.car` holds the app icon in both the light and the dark appearance
