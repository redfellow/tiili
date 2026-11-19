## Why

The release notes' "What's new" lists the one-line update notes written when each change merged, newest promotion first. For 1.2.0 that meant no order by impact, flat wording, an in-joke ("koivu ring") and one wrong claim (that clicking the Dock icon opens a window; it is the right-click menu). The owner rewrote them by hand with Claude, then had to fix `latest.json` separately so the in-app dialog showed the same text. `npm run release` should do that itself.

## What Changes

- Before tagging, on a terminal with the `claude` CLI, `npm run release` has Claude write "What's new" from the full descriptions (Why / What changes / Outcome, or a fast-lane pull request's commit messages) of every pull request the promotions since the last tag carry, with the short update notes as hints. The rules: order by impact, security fixes after the headline features, `**Headline.** sentences` bullets, accurate to the pull requests, plain English with no codenames, in-jokes or Finnish words, and leave out what users never see.
- It shows the notes and asks: use them, edit them in `$VISUAL` / `$EDITOR` first, or keep the workflow's notes. Off a terminal, without `claude`, with `TIILI_RELEASE_NOTES=auto` or when Claude fails, the workflow's notes stay.
- The chosen notes go on the draft as soon as it exists, so the manifest job copies them into `latest.json`. Before publishing, the release and `latest.json` are checked and set again if they differ. The notes wait in a temporary file, so a rerun after a stop reuses them.
- The collapsed list of every change and the Full changelog link stay as `scripts/release-notes.mjs` builds them.
- The live build view keeps a space after a job name of 8 letters or more ("manifest waiting", not "manifestwaiting").
- docs/packaging.md's Releasing section describes the command as it is now: no refusal of a dirty tree, automatic publishing, the notes.

## Outcome

- `npm run release minor`
  - Now: tags, builds and publishes with the promotions' update notes in promotion order
  - After: first shows Claude's notes ordered by impact and asks `Use these notes? [Y]es, [e]dit first, [n]o`, then tags, builds and publishes with the chosen notes on the release page and in `latest.json`

## Assumptions

- Claude runs on the owner's machine through the signed-in `claude` CLI, with no tools, outside the repository. CI keeps writing the workflow's notes, so no API key is stored on GitHub.
- The notes are decided before the tag is pushed, so the prompt never competes with the live build view.
