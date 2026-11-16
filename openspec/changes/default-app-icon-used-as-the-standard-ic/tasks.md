## 1. Fingerprint guard

- [ ] 1.1 Add `iconFingerprint(iconPath)` to `scripts/app-icon.mjs` (SHA-256 over sorted relative paths and bytes of `icon.json` and `Assets/*.png`), declare it in `scripts/app-icon.d.mts`, and make `compile` write it to `<carPath>.source` after a successful compile
  - proof: `npx eslint scripts/app-icon.mjs`
  - proof: `npm run typecheck`
- [ ] 1.2 In `scripts/icons.test.ts`, add `Assets.car.source` to the macOS appearance set and a test that its contents equal `iconFingerprint` of `src-tauri/icons/AppIcon.icon`, failing with a message that names the stale `Assets.car` and the app-icon workflow. Also add a small table-driven test showing that the fingerprint changes when a bundle file in a temp folder changes
  Tests to update: scripts/icons.test.ts
  - proof: `npx eslint scripts/icons.test.ts`
- [ ] 1.3 Update `docs/packaging.md` (and the header comment of `scripts/app-icon.mjs`) to say that `Assets.car.source` must be committed with every `Assets.car`
  - proof: `grep -n "Assets.car.source" docs/packaging.md scripts/app-icon.mjs`

## 2. Workflow

- [ ] 2.1 (triage) Upload the fingerprint with the compiled asset catalog
  file: .github/workflows/app-icon.yml
  content:
  ```yaml
  # Compiles the macOS app icon (src-tauri/icons/AppIcon.icon) into Assets.car with Xcode's actool, for when no Mac
  # with Xcode 26 is at hand. Run it by hand after `npm run icons` changed AppIcon.icon, download the Assets.car
  # artifact and commit both files it holds (Assets.car and Assets.car.source) to src-tauri/icons/. See docs/packaging.md.
  name: app-icon
  on:
    workflow_dispatch:

  permissions:
    contents: read

  jobs:
    assets-car:
      runs-on: macos-26
      steps:
        - uses: actions/checkout@v4
        - run: xcrun actool --version --output-format human-readable-text
        - run: node scripts/app-icon.mjs
        - uses: actions/upload-artifact@v4
          with:
            name: Assets.car
            path: |
              src-tauri/icons/Assets.car
              src-tauri/icons/Assets.car.source
            if-no-files-found: error
  ```

## Manual checks after merge (The user)

- Before merging, run the app-icon workflow on this branch and commit the `Assets.car` and `Assets.car.source` it uploads into `src-tauri/icons/`. The new icon check fails until you do.
- Run `npm run install-app`, quit tiili and launch it in dark mode, then in light mode. Each time the Dock shows the current icon from the start, with no older design before it.
