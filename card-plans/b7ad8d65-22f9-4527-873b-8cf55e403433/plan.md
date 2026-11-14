# Tiili splash animation shown at most once per day

Route: No spec change. No main spec or active change describes the startup splash (`grep -rni splash openspec` finds nothing); its behaviour lives only in `src/splash.ts` and `src/main.ts`.

## Why
Reijo: "Tiili splash animation: show at maximium once a day." The splash takes about seven seconds (`PACE` in `src/splash.ts`) and plays on every launch while `behaviour.startupSplash` is on (`src/main.ts` lines 66-80).

## What Changes
- The splash plays on the first launch of each local calendar day. Later launches that same day skip it.
- The existing Settings on/off switch (`behaviour.startupSplash`, `src/settings.ts`) works as before. When it is off, the splash never plays. No new setting is added.
- The date of the last splash is kept in the frontend's `localStorage` under the key `tiili.splash.lastShown`, as a local `YYYY-MM-DD` string. It is written when the splash starts, so a splash you skip still counts.
- A pure helper `splashDue(lastShown: string | null, now: Date): boolean` and `localDay(now: Date): string` are added in `src/splash.ts`. `main.ts` uses them together with the setting.

## Outcome
- Second launch on the same day
  - Now: the brick-laying splash plays again
  - After: the terminal opens straight away, with no splash
- First launch of a new day
  - After: the splash plays as it does today

## Acceptance
- `splashDue` returns true when nothing is stored, when the stored day is earlier than today, or when the stored value is unreadable. It returns false when the stored day is today.
- With the setting off, no splash plays and nothing is written.

## Citations
- src/main.ts:66-80 (where the splash is chosen to play)
- src/settings.ts:52-56,120,201-204 (the `startupSplash` setting)
- src/splash.ts (`playSplash`, `TIMELINE`, `PACE`)

## Assumptions
- The user chose the calendar-day reading (not a rolling 24 hours) and a fixed rule (not a new choice in Settings).
- The day is stored in `localStorage`, not in the settings file. This keeps run-state out of the user's settings; the alternative was a new field in `Settings`. If `localStorage` is not available or throws, the splash plays (the safe fallback) and the error is ignored.
- A splash that is skipped or turned off with "tiili no-splash" still counts as shown for that day.
- The dev-browser preview follows the same rule. Clearing site data brings the splash back.
