# Tasks

## 1. Tokens and drift test

- [x] 1.1 Add `--shadow-*`, `--text-*` and the four `data-variant` blocks to `docs/brand/tiili.css`; add the semantic-token table, shadow and text rows to `docs/brand/README.md`; copy both to `site/brand/` so they stay identical.
  - proof: `grep -E 'data-variant="(savi|muratti|koski|laasti)"' docs/brand/tiili.css`
  - proof: `diff -r docs/brand site/brand`
- [x] 1.2 Add `src/brandTokens.test.ts` (fast tier): it parses `tiili.css`, asserts every tiili-made theme in `THEMES` equals its block, and asserts the `site/brand` copy matches. Fix `TIILI_DARK_ANSI` ansi-8 to `#56615F`.
  Tests to update: src/themes.test.ts, src/theme.test.ts
  - proof: `npx vitest run src/brandTokens.test.ts src/themes.test.ts src/theme.test.ts`

## 2. Lint rule

- [x] 2.1 Add `@eslint/css` as a devDependency and `eslint-rules/brand-tokens.js` (the `brand/tokens` rule: colour index from `tiili.css`, OKLab nearest match, exact-match fix, suggestion, size families, `tokens-allow:`, file and theme-id allow options, and an HTML `<style>` processor). Add the rule's table-driven `RuleTester` test `eslint-rules/brand-tokens.test.ts` (fast tier).
  - proof: `npx vitest run eslint-rules/brand-tokens.test.ts`
  - proof: `npx eslint eslint-rules/brand-tokens.js eslint-rules/brand-allow.js`
- [x] 2.2 Wire the rule into `eslint.config.js` for `src/**/*.css`, `src/**/*.ts` (not `*.test.ts`), `site/**/*.css` and `site/*.html`, with `site/brand/` and `docs/` ignored. Add the theme-id and Heynote allowances.
  - proof: `npx eslint eslint.config.js`

## 3. Clean-up so lint lands green

- [x] 3.1 `src/styles.css`: the `#000` color-mix shadows become `--shadow-*`; the 3px radii become `var(--radius-brick)`; the `-4px` margin becomes `calc(-1 * var(--space-1))`; the 11.5px sizes become `var(--text-label)`; every other literal becomes a token or gets a `tokens-allow:` reason (traffic lights, 50% circles, hairlines).
  - proof: `npx eslint src/styles.css`
- [x] 3.2 TS sources: the `LIFTED` shadow in `src/layout/motion.ts` becomes `var(--shadow-*)`; `src/splash.ts` `BRICK` reads tokens (koski becomes dark `--bg`) and `#ffe6d2` becomes `--tiili-laasti`; `onAccent` in `src/themes.ts` uses `#2A2321` from the token table. Fix any other reports in `src/`.
  Tests to update: src/themes.test.ts
  - proof: `npx eslint src`
  - proof: `npx vitest run src/themes.test.ts src/brandTokens.test.ts`
  - proof: `npm run typecheck`
- [x] 3.3 `site/index.html` `<style>` and any `site/**/*.css`: replace the literals with tokens from `brand/tiili.css`.
  - proof: `npx eslint site`
  - proof: `openspec validate brand-token-check-make-use-the-brand-tok --strict`

## Manual checks after merge (The user)

- Open tiili in light, dark and each variant: shadows, splash and the custom-accent label look as before (the label is slightly warmer).
- Open the site's index page: the colours look as before.
