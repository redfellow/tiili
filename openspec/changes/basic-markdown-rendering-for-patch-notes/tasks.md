## 1. Parser
- [ ] 1.1 Add `src/markdown.ts` with pure `parseMarkdown(body)` (blocks and inline runs, details/Full changelog dropped, HTML stripped, https-only links) and a table-driven `src/markdown.test.ts` (first line `// @harvaaja-test-tier: fast`) covering the v0.3.0 body, the screenshot-style body, unsafe links and tag injection like `<scr<b>ipt>`
  - proof: `npx vitest run src/markdown.test.ts`
  - proof: `npx eslint src/markdown.ts src/markdown.test.ts`

## 2. Dialog
- [ ] 2.1 Render the parsed blocks in `src/updateDialog.ts` as DOM (textContent only, https links via `openUrl`) in place of the What's new list / `pre` fallback; style `.update-markdown` in `src/styles.css`; remove `plainNotes` and its tests in `src/updates.test.ts` if unused, keeping `whatsNew` for the post-update panel
  - Tests to update: src/updates.test.ts
  - proof: `npx vitest run src/updates.test.ts src/markdown.test.ts`
  - proof: `npx eslint src/updateDialog.ts src/updates.ts src/updates.test.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Open the update dialog for a release whose notes have headings and bold list items: they show formatted, in the normal font, and an https link opens in the browser.
