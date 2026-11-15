## 1. Fix

- [ ] 1.1 Guard the Zen hand-over in `Tab.add` (`src/tab.ts`) so it runs only while Zen is on, and add one table-driven test to `src/tabs.test.ts` covering: Zen off + showAlone → zen undefined; Zen on + showAlone → zen is the new pane; showAlone = false → zen unchanged with Zen on and off.
  - proof: `npx vitest run src/tabs.test.ts`
  - proof: `npx eslint src/tab.ts src/tabs.test.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- With one pane and Zen off, press ⌘T, click New pane, and click Heynote: each time the grid shows with the new pane in it.
- With Zen on, press ⌘T: the new pane is shown alone in Zen.
