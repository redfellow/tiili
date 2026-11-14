## Approach
- Redraw the four `docs/brand/logo/icon-*.svg` files: keep the 100×100 tile rect with `rx="22.5"` and the `tile` clipPath exactly as `scripts/app-icon.mjs` `splitIcon` expects, change the tile fill to `#111617`, and replace the brick group with one rounded rect (about 70×45, centred) plus the `>_` path and underscore scaled to it. Full-size icons keep a lighter bevel gradient (smaller stop opacities) and a softer drop shadow; the duplicate offset `>_` highlight is removed. Small icons are the same drawing without bevel and shadow.
- Run `npm run icons` to regenerate PNGs, `icon.icns`, `icon.ico` and `AppIcon.icon/icon.json` (tile colour changes there). `Assets.car` needs Xcode 26; compile it on the host or with the app-icon workflow.
- Update the tile expectation in `scripts/icons.test.ts` and the icon paragraph and colour table in `docs/brand/README.md`.

Why: the generator and appearance split already work from these SVGs; only the drawing changes.
