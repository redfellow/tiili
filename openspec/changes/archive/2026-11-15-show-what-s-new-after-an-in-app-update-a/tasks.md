## 1. Parser and saved entry

- [x] 1.1 Add `whatsNew(body)` and `plainNotes(body)` to `src/updates.ts`, with table-driven tests in `src/updates.test.ts` built from the real v0.3.0 body (9 items, stopping before `<details>`), a body with no What's new section and an empty body
  - proof: `npx vitest run src/updates.test.ts`
  - proof: `npx eslint src/updates.ts src/updates.test.ts`
- [x] 1.2 Add `saveWhatsNew`/`takeWhatsNew` (key `tiili.updates.whatsNew`), add `whatsNew` to `FoundUpdate`, and save the entry in `install` before `downloadAndInstall`. Test that take returns the items once on a matching version, clears the entry on a mismatch, and tolerates corrupt JSON
  - proof: `npx vitest run src/updates.test.ts`
  - proof: `npx eslint src/updates.ts src/updates.test.ts`

## 2. UI

- [x] 2.1 In `src/updateDialog.ts`, show the What's new items as a list plus a "See all changes" link, falling back to `plainNotes`. Update the doc comment
  - proof: `npx eslint src/updateDialog.ts`
- [x] 2.2 Add `src/whatsNewDialog.ts` (first 6 items, See all changes, Close/Esc) and call it from `src/main.ts` in the first window after the splash, before `startupCheck`. Add styles in `src/styles.css` using the brand tokens and matching `.update-dialog`
  - proof: `npx eslint src/whatsNewDialog.ts src/main.ts`
  - proof: `npm run typecheck`
- [x] 2.3 Validate the spec delta
  - proof: `openspec validate show-what-s-new-after-an-in-app-update-a --strict`

## Manual checks after merge (The user)

- Open the update dialog for a release (for example v0.3.0's body): it shows only the What's new bullets and a See all changes link, with no `##`, `<details>` or changelog line.
- Update from inside the app: after the restart, a "What's new in tiili X.Y.Z" panel shows up to 6 items. See all changes opens the release page, Close dismisses it, and it does not return on the next start.
