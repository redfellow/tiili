## Why
Panes without focus are dimmed by fading the whole pane at a fixed 82%, so their background fades into the gap colour too. The user wants to choose how faded inactive panes are, optionally take their colour away, and have only the content fade while the pane background stays solid. A pane under the mouse should come back to full strength when the highlight option is on.

## What Changes
- New Appearance settings: **Inactive panes → Opacity** slider (0.3–1, default 0.82) and **Desaturate** checkbox (default off).
- New Behaviour setting: **Highlight terminal on mouseover** checkbox (default on).
- The fade and desaturation apply only to a pane's title chip and terminal text; the pane background stays solid.
- With the highlight on, a hovered pane shows full opacity and colour and a faint accent line on its top edge.
- All three apply live, are saved with the other settings, and fall back to defaults when missing or invalid.

## Outcome
- Inactive pane
  - Now: the whole pane, background included, at 82% opacity
  - After: solid background; title chip and text at the chosen opacity, grey when Desaturate is on
- Settings dialogue
  - After: `Inactive panes` with `Opacity` slider and `Desaturate` checkbox
  - After: `Highlight terminal on mouseover` checkbox
- Hovered pane
  - After: full opacity and colour with a faint accent top line (when highlight is on)

## Assumptions
- Scope is the inactive looks only (opacity, desaturate, mouseover highlight); the other parts of the Design session (tabs, tiling modes, drag ghost, scrollbars, responsive font) are left to other cards. Ruled out: building the whole session here. The user twice pointed to the design view rather than choosing; this reading follows the card title.
- Settings go in the existing dialogue next to the related sections rather than in new Appearance/Behaviour tabs (tabs are not in scope). Ruled out: adding tabs.
- Values from the prototype: range 0.3–1 step 0.01, grayscale 0.8, accent line 2 px at 50% accent. Ruled out: other values.
