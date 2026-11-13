## Why
The Appearance tab holds the theme, the whole font block, the cursor and inactive-pane looks, so it is long and the font controls are buried. Reijo asked to split it into Style and Typography.

## What Changes
- The settings dialogue gets three tabs: Style, Typography, Behaviour (in that order). It opens on Style.
- Style holds Theme, Cursor, Inactive terminals (and the app icon section where it is shown).
- Typography holds the Font section unchanged (Family above its list, Size, Weight, Bold weight, Line height, Letter spacing, Ligatures).
- Behaviour is unchanged. Arrow keys still move between tabs and wrap.

## Outcome
- Tab row
  - Now: `Appearance` `Behaviour`
  - After: `Style` `Typography` `Behaviour`
- Font controls
  - Now: in the Appearance tab, under Theme
  - After: alone in the Typography tab

## Assumptions
- Theme, Cursor, Inactive terminals and the app icon go to Style; only Font goes to Typography (rather than moving Cursor to Typography too).
- Tab order Style, Typography, Behaviour and opening on Style (rather than remembering the last tab).
- The Font legend inside Typography stays as it is.
