## ADDED Requirements

### Requirement: Zen width setting
The Behaviour tab SHALL have a "Zen width" field in columns, default 140, range 80–400, saved with the settings and applied in every window. A missing or invalid saved value SHALL fall back to 140; an out-of-range value SHALL clamp.

#### Scenario: Invalid saved Zen width
- **WHEN** the settings file has a Zen width of `"wide"`
- **THEN** the Zen width is 140 and the other settings load
