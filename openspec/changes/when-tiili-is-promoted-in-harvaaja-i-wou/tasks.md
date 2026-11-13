## 1. Install command

- [x] 1.1 Add `scripts/install-app.mjs`, with the exported pure helpers from design.md and the steps in `main`, plus the `install-app` npm script. Add `scripts/install-app.test.ts` (`@harvaaja-test-tier: fast`), a table-driven test of the pinned check and the Dock entry.
  - proof: `npx vitest run scripts/install-app.test.ts`
  - proof: `npx eslint scripts/install-app.mjs scripts/install-app.test.ts`
- [x] 1.2 Document `npm run install-app` in docs/packaging.md.
  - proof: `grep -n "install-app" docs/packaging.md`

## Manual checks after merge (The user)
- Run `npm run install-app`. tiili appears in /Applications and in the Dock, and opens from the Dock.
- Run it again. The Dock still has a single tiili.
