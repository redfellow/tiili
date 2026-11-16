## Why

The release pipeline leaks more than it should and can ship the wrong commit: Apple signing secrets reach every npm
install script, the write-capable GITHUB_TOKEN stays in `.git/config`, a third-party action runs from a moving branch
before the updater key is set, `npm run release` can push a stale local tag, and `npm run bundle` breaks on Windows
without the updater key. The packaging spec still describes the old bump-and-commit release flow, and agents follow it.

## What Changes

- `.github/workflows/release.yml`: the Apple signing step moves after `npm ci` (next to "Updater signing key"); all
  three `actions/checkout@v4` steps get `persist-credentials: false`; `dtolnay/rust-toolchain` is pinned to commit
  `df2a88e9fe4098bad09cb42c3dec7187f15861fc` with `toolchain: stable`. This is a human-only path, applied in Triage.
- `scripts/release.mjs`: `tagMain` reuses a local tag only when it points at origin/main's commit; otherwise it
  re-creates it there (`git tag -f -a`) before pushing.
- `scripts/bundle.mjs`: runs `node_modules/@tauri-apps/cli/tauri.js` with `process.execPath` and no shell, so the
  `--config` JSON reaches tauri intact on Windows.
- Packaging spec: "Release command" and "Release build on tag" describe the tag-stamped flow.

## Assumptions

- The tag decision is pulled out of `tagMain` into a small exported pure function and table-tested, rather than proved
  with a throwaway git repo; ruled out: a test that drives real git.
- The rust-toolchain SHA is master's head on 2026-11-16 (`df2a88e…`); ruled out: looking it up again at build time.
- The "Dirty tree" scenario now says the release ignores local changes (it tags origin/main); ruled out: adding a
  dirty-tree check to the script.
