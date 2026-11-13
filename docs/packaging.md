# Packaging tiili

tiili is packaged with Tauri's bundler. One command builds the installers for the platform you are on:

```sh
npm run bundle
```

The installers land under `src-tauri/target/**/bundle/`. Builds are unsigned unless the signing variables
below are set. Product name, version and descriptions come from `src-tauri/tauri.conf.json`; the version is
read from `package.json` (`"version": "../package.json"`), so it is never edited there; `npm run release`
bumps it (see [Releasing](#releasing)).

| Platform | Installers | What `npm run bundle` runs |
| --- | --- | --- |
| macOS | one universal `.dmg` (Apple Silicon + Intel) | `tauri build --target universal-apple-darwin --bundles dmg` |
| Windows | NSIS setup `.exe` | `tauri build --bundles nsis` |
| Linux | `.AppImage` and `.deb` | `tauri build --bundles appimage,deb` |

Bundling only works on the matching OS: there is no cross-building. Extra arguments are passed on to
`tauri build`, for example `npm run bundle -- --verbose`.

Cargo runs with `--no-default-features`. That leaves out `dev-bridge`, the browser dev server's shell bridge
(`src-tauri/src/bin/dev-bridge.rs`), which needs the default `dev-bridge` feature: Tauri's bundler puts every binary
of the package into the installers, and the bridge must never reach users. Plain `cargo build`, `cargo test` and
`cargo clippy` keep the feature on, so they still build and test it.

## Installing on this Mac

To try a build as a real Mac app, run:

```sh
npm run install-app
```

It runs `tauri build --bundles app` (without default features, as above) for this Mac's chip (no `.dmg`, no universal binary), quits tiili if it is
running, replaces `/Applications/tiili.app` with the new build, and adds tiili to the Dock if it is not pinned
yet. Pinning edits the `com.apple.dock` `persistent-apps` defaults and restarts the Dock with `killall Dock`;
running the command again replaces the app and leaves the Dock alone. It runs only on macOS and exits with an
error elsewhere.

## Prerequisites

All platforms need Node.js with `npm ci` run, and Rust through rustup.

- **macOS**: Xcode Command Line Tools, and both Rust targets for the universal build:
  `rustup target add aarch64-apple-darwin x86_64-apple-darwin`.
- **Windows**: the Microsoft C++ Build Tools and WebView2 (preinstalled on Windows 10 and 11). The setup `.exe`
  is built with NSIS, which Tauri downloads on the first build.
- **Linux**: webkit2gtk 4.1 and its build dependencies (on Debian and Ubuntu: `libwebkit2gtk-4.1-dev
  build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`). The
  AppImage tools are downloaded by Tauri. The `.deb` package's dependencies are declared by Tauri.

## Icons

The app icons in `src-tauri/icons/` are generated from `docs/brand/logo/icon-light.svg`; sizes of 32 px and
below come from `icon-light-small.svg`. After changing the logo, run `npm run icons` and commit the results.

The script also writes `app-light.png` and `app-dark.png`, which the app embeds and swaps in while it runs so its
icon follows the OS light or dark mode: the Dock icon on macOS, the window and taskbar icon on Windows and Linux. On
macOS the Settings dialogue's Dock icon choice can pin it to the light or the dark icon instead. The installed bundle
keeps the light icon, so that is what the Dock shows while tiili is not running.

`scripts/icons.test.ts` checks that every icon each platform needs is present at the right size.

## Signing and notarisation

Signing is off by default: `signingIdentity` and `certificateThumbprint` are unset in `tauri.conf.json`, and
a build without the variables below succeeds unsigned. Signing is switched on through environment variables
only.

**Where secrets go**: in your shell environment for a local build, or in the CI provider's encrypted secrets
for a release build. Never in the repository: not in `tauri.conf.json`, not in a committed `.env` file.
`.gitignore` ignores certificate and key files (`*.p12`, `*.pfx`, `*.p8`) so they are not committed by
accident; keep them outside the checkout anyway.

### macOS: signing and notarisation

Needs an Apple Developer account and a "Developer ID Application" certificate.

| Variable | What it holds |
| --- | --- |
| `APPLE_CERTIFICATE` | The certificate exported as `.p12`, base64-encoded (`base64 -i cert.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | The password the `.p12` was exported with |
| `APPLE_SIGNING_IDENTITY` | The identity name, e.g. `Developer ID Application: Name (TEAMID)` |

`APPLE_CERTIFICATE` and its password are only needed where the certificate is not already in the keychain
(such as CI). Notarisation needs one of two sets of credentials:

- Apple ID: `APPLE_ID`, `APPLE_PASSWORD` (an app-specific password, not the account password) and
  `APPLE_TEAM_ID`.
- App Store Connect API key: `APPLE_API_KEY` (the key ID), `APPLE_API_ISSUER` (the issuer ID) and
  `APPLE_API_KEY_PATH` (the path to the `.p8` private key file).

With these set, `npm run bundle` signs and notarises the universal `.dmg`.

### Windows: code signing

Needs a code signing certificate. Set it through a `TAURI_CONFIG` override, which Tauri merges into
`tauri.conf.json` at build time, so nothing is committed:

- A certificate installed in the Windows certificate store, by thumbprint:

  ```powershell
  $env:TAURI_CONFIG = '{"bundle":{"windows":{"certificateThumbprint":"<THUMBPRINT>","digestAlgorithm":"sha256","timestampUrl":"http://timestamp.digicert.com"}}}'
  npm run bundle
  ```

- Or a custom signing command (for example a cloud HSM or `relic`), where `%1` is the file to sign:

  ```powershell
  $env:TAURI_CONFIG = '{"bundle":{"windows":{"signCommand":"<tool> sign %1"}}}'
  ```

In CI, import the `.pfx` from a base64 secret into the certificate store first and pass its password from a
secret.

### Linux

No signing. The `.AppImage` and `.deb` are built unsigned.

## Platform differences

- **macOS**: the `.dmg` holds one universal binary; `lipo -archs` on it shows `x86_64 arm64`. Without
  notarisation, Gatekeeper warns on first launch (open with right-click → Open).
- **Windows**: the setup `.exe` (`tiili_<version>_x64-setup.exe`) is built with NSIS, downloaded by Tauri on
  the first build. Unsigned installers trigger a
  SmartScreen warning.
- **Linux**: needs webkit2gtk and the AppImage tools on the build host. Build on the oldest distribution you
  want to support (glibc is linked dynamically), such as Ubuntu 22.04.

## Releasing

One command cuts a release from a clean checkout:

```sh
npm run release patch   # or minor, major
```

It refuses to run without a kind (`patch`, `minor` or `major`) or with uncommitted changes. Otherwise it bumps the
version in `package.json`, `package-lock.json` (through `npm install --package-lock-only`), `src-tauri/Cargo.toml`
and `src-tauri/Cargo.lock` (through `cargo update -p tiili`), commits `Release vX.Y.Z`, tags it `vX.Y.Z` and
pushes the commit and the tag. `src-tauri/tauri.conf.json` is left alone: it takes its version from
`package.json`. The command does not insist on a branch; release from the one you mean to.

### What CI does

The tag starts `.github/workflows/release.yml`:

1. It fails unless the tag is `v` + the version in `package.json`.
2. It creates a draft GitHub Release for the tag with generated notes (or reuses the draft if it exists).
3. It builds on `macos-latest`, `windows-latest` and `ubuntu-22.04` with `npm ci` and `npm run bundle`, and
   uploads the universal `.dmg`, the setup `.exe`, the `.AppImage` and the `.deb` to the draft.

Signing stays off until its secrets exist. The workflow copies each macOS signing secret (`APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) into the
build's environment only when it is set, because Tauri may treat an empty variable as set and try to sign.
Adding the secrets in the repository settings turns signing on with no edit to the workflow. For Windows signing,
add a step before `npm run bundle` that imports the certificate and sets `TAURI_CONFIG` as shown above.

### Publishing

The release stays a draft. When all three build jobs have finished, open the draft on GitHub, check it holds the
`.dmg`, the `-setup.exe`, the `.AppImage` and the `.deb`, and publish it by hand.
