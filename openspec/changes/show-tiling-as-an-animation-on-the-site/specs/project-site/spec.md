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
- **THEN** the hero shows the finished grid of panes and nothing moves

#### Scenario: No startup recording in the hero

- **WHEN** the site's page loads
- **THEN** it loads no video, and the hero's caption describes the tiling scene
