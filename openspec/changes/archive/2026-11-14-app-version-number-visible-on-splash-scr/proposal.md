## Why
Reijo wants to see which tiili build is running: "Show version number in splash and in settings."

## What Changes
- The app version (from `package.json`, which Tauri also uses) is baked into the frontend at build time.
- The startup splash shows the version, small and muted, at the bottom-right corner; it leaves with the splash.
- The settings dialogue footer shows the version at its left, before Reset to defaults, Cancel and Save.

## Outcome
- Splash, bottom-right corner
  - After: `v0.1.1`
- Settings footer, left
  - After: `tiili 0.1.1`

## Assumptions
- The version comes from `package.json` via a Vite `define`, not from Tauri's `getVersion()` at runtime (same value; works in the browser dev preview and needs no async call).
- Splash places it bottom-right as `v<version>`; ruled out putting it under the wordmark, which would compete with the animation.
- Settings places it in the footer on every tab; ruled out a new About tab or section.
- Not shown in the top bar or app menu.
