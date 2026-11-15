## 1. Drag miniature

- [x] 1.1 Keep the prototype's `dragPreview` in `src/layout/view.ts` and its `.pane-drag-ghost` styles in `src/styles.css` as designed; fix only lint or type errors, and update the `dragPane` doc comment so it no longer mentions a label (type errors fixed, as the user chose, by bringing in the prototype's `motion.ts`, `panes.ts` and `terminal.ts` parts that `view.ts` depends on)
  - proof: `npx eslint src/layout/view.ts src/layout/motion.ts src/panes.ts src/terminal.ts`
  - proof: `npx vitest run src/layout/motion.test.ts`
  - proof: `npm run typecheck`
- [x] 1.2 Check the spec delta for "Pane drag feedback" validates
  - proof: `openspec validate show-a-mini-pane-preview-at-the-cursor-w --strict`

## 2. Pane motion

- [ ] 2.1 Check that the existing motion tests, named after the "Pane motion" scenarios kept in the MODIFIED requirement (Opening/Closing a pane animates, Swap animates, Reduced motion), still pass with the retuned motion and that the pane-tiling delta validates
  - Tests to update: src/layout/motion.test.ts (names still hold; no change expected)
  - proof: `npx vitest run src/layout/motion.test.ts`
  - proof: `openspec validate show-a-mini-pane-preview-at-the-cursor-w --strict`

## Manual checks after merge (The user)

- Drag a terminal pane by its top strip: a 200 px miniature of it with an accent border and shadow follows the cursor, no text label shows, and the source pane dims.
- Drop or press Escape: the miniature disappears and the source pane is back to normal.
- Try it at phone width too.
- Open a third pane: the moving panes glide (about 280 ms) and the new one rises in with a slight overshoot; terminal text scales smoothly rather than jumping.
- Close a pane: it drops and fades above the others, with its terminal visible until it is gone.
- With reduced motion on, opening and closing are instant.
