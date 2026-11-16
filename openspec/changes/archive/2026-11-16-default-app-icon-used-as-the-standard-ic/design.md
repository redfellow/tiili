## Approach
`compile(iconPath, carPath)` in `scripts/app-icon.mjs` already builds `Assets.car`. A new exported pure helper,
`iconFingerprint(iconPath)`, hashes `icon.json` and `Assets/*.png` (relative path plus bytes, in sorted order)
with SHA-256. After a successful compile, `compile` writes that hash to `<carPath>.source`. `scripts/icons.test.ts`
recomputes the fingerprint of `src-tauri/icons/AppIcon.icon` and compares it with `Assets.car.source`, so any
change to the bundle that isn't followed by a recompile fails the fast unit tests.

Recompiling needs Xcode 26's actool, which neither the sandbox nor this Mac has. The existing `app-icon` workflow
(macOS 26 runner) does the compile. It has to upload `Assets.car.source` as well, and the workflow file is
human-only, so that edit is a triage task.
