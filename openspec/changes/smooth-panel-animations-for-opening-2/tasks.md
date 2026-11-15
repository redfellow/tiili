## 1. Prototype upkeep

- [x] 1.1 Remove the out-of-scope drag preview from `src/layout/view.ts` (`dragPreview`, `DRAG_PREVIEW_WIDTH` and its use in `dragPane`), bringing back the label ghost from 0783f7ca. Keep every motion change.
  - proof: `npx eslint src/layout/view.ts`
- [x] 1.2 Extend the table in `src/layout/motion.test.ts` so it checks that each kind carries its own duration and easing, and that the enter duration is longer than the move duration, which is longer than the exit duration.
  Tests to update: src/layout/motion.test.ts
  - proof: `npx vitest run src/layout/motion.test.ts`
  - proof: `npx eslint src/layout/motion.ts src/layout/motion.test.ts src/panes.ts src/terminal.ts`
  - proof: `npm run typecheck`

## 2. Spec

- [x] 2.1 Make sure the Pane motion delta validates.
  - proof: `openspec validate smooth-panel-animations-for-opening-2 --strict`

## Manual checks after merge (The user)

- Open a pane: it rises and springs into place, and the neighbouring panes glide.
- Close a pane: it shrinks and fades out on top while the others fill its space.
- While panes move, terminal text re-wraps once and then scales smoothly; titles keep their size.
- With reduced motion turned on, everything moves instantly.
