# Tasks

- [ ] 1.1 Add `localDay(now)` and `splashDue(lastShown, now)` to `src/splash.ts`, with a table-driven test in `src/splash.test.ts` covering: nothing stored, an earlier day, today, a later or garbage value (due), and local midnight
  - proof: `npx vitest run src/splash.test.ts`
  - proof: `npx eslint src/splash.ts src/splash.test.ts`
- [ ] 1.2 In `src/main.ts`, play the splash only when `settings.behaviour.startupSplash` is on and `splashDue(localStorage.getItem("tiili.splash.lastShown"), new Date())` is true. When it plays, store `localDay(new Date())`. Wrap the storage access in try/catch so a failure falls back to playing the splash
  - proof: `npx eslint src/main.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Launch tiili: the splash plays. Quit and launch again: no splash, and the terminal is ready at once.
- The next day, the first launch plays the splash again.
- With Settings → Behaviour splash turned off, no launch plays it.
