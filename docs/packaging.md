# Packaging tiili

tiili is packaged with Tauri's bundler. One command builds the installers for the platform you are on:

```sh
npm run bundle
```

The installers land under `src-tauri/target/**/bundle/`. Builds are unsigned unless the signing variables
below are set. Product name and descriptions come from `src-tauri/tauri.conf.json`; the version comes from
`src-tauri/Cargo.toml`, the only file that holds one (`package.json` has none, so npm's script banner shows no
version). Releases do not commit a version bump: the release workflow stamps the tag's version into the build (see
[Releasing](#releasing)), so the repository's `0.0.0-dev` is only a fallback.

| Platform | Installers | What `npm run bundle` runs |
| --- | --- | --- |
| macOS | `.dmg` for Apple Silicon (Intel Macs are not supported) | `tauri build --target aarch64-apple-darwin --bundles app,dmg` (the app target makes the updater bundle) |
| Windows | NSIS setup `.exe` | `tauri build --bundles nsis` |
| Linux | `.AppImage` and `.deb` | `tauri build --bundles appimage,deb` |

Bundling only works on the matching OS: there is no cross-building. Extra arguments are passed on to
`tauri build`, for example `npm run bundle -- --verbose`.

Cargo runs with `--no-default-features`. That leaves out `dev-bridge`, the browser dev server's shell bridge
(`src-tauri/src/bin/dev-bridge.rs`), which needs the default `dev-bridge` feature: Tauri's bundler puts every binary
of the package into the installers, and the bridge must never reach users. Plain `cargo build`, `cargo test` and
`cargo clippy` keep the feature on, so they still build and test it.

The installers also carry `tiili-cli` (`src-tauri/src/bin/tiili-cli.rs`), `tiili <command>` as a console program.
On Windows the app puts it in its `bin` folder as `tiili.exe`, the `tiili` its panes run: the app's own binary is a
GUI program there, which shells do not wait for.

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

It builds whatever is checked out and takes the version from git, not from `Cargo.toml`: on a release tag it is
that release's version (`0.3.0`), and past the last tag it is a dev version such as `0.3.1-dev.145+d2c41ae` (the next
patch, the number of commits since `v0.3.0` and the commit). A dev version sorts after the release it builds on and
before any later one, so the in-app updater does not offer the older release but does offer the next. Without a tag
it falls back to `Cargo.toml`'s version. The version is written into `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`
for the build only; the files are put back afterwards, also when the build fails or is
stopped.

To run code that is not on `main` yet, such as `hv/main`, build it from its own worktree so this checkout stays on
`main`:

```sh
git fetch origin && git worktree add ../tiili-hv-main origin/hv/main
cd ../tiili-hv-main && npm run install-app
```

## Prerequisites

All platforms need Node.js with `npm ci` run, and Rust through rustup.

- **macOS**: an Apple Silicon Mac with the Xcode Command Line Tools. Rust's host target is the one the build
  needs.
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
macOS the Settings dialogue's Dock icon choice can pin it to the light or the dark icon instead.

While tiili is not running, the macOS bundle icon follows the OS appearance as well. `npm run icons` writes
`src-tauri/icons/AppIcon.icon`, an Icon Composer bundle whose fill is the tile colour and whose single layer is the
icon's artwork, each with a light and a dark appearance. Apple's `actool` compiles it into `src-tauri/icons/Assets.car`,
which Tauri copies into the app and names in `CFBundleIconName`; `icon.icns` stays in the bundle as the fallback for
macOS before 11. Finder and the Dock show the dark icon when System Settings → Appearance → Icon & widget style is
Dark. The `.icon` bundle is drawn from the large icon only, so the closed app's smallest sizes don't use
`icon-light-small.svg`.

`actool` comes with Xcode 26 or later, not with the Command Line Tools. When it is installed, `npm run icons`
compiles `Assets.car` too. Otherwise, after the icon changed, push the branch, run the **app-icon** workflow
(`.github/workflows/app-icon.yml`, started by hand on a macOS 26 runner) on it, download its `Assets.car` artifact
and commit both files it holds, `src-tauri/icons/Assets.car` and `src-tauri/icons/Assets.car.source`. The second is
a SHA-256 fingerprint of `AppIcon.icon` written each time the bundle is compiled, so `Assets.car.source` must be
committed with every `Assets.car`. Builds only need the committed files, not Xcode.

