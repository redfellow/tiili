## Approach

- **Frames (scripts/icons.mjs, scripts/app-icon.mjs).** Add an exported pure `workingSvg(svg, variant, frame)` in
  `scripts/app-icon.mjs` that rewrites a brand icon SVG: the cursor rect (x52.54 y59.35 w21.42 h6.5 in the 100x100
  box; in the SVG source it is the `<rect x="27.015" y="24.74" …>` inside the scaled group) gets the hot fill, and a
  bloom is inserted after the brick rect and before the bevel: the cursor rect grown by 1 unit (0.4 in the scaled
  group's units) each side, rx 2 (0.8), filled with koivu (light) or kalkki (dark), Gaussian blur stdDeviation 2.6
  (1.04), opacity per frame. Light: cursor `#D9A43A`, bloom opacity `.95 .95 .82 .64 .5 .5 .64 .82`. Dark: cursor
  kalkki `#F6F1E9` mixed to koivu by t `0 0 .2 .4 .55 .55 .4 .2` (sRGB channel lerp, rounded), bloom kalkki at the
  light opacities x 0.7. The tables live as exported constants. `icons.mjs` renders 16 PNGs at RUNTIME_SIZE with Resvg.
- **Working state (src-tauri/src/working.rs, new).** A pure `Working` registry: per session, `is_shell_foreground`
  and `last_output: Instant`; `any_working(now)` is true when some session has a non-shell foreground and output
  within 3 s. Fed from the PTY reader thread where `Command::feed_output` and `report_foreground` already run
  (lib.rs); the shell check reuses `command.rs`'s foreground pgid vs the shell's pid.
- **Icon (src-tauri/src/app_icon.rs).** `Variant::frame(i)` returns the embedded working PNGs. A ticker thread runs
  only while working: every 333 ms it checks `any_working`, shows the next frame (or holds frame 0 with reduced
  motion) through the existing `show`, and on idle shows the normal icon via `apply` and exits. Output starts it when
  none runs. `apply` (appearance or choice changes) picks the working frame when working. Reduced motion is read per
  tick: `NSWorkspace.accessibilityDisplayShouldReduceMotion` on macOS, `SPI_GETCLIENTAREAANIMATION` on Windows,
  GTK `gtk-enable-animations` on Linux, defaulting to animate if unreadable.
- **Coexistence.** macOS `setApplicationIconImage` does not touch the Dock tile badge; on Windows `set_icon` does not
  clear the overlay icon. So attention.rs is unchanged; the manual check confirms it.
- Why pre-rendered: matches the existing run-time icons and keeps drawing out of the app.
