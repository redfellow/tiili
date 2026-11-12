## 1. Icons

- [x] 1.1 Merge `origin/main` (needs the scaffold change). Add the devDependency `@resvg/resvg-js` and `scripts/icons.mjs` (`npm run icons`): rasterise `docs/brand/logo/icon-light.svg`, run `tauri icon`, and re-render the sizes of 32 px and below from `icon-light-small.svg`. Commit the outputs in `src-tauri/icons/`.
  - proof: `test -f src-tauri/icons/icon.icns && test -f src-tauri/icons/icon.ico && test -f src-tauri/icons/32x32.png`
- [x] 1.2 Add `scripts/icons.test.ts` (first line `// @harvaaja-test-tier: fast`). It is table-driven per platform and checks that each required file exists and that each PNG has the expected dimensions.
  - proof: `npx vitest run scripts/icons.test.ts`

## 2. Bundler and metadata

- [x] 2.1 Set up `tauri.conf.json`: product name `tiili`, version from `../package.json`, short and long descriptions, the targets dmg/msi/appimage/deb, the icon list, and signing unset.
  - proof: `grep -E '"productName": *"tiili"' src-tauri/tauri.conf.json`
- [x] 2.2 Add `scripts/bundle.mjs` and `npm run bundle`: a universal dmg on macOS, msi on Windows, appimage and deb on Linux.
  - proof: `npx eslint scripts/bundle.mjs scripts/icons.mjs`
  - proof: `npm run typecheck`

## 3. Signing docs

- [x] 3.1 Write `docs/packaging.md`. It covers the build command per platform, prerequisites, the signing and notarisation environment variables and where to keep them, the platform differences, and the proposed CI workflow. Also add `*.p12`, `*.pfx` and `*.p8` to `.gitignore`.
  - proof: `grep -E 'APPLE_SIGNING_IDENTITY' docs/packaging.md && grep -E 'p12' .gitignore`

## Manual checks after merge (The user)

- macOS: run `npm run bundle`. Check that the `.dmg` installs, that `lipo -archs` shows x86_64 and arm64, and that the Dock icon is the brick.
- Windows: run `npm run bundle`, then install the `.msi`. Check the Start menu entry `tiili` and its icon.
- Linux: run `npm run bundle`. Check that the `.AppImage` launches and that the `.deb` installs.
- Optional: add the proposed release workflow from `docs/packaging.md` to `.github/workflows`.
