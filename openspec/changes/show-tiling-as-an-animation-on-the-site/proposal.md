## Why

Reijo: "Show tiling as an animation on the site instead of the startup recording." The site's hero plays
`site/media/tiili-splash.mp4`, a recording of the startup splash. It shows the app starting up, but not what the app
does: tile terminals. The animation for this already exists in PR #246 (branch `site-bricklaying-animation`), and
Reijo picked it as the replacement.

## What Changes

- Add `site/media/tiili-bricklaying.html` from PR #246 as it is. It is one self-contained page that draws the scene on
  a canvas: bricks drop into a tiili window one at a time, each becomes a terminal pane, and the grid settles around
  each new one, up to ten. It starts when it scrolls into view, and with reduced motion it shows its last frame.
- `site/index.html` loads it in an `<iframe>` where the `<video>` was. The video's Replay button, its CSS and its
  play-on-view script are removed. The animation has no ground of its own, so it sits on the page's mortar wall and
  follows the light and dark themes.
- The caption under the hero is rewritten for the new scene.
- `site/media/tiili-splash.mp4` and `site/media/tiili-splash-poster.jpg` stay in the repository. The poster is still
  the `og:image`.
- A new `project-site` capability holds the hero requirement.

## Outcome

- Hero media
  - Now: a recording of tiili starting up: bricks fly in to form the wordmark, then the first terminal opens
  - After: an animation drawn in the page: bricks drop into a tiili window one by one and each becomes a terminal pane,
    up to ten
- Caption under the hero
  - Now: `tiili starting up on macOS. The wall comes down and the first shell takes the whole window.`
  - After: `Ten shells, opened one at a time. Each lands as a brick and the grid settles around it.`
- Replay button on the hero
  - Now: `Replay` (shown on hover and when the video ends)
  - After: the animation's own controls, as PR #246 has them

## Assumptions

- The PR's two files are taken unchanged, since Reijo chose "the animation provided in the PR". This rules out
  redesigning the scene, its timing or its controls in this card.
- The brand-token lint stays as it is. It checks `site/*.html` but not `site/media/*.html`, so the canvas colours in
  the animation are not linted. This rules out moving the animation's colours to tokens here.
- PR #246 is closed by hand once this card merges, because this card carries the same change. This rules out merging
  both.
