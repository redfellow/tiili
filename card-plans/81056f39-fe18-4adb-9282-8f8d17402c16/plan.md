# Allow the scaffold build to reach npm, crates.io and GitHub

## Why
The scaffold card (scaffold-the-tiili-app-one-window-one-wo) can't install dependencies, write lockfiles or run its proofs: `.harvaaja/network.yaml` has `allow: []`, so the proxy returns 403 for every host. Its task 3.2 also has to download Geist Mono, and GitHub isn't on the task 5.2 list.

## What Changes
- `.harvaaja/network.yaml` allows registry.npmjs.org, index.crates.io, static.crates.io, crates.io, github.com and objects.githubusercontent.com (GitHub release downloads redirect there). This is a human-only path, so it's a triage task.
- No spec change: this is workspace config only, with no product behaviour.

## Acceptance
- After triage, `npm ci` / `cargo fetch` and the Geist Mono release download work from the build sandbox.

## Citations
- `.harvaaja/network.yaml` (currently `allow: []`)
- Scaffold change tasks.md, task 5.2 (the four registries) and task 3.2 (vendored Geist Mono)

## Assumptions
- The user picked "allow GitHub hosts" for the font, over vendoring it by hand or using the npm package.
- objects.githubusercontent.com is added because GitHub release assets redirect there. Ruled out: github.com alone.
