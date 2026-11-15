## ADDED Requirements

### Requirement: Shadow, type and variant tokens
`docs/brand/tiili.css` SHALL define `--shadow-*` elevation tokens, `--text-*` font-size tokens matching the brand README type table, and a `:root[data-variant="<id>"]` block for each of the Savi, Muratti, Koski and Laasti variants. The brand README SHALL document what each semantic token is for.

#### Scenario: Variant blocks present
- **WHEN** `docs/brand/tiili.css` is read
- **THEN** it holds a block for each of `savi`, `muratti`, `koski` and `laasti`, together with the shadow and text tokens

### Requirement: Theme copies match the tokens
Every tiili-made theme in the app SHALL hold the same token values as its block in `docs/brand/tiili.css`, and a unit test SHALL fail when they differ.

#### Scenario: Dark theme in step
- **WHEN** the drift test compares tiili-dark with `:root[data-theme="dark"]`
- **THEN** every value, including `--ansi-8` `#56615F`, is equal

### Requirement: Lint rejects invented colours and sizes
`npm run lint` SHALL report every colour literal in the app's and the site's styles and in non-test TypeScript strings, and every size literal that exactly equals a token of its property's family. Its message SHALL name the token to use: it SHALL autofix an exact match and suggest the nearest token for a near colour. Declared third-party palettes, the Heynote grounds, `@font-face` and `tokens-allow:` lines are allowed.

#### Scenario: Exact colour
- **WHEN** a stylesheet in `src/` declares `color: #A4472B`
- **THEN** lint reports it with a fix to the matching `var(--…)` token

#### Scenario: Near colour
- **WHEN** a stylesheet declares a colour that matches no token
- **THEN** lint reports it with a suggestion naming the nearest token

#### Scenario: Allowed literal
- **WHEN** a line carries a `tokens-allow: <reason>` comment, or a hairline `1px` border
- **THEN** lint reports nothing
