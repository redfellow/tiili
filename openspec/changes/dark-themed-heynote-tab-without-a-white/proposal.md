# Heynote pane: tiili's light or dark, no white flash

## Why
Opening a Heynote pane flashes bright white before Heynote paints, which jars anyone using a dark tiili theme. Heynote also picks light or dark from the OS, not from the tiili theme the user chose.

## What Changes
- Until the user picks a theme inside Heynote, Heynote's light/dark follows tiili's theme kind (a dark tiili theme gives Heynote dark, a light one light, tiili's `system` follows the OS) and changes live with it.
- The pane shows the ground of the mode Heynote will start in from the first frame: the iframe and Heynote's page start with that background and `color-scheme`, and the frame is shown only once Heynote has painted, so no white shows at any point.
- A theme chosen inside Heynote still wins and is kept.

## Outcome
- Opening a Heynote pane with a dark tiili theme
  - Now: a brief bright white pane, then Heynote (light or dark per the OS)
  - After: dark from the first frame, Heynote in its dark mode

## Assumptions
- Heynote's own "system" choice (and its unset default) means "follow tiili"; ruled out adding a separate tiili setting.
- The ground shown before paint is Heynote's own dark/light editor background colour, not the tiili theme's terminal ground; ruled out matching each tiili theme's colours.
