## Why

tiili checks for updates only at startup. If you keep it open for days, it never checks again, so you don't hear about new releases until you restart it.

## What Changes

- The main window checks again whenever it gains focus and the last check was 24 hours ago or more. The rules stay the same as at startup: automatic checks must be on, it sends one anonymous request, and a skipped version is not offered.
- The setting is read when the check runs, so turning automatic checks off in Settings stops later checks without a restart.
- A focus check doesn't open a second update dialog while one is already open.

## Outcome

- tiili left open overnight, then clicked the next day
  - Now: no check until the next launch
  - After: the `Install update?` dialog appears when a newer version exists

## Assumptions

- Only the main (first) window checks on focus, as the startup check already does. The alternative was to check from every window; the main window keeps the dialog in one place.
- The check runs on focus only. A timer that checks while tiili is in the background was ruled out because it would show the dialog when the user isn't looking.
