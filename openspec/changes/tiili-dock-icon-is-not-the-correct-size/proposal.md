## Why
While tiili runs, it swaps in its own Dock icon (light, dark or working frames) through `setApplicationIconImage`. Those PNGs fill the whole canvas, edge to edge. macOS app icons leave a transparent margin: the tile covers 824 of 1024 px. So the running tiili icon looks bigger than every other app in the Dock.

## What Changes
- On macOS, the run-time icon is drawn on a transparent canvas with the tile inset to Apple's icon grid (824/1024 of the canvas, centred), so it matches the size of the other Dock icons. This applies to the normal light and dark icons and to every working frame.
- Windows and Linux keep the full-bleed run-time icon. Their taskbars expect it to fill the canvas.

## Outcome
- The running tiili icon in the Dock
  - Now: ![Dock with tiili larger than its neighbours](../../../card-plans/d192468e-2a10-4c58-b8d5-c7100ac99a3c/attachments/image.png)
  - After: the tiili tile is the same size as the neighbouring app icons, with or without the working animation.

## Assumptions
- The inset is applied at run time on macOS only (the Rust `set_icon` draws the embedded PNG into a padded canvas). The alternative was re-rendering the shared PNGs with padding, which would also shrink the Windows and Linux taskbar icons.
- The ratio is Apple's 824/1024 grid with no extra shadow. The alternative was matching the Icon Composer drop shadow.
