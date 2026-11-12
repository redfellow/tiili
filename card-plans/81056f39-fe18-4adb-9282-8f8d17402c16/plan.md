# Allow the scaffold build to reach GitHub release downloads

## Why
The scaffold card (scaffold-the-tiili-app-one-window-one-wo) has to download Geist Mono in its task 3.2, and GitHub isn't on the allowlist. Main already allows the four registries (npm and crates.io, commit c1a11f2, #5), so the real gap is GitHub only; without it the proxy returns 403 for the font download.

## What Changes
- `.harvaaja/network.yaml` keeps the four registries main already allows and adds github.com, release-assets.githubusercontent.com (where GitHub release asset downloads redirect to) and objects.githubusercontent.com (the older redirect target, kept as a fallback). This is a human-only path, so it's a triage task.
- No spec change: this is workspace config only, with no product behaviour.

## Acceptance
- After triage, `npm ci` / `cargo fetch` still work and the Geist Mono release download works from the build sandbox.

## Citations
- `.harvaaja/network.yaml` (on main: the four registries, no GitHub host)
- Scaffold change tasks.md, task 5.2 (the four registries) and task 3.2 (vendored Geist Mono)

## Assumptions
- The user picked "allow GitHub hosts" for the font, over vendoring it by hand or using the npm package.
- Since 2025 GitHub redirects release asset downloads (github.com/<owner>/<repo>/releases/download/...) to release-assets.githubusercontent.com, so that host is added. objects.githubusercontent.com stays as a fallback for the older redirect. Ruled out: github.com alone.
