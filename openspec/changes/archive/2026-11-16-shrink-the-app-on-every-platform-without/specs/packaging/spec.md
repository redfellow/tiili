## ADDED Requirements

### Requirement: Compact release build
Release builds SHALL use link-time optimisation, a single codegen unit, stripped symbols and abort on panic, so that the binaries carry no debug symbols or unwinding tables. The macOS `.dmg` that `npm run bundle` produces SHALL be compressed with lzma (ULMO). When a signing identity is set, the `.dmg` SHALL be signed after it is converted.

#### Scenario: DMG converted after the build
- **WHEN** `npm run bundle` finishes the Tauri build on macOS
- **THEN** the `.dmg` is converted to ULMO in place, and re-signed if `APPLE_SIGNING_IDENTITY` is set

#### Scenario: Unsigned local bundle
- **WHEN** `npm run bundle` runs on macOS without `APPLE_SIGNING_IDENTITY`
- **THEN** the `.dmg` is converted and left unsigned
