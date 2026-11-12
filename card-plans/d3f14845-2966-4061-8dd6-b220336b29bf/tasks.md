## 1. Keep vitest out of the dev server's config

- [x] 1.1 Make `vite.config.ts` import nothing at runtime from `vitest` (plain `vite` type only) and move the `test` settings into a new `vitest.config.ts` that merges it, so the dev server starts without vitest installed
  - proof: `npx vitest run scripts`
  - proof: `npm run typecheck`
  - proof: `npx eslint vite.config.ts vitest.config.ts`
  - proof: `! grep -E "from \"vitest" vite.config.ts`
