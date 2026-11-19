## 1. Render the panel's inline Markdown

- [x] 1.1 Add `WHATS_NEW_LIMIT` and `whatsNewPanelItems` to `src/updates.ts` with tests in `src/updates.test.ts` (Item with bold, the limit); export `renderInline` from `src/updateDialog.ts` and build the What's new panel's items from them in `src/whatsNewDialog.ts`; share the code and link styles in `src/styles.css`.
  Tests to update: src/updates.test.ts
  - proof: `npx vitest run src/updates.test.ts src/markdown.test.ts`
  - proof: `npx eslint src/whatsNewDialog.ts src/updateDialog.ts src/updates.ts src/updates.test.ts`
  - proof: `npm run typecheck`
  - proof: `openspec validate whats-new-panel-shows-inline-markdown --strict`

## Manual checks after merge (The user)

- After the next in-app update, the What's new panel shows each item's headline in bold, without asterisks.
