## Approach

- **Config** (`src-tauri/tauri.conf.json`)
  - `productName: "tiili"`.
  - `version: "../package.json"`, so the version has one source.
  - `bundle.targets: ["dmg","msi","appimage","deb"]`, with `shortDescription`/`longDescription` from `docs/concept.md`.
  - `bundle.icon` lists the generated files.
  - `macOS.signingIdentity: null`. The Windows `certificateThumbprint` is unset.
- **Bundle command**: `scripts/bundle.mjs`, run as `npm run bundle`.
  - macOS: `tauri build --target universal-apple-darwin --bundles dmg`. Needs both rustup targets; documented.
  - Windows: `tauri build --bundles msi`.
  - Linux: `tauri build --bundles appimage,deb`.
  - Bundling only works on the matching OS, so there is no cross-building.
- **Icons**: `scripts/icons.mjs` rasterises `icon-light.svg` to a 1024 px PNG and runs `tauri icon`. It then re-renders the PNGs of 32 px and below (and their entries in the `.ico`) from `icon-light-small.svg`. Outputs are committed in `src-tauri/icons/`.
- **Icon check**: `scripts/icons.test.ts` (Vitest, fast tier). A table of required files per platform; it reads the PNG sizes from their headers.
- **Signing** (`docs/packaging.md`)
  - macOS: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, plus either `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` or `APPLE_API_KEY`/`APPLE_API_ISSUER`/`APPLE_API_KEY_PATH`.
  - Windows: a certificate thumbprint or `signCommand` set through `TAURI_CONFIG` overrides.
  - Linux: no signing.
  - These go in a shell environment or CI secrets. `.gitignore` adds `*.p12`, `*.pfx` and `*.p8`.
- **Proposed CI** (for the owner): a matrix workflow on macos-latest, windows-latest and ubuntu-22.04 running `npm ci && npm run bundle` and uploading the artifacts. It is not added here.

## Platform differences

- macOS: universal target, notarisation needs an Apple Developer account.
- Windows: the `.msi` needs WiX, which Tauri downloads on first build.
- Linux: needs webkit2gtk and the AppImage tools. The `.deb` dependencies are declared by Tauri.

## Why

Driving every platform from `tauri.conf.json` and one script keeps a single source for the metadata. Using environment variables keeps secrets out of git.

## Risks

- The bundles can't be built in the sandbox (no host toolchains or signing): building them is a host-tier manual check.
