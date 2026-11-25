## Approach

Take the two files from PR #246 (`origin/site-bricklaying-animation`, commit `be448b1`) onto this card's branch.
The PR branch differs from this branch only in `site/index.html` and the new `site/media/tiili-bricklaying.html`,
so the files can be checked out from that branch as they are, with no merge work.

An `<iframe>` keeps the animation's script and styles apart from the page's. The page loses its video script, and
the iframe loads lazily. The animation checks `window.parent !== window` to drop its own ground and use a taller
frame (1280 × 920) when it is embedded. The page's `.screen` uses the same aspect ratio.

The mp4 and its poster stay on disk. The poster is still the `og:image`.

## Risks

- The animation's canvas colours are hard-coded and the brand-token lint does not cover `site/media/`. If the
  palette changes, the animation will not follow it. Left as is, see the proposal's Assumptions.
- The animation's controls (playback bar, click and key controls, pane spotlight, overlaid scene text) ship as PR
  #246 has them and are now specified as such. The `Copy` toggle's label can read like "copy to clipboard"; it is
  kept, by the user's choice, and can be renamed in a later card. Under reduced motion a replay the visitor starts
  plays the full motion, which the spec allows.
