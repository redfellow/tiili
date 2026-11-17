## 1. Fix

- [ ] 1.1 In `paneRestore` (src/session.ts) leave `history` undefined when `pane.host` is set; add a row "Remote command is not seeded" to the `it.each` table in src/session.test.ts: a host pane with `command` restores with `history: undefined` and the connected line
  - Tests to update: src/session.test.ts
  - proof: `npx vitest run src/session.test.ts`
  - proof: `npx eslint src/session.ts src/session.test.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Quit tiili with an SSH pane open, relaunch, press Up in that pane: no remote-reported command appears.
