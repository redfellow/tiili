## Why

tiili can only be run from a dev build. People need installers for macOS, Windows and Linux. Signing should be ready to switch on later, without any secret stored in the repository.

## What Changes

- Release builds through Tauri's bundler. macOS gets one universal `.dmg` (Apple Silicon + Intel). Windows gets `.msi`. Linux gets `.AppImage` and `.deb`.
- App icons for every platform are generated from `docs/brand/logo/icon-light.svg`. Sizes of 32 px and below use `icon-light-small.svg`.
- Metadata: product name `tiili`, the version from `package.json`, and a short description from `docs/concept.md`.
- Code signing and notarisation are prepared but off by default. `docs/packaging.md` documents the secrets they need (Apple certificate, Apple ID or API key, Windows certificate) and where they go (environment variables or CI secrets, never the repository).
- `npm run bundle` builds the installers for the current platform. On macOS it builds the universal `.dmg`.
- Proposed CI release workflow: documented in design.md only. `.github/workflows` is the owner's to add.

## Outcome

- Building locally
  - After: `npm run bundle` puts the host's installers under `src-tauri/target/**/bundle/`
- Installed app
  - After: the app is listed as `tiili` with the brick icon

## Assumptions

- This change builds on the scaffold change (`src-tauri/`, `package.json`). The build merges `origin/main` once that change has landed. Ruled out: scaffolding again here.
- Unsigned builds are the default. Ruled out: requiring certificates for a local build.
- Signing is switched on through environment variables. Ruled out: committed per-developer config.
- Icons are rendered with `@resvg/resvg-js` (a devDependency) from a Node script, then passed to `tauri icon`. Ruled out: needing ImageMagick or Inkscape on the host.
- Ruled out: an app store listing, auto-update and publishing (out of scope).
