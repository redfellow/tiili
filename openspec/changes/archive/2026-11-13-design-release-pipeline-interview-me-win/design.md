## Approach

Split the release in two: a local Node script (`scripts/release.mjs`) owns versioning and tagging, and CI owns
building, because each installer must be built on its own OS.

- `scripts/release.mjs` exports pure helpers `bumpVersion(version, kind)` and `setVersion*` text rewriters for
  `Cargo.toml` (only the `[package]` `version` line) and the JSON files, so the version logic is unit tested
  without git. The CLI part runs `git status --porcelain` (must be empty), rewrites the files, runs
  `npm install --package-lock-only` to sync the lockfile, commits, tags `vX.Y.Z` and runs
  `git push --follow-tags`. Cargo.lock is updated by running `cargo update -p tiili --manifest-path src-tauri/Cargo.toml`
  when present.
- `scripts/bundle.mjs` switches Windows to `--bundles nsis`; `tauri.conf.json` targets `nsis` instead of `msi`.
- Workflow: matrix `macos-latest`, `windows-latest`, `ubuntu-22.04`; a first job creates the draft release
  (`gh release create --draft --generate-notes`, idempotent); each build job runs `npm ci`, `npm run bundle`, then
  `gh release upload --clobber`. Signing secrets are copied into `$GITHUB_ENV` only when non-empty, because Tauri may
  treat an empty variable as set (noted in docs/packaging.md).
- The workflow also checks that the tag equals `v` + `package.json` version and fails otherwise.

## Why

Keeps one command for Reijo, builds natively per platform, and changes nothing about local `npm run bundle` except the
Windows format.
