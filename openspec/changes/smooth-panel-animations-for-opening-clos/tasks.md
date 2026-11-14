## 1. Motion

- [ ] 1.1 Add `src/layout/motion.ts` with `flipFrames(before, after)` and `prefersReducedMotion()`, with a table-driven `src/layout/motion.test.ts` (first line `// @harvaaja-test-tier: fast`) covering moved, new, unchanged and removed panes
  - proof: `npx vitest run src/layout/motion.test.ts`
  - proof: `npx eslint src/layout/motion.ts src/layout/motion.test.ts`
- [ ] 1.2 In `src/layout/view.ts` and `src/panes.ts`, snapshot rects around each relayout and play the frames; keep a closing pane pinned until its exit animation ends; fit and resize the PTY once at the end; skip animation for divider drags and under reduced motion
  - proof: `npx vitest run src/layout/model.test.ts src/layout.test.ts src/resize.test.ts`
  - proof: `npx eslint src/layout/view.ts src/panes.ts`
  - proof: `npm run typecheck`
- [ ] 1.3 Validate the change
  - proof: `openspec validate smooth-panel-animations-for-opening-clos --strict`

## Manual checks after merge (The user)

- Open, close and swap panes (by dragging and with the keyboard) and change the tiling mode: the panes glide smoothly and terminals keep their content.
- Turn on Reduce motion in the OS: the panes change instantly.
- Drag a divider: it follows the pointer with no lag.
