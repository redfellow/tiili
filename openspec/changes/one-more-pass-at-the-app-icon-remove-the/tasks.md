## 1. Icon
- [ ] 1.1 Redraw `docs/brand/logo/icon-{light,dark}.svg` and `icon-{light,dark}-small.svg`: near-black `#111617` tile, one centred wide brick with `>_`, lighter bevel, no inset highlight
  - proof: `grep -c 'fill="#111617"/><g clip-path' docs/brand/logo/icon-light.svg docs/brand/logo/icon-dark.svg docs/brand/logo/icon-light-small.svg docs/brand/logo/icon-dark-small.svg`
- [ ] 1.2 Run `npm run icons` to regenerate `src-tauri/icons` and update the tile colours in `scripts/icons.test.ts`
  Tests to update: scripts/icons.test.ts
  - proof: `npx vitest run scripts/icons.test.ts`
  - proof: `npx eslint scripts/icons.test.ts`
- [ ] 1.3 Describe the new icon in `docs/brand/README.md` (icon paragraph, App icon tile row)
  - proof: `grep -n "App icon tile" docs/brand/README.md`
  - proof: `openspec validate one-more-pass-at-the-app-icon-remove-the --strict`

## Manual checks after merge (The user)
- Recompile `Assets.car` with Xcode 26 (`node scripts/app-icon.mjs`) or the app-icon workflow if the build could not.
- `npm run install-app`: the Dock shows the black icon with one brick in light and dark mode; it sits well next to other Dock icons.
- The 16/32 px icons (Finder list, Windows taskbar) still show the brick and `>_`.
