# Brand-token check

## Why
"Use the brand tokens, never invent colours" is a rule cards keep breaking: invented shadows, copied palettes, and a dark `--ansi-8` in `src/themes.ts` (`#626C6A`) that has drifted from `docs/brand/tiili.css` (`#56615F`). Make it a check a card can't get past.

## What Changes
- `docs/brand/tiili.css` gains `--shadow-*` and `--text-*` (from the README type table) and four variant blocks, `:root[data-variant="savi|muratti|koski|laasti"]`. These blocks are only the source the drift test reads; the app keeps applying variants inline through `setProperty`.
- `docs/brand/README.md` gets a table saying what each semantic token is for (`--bg`, `--surface`, `--sunken`, `--fg`, `--muted`, `--line`, `--accent*`, `--on-accent`, `--focus`, `--term-*`, `--mark-*`, `--dot`), plus the shadow and text tokens. `site/brand/` is kept as an identical copy.
- Drift test (vitest): every tiili-made theme in `THEMES` (tiili-light, tiili-dark, Savi, Muratti, Koski, Laasti) equals its block in `tiili.css`. It fixes dark `--ansi-8` to `#56615F`.
- A lint rule in `npm run lint` (eslint with `@eslint/css` and a local plugin) covers `src/**/*.css`, string literals in `src/**/*.ts` (tests excluded), `site/**/*.css` and the `<style>` blocks of `site/*.html`. It flags hex, `rgb()`/`hsl()` and named colours. An exact token match is autofixed to the token, with semantic tokens preferred over palette ones. A near colour gets a suggestion naming the nearest token by OKLab ΔE. Sizes are flagged only when they exactly equal a token of their property's family.
- Allowed by the rule: the Solarized, Gruvbox, Nord and Dracula palettes and, by theme id, the tiili-made themes (which the drift test checks) in `themes.ts`, the Heynote grounds (`heynotePane.ts`, `scripts/heynote.mjs`), `@font-face`, and lines marked `tokens-allow: <reason>`.
- Clean-up so the rule lands green: `styles.css` shadows, radii, margin and 11.5px font sizes; the `LIFTED` shadow in `layout/motion.ts`; the `BRICK` palette copy and `#ffe6d2` highlight in `splash.ts`; `onAccent` `#1B1614` in `themes.ts`; and the colours in `site/index.html`.
- The brand-tokens spec gains requirements for all of this.

## Outcome
- Dark terminal, bright black (ANSI 8)
  - Now: `#626C6A`
  - After: `#56615F`
- Dark label on a light custom accent
  - Now: `#1B1614`
  - After: `var(--fg)`'s light value `#2A2321`
- Splash highlight
  - Now: `#ffe6d2`
  - After: `--tiili-laasti` `#E8DECD`
- A card writes `color: #A4472B` in `src/styles.css`
  - After: lint fails with `Use var(--accent) instead of #A4472B` and an autofix

## Assumptions
- `onAccent`'s dark choice uses `--fg` light (`#2A2321`), the same dark label colour the tints use. Rejected: `--tint-3-on` `#1B2224`, which is bluer.
- The `#ffe6d2` highlight maps to `--tiili-laasti`. Rejected: `--tiili-kalkki`, which is too pale to read as a highlight.
- `site/brand/` stays a byte-identical copy of `docs/brand/`, checked by the drift test. It is not linted itself, because it holds the token source. Rejected: linting the copy.
- The `site/*.html` `<style>` blocks are linted through a small eslint processor that extracts them as CSS. Rejected: a separate script outside `npm run lint`.
- Shadow token values are taken from the current `styles.css` shadows, de-duplicated into at most three steps (`--shadow-1..3`). Rejected: inventing a new elevation scale.
- The `--text-*` values come from the README type table, plus `--text-label: 11.5px` if the table lacks it.
- A string literal in `.ts` is checked only when its whole value parses as a CSS colour or a CSS declaration value. Rejected: scanning every string, which would flag ids and text.
- The tiili-made themes are exempted by theme id in `allowThemeIds`, with the drift test standing in for lint. Rejected: a `tokens-allow:` line on every theme colour, which would only repeat the same reason.
- No change to `checks.yaml`: the rule runs through `npm run lint`.
- These are left for separate cards: themes that don't set `--sunken`, `--accent-hover` and the like, and `hv brand`'s brand-book path.
