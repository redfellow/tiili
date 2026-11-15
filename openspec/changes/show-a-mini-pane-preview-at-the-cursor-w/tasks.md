## 1. Drag miniature

- [ ] 1.1 Keep the prototype's `dragPreview` in `src/layout/view.ts` and its `.pane-drag-ghost` styles in `src/styles.css` as designed; fix only lint or type errors, and update the `dragPane` doc comment so it no longer mentions a label
  - proof: `npx eslint src/layout/view.ts`
  - proof: `npm run typecheck`
- [ ] 1.2 Check the spec delta for "Pane drag feedback" validates
  - proof: `openspec validate show-a-mini-pane-preview-at-the-cursor-w --strict`

## Manual checks after merge (The user)

- Drag a terminal pane by its top strip: a 200 px miniature of it with an accent border and shadow follows the cursor, no text label shows, and the source pane dims.
- Drop or press Escape: the miniature disappears and the source pane is back to normal.
- Try it at phone width too.
