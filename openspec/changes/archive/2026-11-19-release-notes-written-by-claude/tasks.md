## 1. Claude-written notes

- [x] 1.1 Add the brief, prompt and reply parsing to `scripts/release-notes.mjs` (and its `.d.mts`), with tests in `scripts/release-notes.test.ts`.
  Tests to update: scripts/release-notes.test.ts
  - proof: `npx vitest run scripts/release-notes.test.ts`
  - proof: `node scripts/release-notes.mjs v1.2.0 v1.1.1`
- [x] 1.2 Write, ask, apply and check the notes in `scripts/release.mjs` (and its `.d.mts`); keep a space after long job names; tests in `scripts/release.test.ts`.
  Tests to update: scripts/release.test.ts
  - proof: `npx vitest run scripts/release.test.ts`
  - proof: `npx eslint scripts/release.mjs scripts/release-notes.mjs scripts/release.test.ts scripts/release-notes.test.ts`
- [x] 1.3 Describe the release command and its notes in `docs/packaging.md`.
  - proof: `npx vitest run src/docs-sync`
  - proof: `openspec validate release-notes-written-by-claude --strict`

## Manual checks after merge (The user)

- On the next `npm run release`, Claude's notes are shown before the tag is pushed; after answering y, the published release and the app's update dialog show them.
