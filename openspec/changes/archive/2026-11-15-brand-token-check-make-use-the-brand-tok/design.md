# Design

## Tokens
`tiili.css` is the one source. The variant blocks use `:root[data-variant="<id>"]` and list exactly the properties the variant's `themes.ts` entry sets. `data-theme` keeps the kind. No runtime code sets `data-variant`: the blocks exist for the test and for documentation.

## Drift test
`src/brandTokens.test.ts` (`@harvaaja-test-tier: fast`) reads `docs/brand/tiili.css` with `fs`, parses each `selector { --name: value; }` block with a small regex parser, and maps the theme ids to selectors (tiili-light → `:root`, tiili-dark → `:root[data-theme="dark"]`, variants → `data-variant`). For each theme in `THEMES` with a tiili origin, it asserts that the theme's resolved token map equals the block (case-insensitive hex). Its second check asserts `site/brand/tiili.css` equals `docs/brand/tiili.css`. This reads token data rather than asserting copy, which is the point of the test.

## Lint rule
A local plugin, `eslint-rules/brand-tokens.js`, with one rule, `brand/tokens`, holding two visitors:
- CSS (`@eslint/css` language, `css/css`): checks declaration values. It skips `@font-face` and custom-property definitions in `tiili.css`.
- JS/TS: checks `Literal` and `TemplateElement` strings whose whole value is a colour or a CSS value.
The colour index is built once from `tiili.css` (light root values). Each colour is converted to OKLab. An exact match produces a `fix` to `var(--token)`, preferring semantic tokens, then tints, then palette. Otherwise a `suggest` names the nearest token and its ΔE. The message gives the exact replacement in the aihio style: `Use var(--x) instead of <literal>`. Sizes are checked only on `border-radius`, `padding*`/`margin*`/`gap` and `font-size`, and only on an exact equality with that family's token. A `tokens-allow:` comment on the same or the previous line suppresses the report. Allow lists by file and by theme id (the object whose `id` is solarized-*, gruvbox-*, nord, dracula) are options in `eslint.config.js`. For HTML, a processor in the same plugin extracts the `<style>` blocks of `site/*.html` as `.css` virtual files.

Rule tests use ESLint's `RuleTester` in vitest, table-driven: valid and invalid cases for CSS and TS, the autofix output, the suggestion and the allowances.
