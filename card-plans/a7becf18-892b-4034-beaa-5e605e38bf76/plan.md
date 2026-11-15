# Opening a pane leaves Zen off when Zen is off

## Why
`Tab.add(pane, showAlone)` in `src/tab.ts` calls `setZen(pane.id)` whenever `showAlone` is true, without checking
that Zen is on. Its doc comment says the hand-over happens only "with Zen on". So ⌘T, New pane and Heynote turn Zen
on when the tab has two or more panes.

## What Changes
- `src/tab.ts`: `if (showAlone && this.zen !== undefined) this.setZen(pane.id);`
- Table-driven unit test in `src/tabs.test.ts`.

## Outcome
- Press ⌘T with Zen off
  - Now: the new pane is shown alone in Zen
  - After: the grid shows, with the new pane in it

## Acceptance
- Zen off + add with showAlone: zen stays undefined.
- Zen on + add with showAlone: zen moves to the new pane.
- Add with showAlone = false: zen unchanged (on or off).

## Citations
- src/tab.ts:171-177 (doc comment and code of `Tab.add`)
- openspec/specs/pane-layout/spec.md (Zen requirements, unchanged)

## Assumptions
- No spec change: the fix restores behaviour the code already documents; the alternative, a new Zen requirement, was ruled out as redundant.
