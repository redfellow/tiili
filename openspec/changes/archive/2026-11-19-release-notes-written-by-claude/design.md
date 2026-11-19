## Approach

- `scripts/release-notes.mjs`: `pullNumbers`, `pullRequestBrief`, `claudePrompt`, `parseClaudeNotes` (pure, tested), async `mainEntries(range)` and `claudePromptFor(entries)` (parallel `gh pr view`), and a `whatsNew` option on `buildNotes`. The workflow's CLI use is unchanged.
- `scripts/release.mjs`: `writeNotes` before `tagMain` on a fresh release: a live spinner while the pull requests are read and `claude -p --tools "" --no-session-persistence --strict-mcp-config` answers (five-minute timeout), then the prompt (`notesChoice`). The notes are saved to `$TMPDIR/tiili-release-notes-vX.Y.Z.md`. `followBuild` sets them on the draft once it exists (one more line in the live view). `finishNotes` checks the release body and `latest.json` (`manifestWithNotes`) before publishing, and the file is removed once published.
- `notesModule()` loads `release-notes.mjs` beside the script, or origin/main's copy when `runLatest` runs the script from a temporary folder.
