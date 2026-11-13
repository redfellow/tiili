## Why
Card 3baa38f1 built only part of the Design session's settings prototype (inactive opacity, Desaturate, hover highlight). The rest never landed: the tabs, tiling modes, responsive text, pane drag ghost and scrollbar styling. The prototype diff is in `card-plans/3baa38f1-b074-4480-a2ee-30bb3e7ba70a/attachments/design-reference.md`.

## What Changes
- The settings dialogue is split into **Appearance** and **Behaviour** tabs (role=tablist; Left/Right arrow keys move between tabs).
- Appearance holds Theme, Font (Family on its own row above its list, then a Size slider, Weight, Bold weight, Line height, Letter spacing and Ligatures), Cursor, and Inactive terminals (Opacity, Desaturate).
- Behaviour holds:
  - Tiling: a list with icons (Grid (default), Wide grid, Tall grid, Side by side, Stacked) that re-lays out the panes live.
  - Responsive text: a checkbox (on by default) and a Strength slider (0–2, default 0.5).
  - Panes: the hover-highlight checkbox, moved here.
- New `tiling.layout` and `responsive` settings. A missing or invalid value falls back to its default, and existing settings files keep loading.
- When you drag a pane by its grab strip, a ghost label follows the pointer, the source pane dims and the cursor shows grabbing.
- Terminal scrollbars are 8 px wide and have no overview-ruler hairline.

## Outcome
- Settings layout
  - Now: ![one long dialog](../../../card-plans/2efc65ac-9cdb-41f9-a4e7-45dc128bfab8/attachments/settings-now.png)
  - After: `Appearance` and `Behaviour` tabs, as shown in settings-wanted-appearance-tab.png and settings-wanted-behaviour-tab.png
- Tiling hint
  - After: `How panes are arranged as you open and close them.`
- Responsive text
  - After: `Shrink text in small panes`
- Hover highlight label
  - Now: `Highlight terminal on mouseover`
  - After: `Highlight the terminal under the mouse`
- Inactive section legend
  - Now: `Inactive panes`
  - After: `Inactive terminals`

## Assumptions
- The build follows the prototype code in the design reference (the formulas, column counts and labels). I did not redesign any of it.
- Switching tiling mode keeps manual track sizes only where the track count stays the same, the same rule as the existing reflow. The alternative was to always reset the sizes.
- Reset defaults resets every setting on both tabs. The alternative was to reset only the visible tab.
- The tiling mode is saved with the settings and is not kept per window session.
