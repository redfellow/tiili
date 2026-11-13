# Tasks

- [x] 1.1 Split the over-long "Settings dialogue", "Theme choice" and "Font settings" requirements in `openspec/specs/settings/spec.md` into shorter requirements (each under 500 characters, each with a scenario), keeping all SHALL statements and scenario titles
  - proof: `openspec validate settings --type spec --strict`
  - proof: `openspec validate --all --strict`
  - proof: `npx vitest run src/themes.test.ts`
