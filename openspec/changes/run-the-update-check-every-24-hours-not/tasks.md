## 1. Check on focus

- [ ] 1.1 In `src/updates.ts`, rename `startupCheck` to `autoCheck`, add the `busy` guard, and extend the table test in `src/updates.test.ts` with the new scenarios: "Focused a day later", "Focused soon after a check" and "busy: no request".
  Tests to update: src/updates.test.ts
  - proof: `npx vitest run src/updates.test.ts`
  - proof: `npx eslint src/updates.ts src/updates.test.ts`
- [ ] 1.2 In `src/main.ts`, keep the startup call and add an `onFocusChanged` listener in the main window that calls `autoCheck`. It reads `settings.updates.autoCheck` live and uses a `busy` check for an open update dialog.
  - proof: `npx eslint src/main.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Set `tiili.updates.lastCheck` in localStorage to more than 24 hours ago while tiili is running, switch to another app, then focus tiili again. The update dialog appears if a newer release exists, and focusing again doesn't open a second one.
