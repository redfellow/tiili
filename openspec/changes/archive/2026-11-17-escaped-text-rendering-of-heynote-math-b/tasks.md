## 1. Patch and test

- [x] 1.1 Add `scripts/heynote-patches.mjs` (+ `.d.mts`) with `patchMathResult`, and the table-driven `scripts/heynote-patches.test.ts` (`@harvaaja-test-tier: fast`)
  - proof: `npx vitest run scripts/heynote-patches.test.ts`
  - proof: `npx eslint scripts/heynote-patches.mjs scripts/heynote-patches.test.ts`
- [x] 1.2 Apply the patch in `scripts/heynote.mjs` (restore it in `finally`, and mention it in the header and README text). Run `npm run heynote` to regenerate `public/heynote`
  - proof: `npx eslint scripts/heynote.mjs`
  - proof: `! grep -l 'innerHTML=this.displayResult' public/heynote/assets/main-*.js`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)

- In a Heynote pane math block, type `"<img src=x onerror=alert(1)>"`. The result shows that text literally and no dialog appears. A normal sum such as `1+2` still shows `3`, and clicking it still shows "Copied!".
