## Approach

- `src/updates.ts`: keep the `startupCheck` logic (it already enforces the 24-hour gap through the stored last check time), rename it `autoCheck`, and add an optional `busy?: () => boolean`. When `busy` returns true, the function returns before it writes or sends anything. This is how the open-dialog guard works.
- `src/main.ts`: in the main Tauri window, after the splash, run the check once as today. Then subscribe with `getCurrentWindow().onFocusChanged` and run the same check whenever `focused` is true. `enabled` is read from the live settings object at each call, not captured at startup. `busy` checks whether an update dialog is in the DOM.
- No timer runs. Focus is the trigger the user asked for, and the 24-hour gap still limits how often tiili sends a request.
