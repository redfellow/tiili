## Why
The app icon fills the whole tile with bricks and a deeply pressed look, which reads busier than other Dock icons. Reijo wants it simpler and more professional: a black base with one wide brick and `>_` in the centre, like the härvääjä logo.

## What Changes
- The app icon (`docs/brand/logo/icon-{light,dark}[-small].svg`) becomes a near-black tile with one wide brick centred on it, with clear black space around it. The courses above and below and the side brick ends go.
- Embossing is reduced: a faint lit top and shaded bottom edge and a soft shadow remain; the `>_` is no longer pressed into the brick (no inset highlight).
- Both appearances use the black base; the brick stays klinkkeri `#6B2A1E` with a white `>_` in light mode and savi `#C9764F` with a near-black `>_` in dark mode.
- All generated icons (`npm run icons`: PNGs, `.icns`, `.ico`, `AppIcon.icon`) are regenerated; the brand README describes the new icon.
- `packaging`: the appearance scenarios name the new look.

## Outcome
- Dock icon
  - Now: bricks fill the tile edge to edge, a focus brick with a pressed-in `>_`, courses above and below
  - After: a black tile with one wide brick and `>_` in the centre, black space around it

## Assumptions
- The base is near-black `#111617` (the brand's near-black) in both light and dark appearance. Alternative: keep the cream kalkki tile in light mode.
- The brick spans about 70 % of the tile width at the brick's existing 28:18 proportions, centred. Alternative: a larger brick nearer the edges.
- The free-standing mark and lockup are unchanged; only the app icon changes. Alternative: redrawing the mark too.
- `Assets.car` is recompiled with Xcode 26 `actool` (or the app-icon workflow) outside the sandbox. Alternative: none in the sandbox.
