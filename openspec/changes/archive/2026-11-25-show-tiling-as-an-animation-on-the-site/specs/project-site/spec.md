## Purpose

The tiili project website in `site/`: what a visitor sees on its page about the app, starting with the hero that
shows what tiili does.

## ADDED Requirements

### Requirement: Hero shows tiling as an animation

The site's hero SHALL show an animation drawn in the page, not a recording. In it, terminal panes open one at a time
as bricks in a tiili window and the grid settles around each one. The animation SHALL start when it scrolls into
view, SHALL make no request outside the site, and SHALL show its final frame without motion when the visitor
prefers reduced motion.

#### Scenario: Animation plays when the hero comes into view

- **WHEN** a visitor scrolls the hero into view
- **THEN** bricks drop into the window one at a time and each becomes a terminal pane in the re-flowing grid

#### Scenario: Reduced motion shows the final frame

- **WHEN** the visitor's system prefers reduced motion
- **THEN** the hero shows the finished grid of panes and nothing moves until the visitor starts a replay

#### Scenario: No startup recording in the hero

- **WHEN** the site's page loads
- **THEN** it loads no video, and the hero's caption describes the tiling scene

### Requirement: Hero animation has a playback bar

The hero animation SHALL show a playback bar while the pointer is over the scene, while a control in it has focus,
and while playback is paused. The bar holds a Pause/Play button, a timeline scrubber, a clock in seconds, a `Copy`
toggle that hides or shows the overlaid scene text, and a Replay button. The bar SHALL be hidden when the
animation's frame is 560px wide or narrower.

#### Scenario: Playback bar shows on hover

- **WHEN** a visitor moves the pointer over the hero animation on a frame wider than 560px
- **THEN** the playback bar shows Pause or Play, the timeline, the seconds clock, `Copy` and Replay

#### Scenario: Playback bar stays while paused

- **WHEN** the animation is paused and the pointer leaves the scene
- **THEN** the playback bar stays visible

#### Scenario: Playback bar hidden on a narrow frame

- **WHEN** the animation's frame is 560px wide or narrower
- **THEN** no playback bar shows, and a tap on the scene pauses, resumes or replays it

#### Scenario: Scrubbing pauses at the chosen moment

- **WHEN** the visitor drags the timeline scrubber
- **THEN** the scene jumps to that moment, the clock shows its time in seconds, and playback pauses

#### Scenario: Copy toggle hides the overlaid text

- **WHEN** the visitor presses `Copy`
- **THEN** the overlaid scene text is hidden and the button shows as not pressed, and pressing it again shows the text

### Requirement: Hero animation responds to clicks, keys and hover

A click on the scene SHALL pause it while it plays, resume it while paused, and replay it once it has ended. While
the animation's frame has focus, Space SHALL toggle play and `r` SHALL replay. Hovering a pane that has settled SHALL
spotlight it. Under reduced motion the scene starts on its final frame, but a replay the visitor starts MAY play the
full motion.

#### Scenario: Click on the scene toggles playback

- **WHEN** the visitor clicks the scene while it plays, while it is paused, or after it has ended
- **THEN** it pauses, resumes or replays from the start, in that order

#### Scenario: Keys inside the frame

- **WHEN** the animation's frame has focus and the visitor presses Space or `r`
- **THEN** Space toggles play and pause, and `r` replays from the start

#### Scenario: Hovering a pane spotlights it

- **WHEN** the visitor hovers a pane that has settled
- **THEN** that pane is spotlit and the others dim

#### Scenario: Visitor-started replay under reduced motion

- **WHEN** the visitor prefers reduced motion and clicks Replay or the ended scene
- **THEN** the scene may play its full motion from the start, and it does not start moving on its own

### Requirement: Hero animation overlays its own scene text

The scene SHALL overlay its own text in time with the panes: `Servers. Logs. Editors.`, then `A coding agent or
ten.`, then `A terminal that tiles itself.`.

#### Scenario: Overlaid scene text follows the panes

- **WHEN** the scene plays from the start
- **THEN** `Servers.`, `Logs.` and `Editors.` arrive one word at a time with the panes, `A coding agent or ten.`
  follows, and the scene ends on `A terminal that tiles itself.` with a cursor
