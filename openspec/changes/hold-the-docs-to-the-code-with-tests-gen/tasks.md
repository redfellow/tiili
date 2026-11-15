## 1. Shortcut list

- [x] 1.1 Add `src/shortcuts.ts` with the grouped `SHORTCUTS` list (Heynote marked chord-less) and `src/shortcuts.test.ts` (first line `@harvaaja-test-tier: fast`) trying every key × modifier on each platform both ways
  - proof: `npx vitest run src/shortcuts.test.ts`
  - proof: `npx eslint src/shortcuts.ts src/shortcuts.test.ts`

## 2. Generated tables

- [x] 2.1 Add `scripts/docs.mjs` (+ renderer and `.d.mts`), the `docs` npm script, markers in README.md and site/index.html, run it to fix the drift, and `scripts/docs.test.ts` failing with "run npm run docs" when stale
  - proof: `npx vitest run scripts/docs.test.ts`
  - proof: `npx eslint scripts/docs.test.ts`
  - proof: `npm run typecheck`

## 3. Checked copies

- [x] 3.1 Add `src/docs-sync/menu-accelerators.test.ts` (lib.rs accelerators ↔ keymap, Cmd+Q excepted)
  - proof: `npx vitest run src/docs-sync/menu-accelerators.test.ts`
- [x] 3.2 Add `src/docs-sync/themes.test.ts` (theme families in README and site)
  - proof: `npx vitest run src/docs-sync/themes.test.ts`
- [x] 3.3 Add `src/docs-sync/cli-flags.test.ts` (SKILL.md and the two specs' `tiili open`/`list` flags in control.rs USAGE)
  - proof: `npx vitest run src/docs-sync/cli-flags.test.ts`
- [x] 3.4 Add `src/docs-sync/fonts.test.ts` (every .woff2 covered by LICENSES.md)
  - proof: `npx vitest run src/docs-sync/fonts.test.ts`
- [x] 3.5 Add `src/docs-sync/brand-tints.test.ts` (tint table ↔ tiili.css, contrast ratios computed)
  - proof: `npx vitest run src/docs-sync/brand-tints.test.ts`
- [x] 3.6 Add `src/docs-sync/links.test.ts` (`npm run X` in README, docs/, site exist; relative README/docs links resolve; JS-template hrefs skipped)
  - proof: `npx vitest run src/docs-sync/links.test.ts`
  - proof: `npx eslint src/docs-sync`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- Open the site and check the grouped shortcut table reads well, including on a narrow screen.
