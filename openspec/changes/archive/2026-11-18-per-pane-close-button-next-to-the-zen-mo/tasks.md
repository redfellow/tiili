## 1. Move close to the pane

- [x] 1.1 In `src/panes.ts`, add the per-pane close button beside the Zen button (closes that pane by id, skipped by the title dblclick), add `closeButton` to `Pane` in `src/tab.ts` and hide it with one pane next to `zenButton`; update the `Pane` fixture in `src/tabs.test.ts`. Style `.pane-close-toggle` in `src/styles.css` like the Zen toggle, shown only on pane hover.
  Tests to update: src/tabs.test.ts
  - proof: `npx vitest run src/tabs.test.ts`
  - proof: `npx eslint src/panes.ts src/tab.ts src/tabs.test.ts`
- [x] 1.2 Remove the Close pane button, its icon and `onClosePane` from `src/topBar.ts` and `src/main.ts`, and update the doc comment.
  - proof: `npx eslint src/topBar.ts src/main.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate per-pane-close-button-next-to-the-zen-mo --strict`

## Manual checks after merge (The user)

- With two panes, hover each: the × shows beside the Zen icon only on the hovered pane; clicking it closes that pane even when the other has focus. With one pane, no × shows. The top bar no longer has Close pane.
