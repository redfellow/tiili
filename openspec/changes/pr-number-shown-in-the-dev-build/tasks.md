## 1. Build-time PR number
- [x] 1.1 Add `parsePrNumber` and the guarded `gh pr view` lookup in vite.config.ts, define `__APP_PR__`, declare it in src/globals.d.ts and export `APP_PR` from src/version.ts; put `parsePrNumber` in a new src/prNumber.ts (no runtime imports) with a table-driven test (number, empty, junk) in src/prNumber.test.ts (first line `// @harvaaja-test-tier: fast`)
  - proof: `npx vitest run src/prNumber.test.ts`
  - proof: `npx eslint vite.config.ts src/prNumber.ts src/prNumber.test.ts src/version.ts src/globals.d.ts`

## 2. Settings footer
- [x] 2.1 Add `settingsVersionLabel(label, pr)` in src/version.ts with a table-driven test in src/version.test.ts (fast tier) and use it for the footer in src/settingsDialog.ts
  - proof: `npx vitest run src/version.test.ts`
  - proof: `npx eslint src/version.ts src/version.test.ts src/settingsDialog.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- Build tiili on a branch with an open PR and open settings: the footer shows `tiili dev build · PR #<n>`.
