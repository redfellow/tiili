## 1. Hero animation

- [x] 1.1 Add `site/media/tiili-bricklaying.html` from `origin/site-bricklaying-animation` (PR #246), unchanged
  - proof: `git diff --exit-code origin/site-bricklaying-animation -- site/media/tiili-bricklaying.html`
  - proof: `test "$(grep -cE '(src|href)="(https?:)?//' site/media/tiili-bricklaying.html)" = 0`
- [x] 1.2 Replace the hero `<video>`, Replay button, their CSS and the play-on-view script in `site/index.html` with
  the PR's `<iframe>` and the new caption. Keep `site/media/tiili-splash.mp4` and `site/media/tiili-splash-poster.jpg`
  and the `og:image`
  - Tests to update: none pin the video. `scripts/docs.test.ts` reads `site/index.html` for the shortcut tables and
    theme names, so it runs again here
  - proof: `git diff --exit-code origin/site-bricklaying-animation -- site/index.html`
  - proof: `npx eslint site/index.html`
  - proof: `npx vitest run scripts/docs.test.ts`
  - proof: `test -f site/media/tiili-splash.mp4 && test -f site/media/tiili-splash-poster.jpg && ! grep -q '<video' site/index.html`
  - proof: `openspec validate show-tiling-as-an-animation-on-the-site --strict`

## Manual checks after merge (The user)

- Open the site in a browser, in light and dark themes: the animation starts as the hero scrolls into view, sits on the
  mortar wall, and the page looks right on a narrow phone width.
- With reduced motion on, the hero shows the final grid and nothing moves until you press Replay or click the scene.
- Hover the hero: the playback bar shows Pause/Play, the timeline, the clock, `Copy` and Replay; scrubbing pauses,
  `Copy` hides the overlaid text, a click on the scene pauses, resumes or replays, and Space and `r` work after
  clicking into the frame. Hovering a settled pane spotlights it. At a phone width the bar is gone.
- The overlaid text reads `Servers. Logs. Editors.`, `A coding agent or ten.` and `A terminal that tiles itself.` in
  time with the panes, and does not collide with the page's caption.
- Close PR #246, because this change carries it.
