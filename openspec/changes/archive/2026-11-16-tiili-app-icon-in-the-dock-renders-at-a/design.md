## Approach
In `src-tauri/src/app_icon.rs`, add a pure function `dock_inset(canvas: f64) -> (f64, f64)` that returns the offset and side of the tile (side = canvas × 824/1024, offset = (canvas − side)/2). Unit-test it.

In the macOS `set_icon`, decode the PNG into an `NSImage`. Then build a new `NSImage` of the same size: `lockFocus`, draw the source into the inset rect with `drawInRect:fromRect:operation:fraction:` (source-over, 1.0), then `unlockFocus`. Pass the result to `setApplicationIconImage`. The light, dark and working frames all go through `set_icon`, so all of them get the inset. If the drawing APIs are awkward in objc2, the fallback is `NSImage::imageWithSize_flipped_drawingHandler`. The non-macOS `set_icon` is unchanged.

## Why not re-render the PNGs
The same PNGs feed the Windows and Linux window icons, which should stay full-bleed. Bundled icons (`icon.icns`, `Assets.car`) already have the right margin, because they come from `tauri icon` and Icon Composer.
