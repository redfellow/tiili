## Why
When tiili launches (and while it is closed), macOS shows an old icon design. It comes from
`src-tauri/icons/Assets.car`, which wasn't recompiled when the icon was redesigned in #147: the Icon Composer
bundle `AppIcon.icon` and every other icon file changed, but `Assets.car` didn't. Once tiili is running, it sets
the current light or dark icon itself, which is why the old icon only shows at launch.

## What Changes
- `scripts/app-icon.mjs` records a fingerprint of the `AppIcon.icon` bundle beside `Assets.car`
  (`src-tauri/icons/Assets.car.source`) each time it compiles it.
- The icon check fails when that fingerprint is missing or doesn't match the committed `AppIcon.icon`, so a
  stale `Assets.car` can't be merged unnoticed again.
- The app-icon workflow uploads the fingerprint together with `Assets.car` (a triage change to a human-only file).
- `Assets.car` is recompiled from the current bundle. This needs Xcode 26, so Reijo runs the app-icon workflow
  and commits both files.
- The running icon keeps following the OS light or dark mode, and the macOS Dock icon setting still lets you pin
  one of them. Nothing changes there.

## Outcome
- Launching tiili, or tiili closed in the Dock and Finder
  - Now: the old icon design, before #147
  - After: the current icon (one wide brick with `>_`), dark or light to match the OS appearance

## Assumptions
- The fingerprint is a SHA-256 over `icon.json` and the `Assets/*.png` files of the bundle, in sorted path order.
  The alternative, decoding `Assets.car` and comparing its images, was ruled out as fragile.
- Until the recompiled `Assets.car` and its fingerprint are committed, the new check fails. The pull request
  therefore needs Reijo's workflow run before it can merge. Ruled out: skipping the check when the fingerprint
  is missing, which would let the stale icon merge.