`scripts/icons.test.ts` checks that every icon each platform needs is present at the right size, that
`AppIcon.icon/icon.json` matches the brand icons, that `Assets.car.source` matches the committed `AppIcon.icon` (so a
stale `Assets.car` fails the check), and, on macOS, that `Assets.car` holds the light and the dark appearance.

## Signing and notarisation

Without the variables below, Windows builds are unsigned (`certificateThumbprint` is unset) and macOS builds are
ad-hoc signed: `signingIdentity` is `"-"` in `tauri.conf.json`. Ad-hoc signing seals the whole `.app`. Without it
only the executable carries the linker's signature, and a downloaded copy (quarantined by the browser) is reported
as damaged with only "Move to Bin", and no **Open Anyway** in Privacy & Security. Real signing is switched on
through the environment variables below; `APPLE_SIGNING_IDENTITY` takes the place of `"-"`.

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

With these set, `npm run bundle` signs and notarises the `.dmg`. After Tauri's build, `npm run bundle` converts the
`.dmg` to lzma (ULMO), which drops its signature, so it signs the `.dmg` again with `APPLE_SIGNING_IDENTITY`. With
`APPLE_CERTIFICATE` set, it imports the certificate into a temporary keychain for that, because Tauri deletes its own
keychain when its build ends.

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

- **macOS**: the `.dmg` holds an Apple Silicon binary; `lipo -archs` on it shows `arm64`. Without
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

It refuses to run without a kind (`patch`, `minor` or `major`) or with uncommitted changes. Otherwise it tags
origin/main's commit `vX.Y.Z` (the highest tag bumped by the kind) and pushes only the tag; nothing is committed. The
release workflow stamps that version into `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock` before it builds
(`scripts/stamp-version.mjs`).

### What CI does

The tag starts `.github/workflows/release.yml`:

1. It fails unless the tag is a `vX.Y.Z` version.
2. It creates a draft GitHub Release for the tag with generated notes (or reuses the draft if it exists).
3. It builds on `macos-latest`, `windows-latest` and `ubuntu-22.04` with `npm ci` and `npm run bundle`, and
   uploads the `.dmg`, the setup `.exe`, the `.AppImage` and the `.deb` to the draft.

Signing stays off until its secrets exist. The workflow copies each macOS signing secret (`APPLE_CERTIFICATE`,
`APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) into the
build's environment only when it is set, because Tauri may treat an empty variable as set and try to sign.
Adding the secrets in the repository settings turns signing on with no edit to the workflow. For Windows signing,
add a step before `npm run bundle` that imports the certificate and sets `TAURI_CONFIG` as shown above.

### Updater bundles and `latest.json`

Installed tiili checks `https://github.com/redfellow/tiili/releases/latest/download/latest.json` once a day at
startup (Settings → Behaviour → Updates turns it off). That is one anonymous request to GitHub; nothing else is
sent. The updater only installs bundles signed with the key whose public half is `plugins.updater.pubkey` in
`src-tauri/tauri.conf.json`.

- Add the private key and its password as the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (made with `npx tauri signer generate`).
- With them, each build job also makes and uploads the signed updater bundle and its `.sig`: the `.app.tar.gz` on
  macOS, the setup `.exe` on Windows and the `.AppImage` on Linux. A `manifest` job then runs
  `scripts/updater-manifest.mjs` on the `.sig` files and the release notes and uploads `latest.json` to the draft.
- Without them, the installers are still built and uploaded, without updater bundles; the `manifest` job skips
  `latest.json` with a warning, so installed apps don't see that release. `npm run bundle` on your own machine
  works the same way: without `TAURI_SIGNING_PRIVATE_KEY` it leaves the updater bundles out.
- A `.deb` install can't replace itself, so when it finds a new version it shows the release notes with a link to
  the release page instead of installing.

### Publishing

The release stays a draft. When all three build jobs have finished, open the draft on GitHub, check it holds the
`.dmg`, the `-setup.exe`, the `.AppImage` and the `.deb` (and, with the updater secrets set, the updater bundles,
their `.sig` files and `latest.json`), and publish it by hand. Installed apps see a release only once it is
published, as GitHub's latest release.
