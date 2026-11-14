# Tasks

- [ ] 1.1 Set `DEFAULT_SETTINGS.font.size` to 13 in `src/settings.ts`
  - Tests to update: none (src/settings.test.ts compares against DEFAULT_SETTINGS)
  - proof: `npx vitest run src/settings.test.ts`
  - proof: `npx eslint src/settings.ts`

## Manual checks after merge (The user)
- Install the new build, open Settings, press Reset to defaults, and check that Typography → Size shows 13.
