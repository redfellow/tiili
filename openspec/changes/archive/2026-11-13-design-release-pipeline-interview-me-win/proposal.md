## Why

tiili has local installers (`npm run bundle`) but no way to cut a release: a Mac cannot build the Windows or Linux
installers, versions live in three files, and nothing publishes the result. Reijo wants one command that releases
tiili with a Windows `.exe`, a universal macOS `.dmg` and Linux packages.

## What Changes

- New `npm run release <patch|minor|major>`: checks the working tree is clean, bumps the version in `package.json`,
  `package-lock.json` and `src-tauri/Cargo.toml` together (`src-tauri/tauri.conf.json` takes its version from
  `package.json`), commits `Release vX.Y.Z`,
  tags `vX.Y.Z` and pushes the commit and tag.
- New GitHub Actions workflow `.github/workflows/release.yml` (human-only path, approved in Triage): on a `v*` tag
  it builds on macOS, Windows and Linux runners with `npm run bundle` and attaches the installers to a draft GitHub
  Release for that tag.
- Windows installer changes from `.msi` to Tauri's NSIS setup `.exe` (bundle target `nsis`).
- Linux stays `.AppImage` + `.deb` (x86_64); macOS stays a universal `.dmg`.
- Signing stays off; the workflow passes the signing variables only from secrets that are set, so adding secrets
  later turns signing on with no edit.
- `docs/packaging.md` documents the release flow and the `.exe`.

## Outcome

- Releasing
  - Now: no release command
  - After: `npm run release minor` → tag `v0.2.0` pushed, draft release with `tiili_0.2.0_universal.dmg`, `tiili_0.2.0_x64-setup.exe`, `.AppImage`, `.deb`
- Windows installer
  - Now: `tiili_0.1.0_x64_en-US.msi`
  - After: `tiili_0.1.0_x64-setup.exe`

## Assumptions

- The release is created as a draft that Reijo publishes by hand; ruled out auto-publishing.
- The command refuses a dirty tree but does not insist on branch `main`; ruled out enforcing a branch name.
- Linux builds on `ubuntu-22.04` for wide glibc compatibility; ruled out `ubuntu-latest`.
- The workflow uses plain steps and the `gh` CLI to create and upload the release; ruled out the third-party
  `tauri-action`.
