## Why

Prose that repeats code drifts: the README and site shortcut tables list 7 shortcuts while `src/keymap.ts` handles about 18 actions, and the site table missed all 8 keymap commits. The build should hold the docs to the code so a card cannot change one without the other.

## What Changes

- A `SHORTCUTS` list beside `src/keymap.ts` (action, group, label, macOS chord, Windows/Linux chord); the keymap functions stay as they are.
- A vitest test that tries every key and modifier on each platform: every accepted chord has a list entry, and every entry's chords hit its action.
- `npm run docs` (`scripts/docs.mjs`) writes the grouped tables into README.md and site/index.html between `<!-- generated:shortcuts -->` markers; a test fails with "run npm run docs" when they are stale. The first run fixes today's drift.
- Check-only vitest tests: macOS menu accelerators in `src-tauri/src/lib.rs` match keymap actions (Cmd+Q excepted); theme families named in README and site; `tiili open`/`list` example flags exist in `USAGE`; every .woff2 covered by LICENSES.md; brand tint table matches tiili.css with contrast ratios; `npm run X` mentions exist and relative README/docs links resolve.

## Outcome

- README Shortcuts section
  - Now: `one 7-row table`
  - After: `one table per group (Panes, Tabs, Find, View and edit) listing every shortcut`
- Site "Hands stay on the keys" table
  - Now: `7 rows`
  - After: `every shortcut, one <tbody> per group with a heading row`

## Assumptions

- Group names are Panes, Tabs, Find, View and edit (Copy/Paste/Select all, zoom, Zen, Settings); ruled out finer groups.
- Heynote is marked in the list as having no chord and left out of the tables (Reijo's answer).
- After a merge conflict in the generated tables, the agent resolving it re-runs `npm run docs`; hv is not changed (Reijo's answer).
- The site group heading reuses the existing `table.keys th` style; no new CSS.
- Font coverage counts a .woff2 as covered when LICENSES.md names its file or font family; ruled out requiring each file name.
