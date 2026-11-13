## Why

Settings can only be opened by shortcut, the macOS app menu or the right-click menu, none of which a new user sees. Reijo wants a settings icon at the right of the window's top bar, together with the everyday pane actions.

## What Changes

- On macOS the window uses an overlay title bar: the traffic lights stay, the native title is hidden and tiili draws its own top bar in the title bar area, draggable to move the window.
- On Windows and Linux the native title bar stays and tiili draws a slim top bar across the top of the window content.
- The top bar's right-hand side holds, in order: New pane, Close pane, Reset layout and a Settings gear. Each button does exactly what its shortcut does, and shows its name and shortcut as a tooltip.
- The pane grid fills the window below the top bar; PTY sizes follow.
- New capability `window-top-bar`; the `settings` Settings dialogue requirement gains the gear as a way to open it.

## Outcome

- Top bar, right-hand side
  - Now: nothing (native title bar showing `tiili`)
  - After: icon buttons `+` (New pane), `×` (Close pane), reset-layout icon, gear (Settings)
- Hovering the gear on macOS
  - After: `Settings (⌘,)`

## Assumptions

- Button order is New pane, Close pane, Reset layout, Settings with the gear rightmost; alternative was the gear on its own away from the pane buttons.
- Icons are inline SVGs drawn in the brand tokens' label colour; alternative was an icon font or library.
- On macOS the bar shows the title `tiili` centred like a native title; alternative was no title.
- The bar is not configurable or hideable in settings; alternative was a show/hide setting.
- Buttons are not keyboard-focusable targets that steal focus from the terminal; clicking one returns focus to the focused pane.
