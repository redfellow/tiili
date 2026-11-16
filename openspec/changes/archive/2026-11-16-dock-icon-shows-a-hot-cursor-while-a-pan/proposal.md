## Why

While a pane is busy (a script, a download, an agent producing output), nothing outside the tiili window shows it.
The user picked the "Hot cursor" design: while anything is working, the `_` cursor in the running app icon heats up and
slowly breathes, so the brick is "in the oven".

## What Changes

- `npm run icons` also renders 8 "working" frames per variant (light and dark) from the brand SVGs into
  `src-tauri/icons/` (`app-light-working-0.png` … `app-dark-working-7.png`, 512 px).
- tiili tracks per pane whether it is working: its foreground program is not its shell and it printed output in the
  last 3 s.
- While any pane is working, the running app icon (Dock on macOS, window/taskbar icon elsewhere) cycles the frames of
  the current variant every 333 ms; when the OS asks for reduced motion it shows frame 0 still. Idle, it shows today's
  icon and the timer stops. The attention badge, overlay and Dock bounce keep working.

## Outcome

- A script is running in a pane
  - Now: the Dock icon is today's brick
  - After: the cursor `_` of the icon glows koivu (white-hot on the dark icon) and breathes about every 2.7 s
- vim open, or an agent waiting for an answer
  - After: today's icon after about 3 s without output

## Assumptions

- "Motion off" follows the OS reduce-motion preference (user's answer); ruled out: a tiili setting.
- No setting turns the working icon off (user's answer); ruled out: an opt-out switch.
- The light frames are drawn from the large icon only, also at 32 px, relying on the bloom; ruled out: small-icon
  working frames.
- Working is checked on a 1 s tick so the icon goes idle within about 4 s of the last output; ruled out: an exact 3 s
  per-pane timer.
- Frames are embedded in the binary like `app-light.png`; ruled out: loading them from resources at run time.
