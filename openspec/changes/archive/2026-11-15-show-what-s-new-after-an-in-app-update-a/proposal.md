## Why
After an in-app update, the user never learns what changed. The "Install update?" dialog also shows the raw release body: the `## What's new` heading, `<details><summary>` HTML, the PR-title list and the changelog line.

## What Changes
- A new pure parser `whatsNew(body)` in `src/updates.ts` returns the bullets under `## What's new`. It stops at the next heading, `<details>` or `**Full changelog`. A second helper returns the body as plain text with HTML tags and markdown headings removed. Both have unit tests based on the real v0.3.0 body, a body with no What's new section and an empty body.
- Install now saves `{ version, items }` in localStorage (`tiili.updates.whatsNew`) before downloading and installing.
- At startup, the first window checks the running version (`APP_VERSION`). If it matches the saved version, it shows a small "What's new in tiili X.Y.Z" panel with the first 6 items, a "See all changes" link to the release page and a Close button, then clears the saved entry. If the versions differ, it clears the entry without showing anything. This makes no network request.
- The update dialog shows the What's new items as a list, followed by a "See all changes" link to the release page. A body with no What's new section falls back to its cleaned plain text.
- Styling uses `docs/brand` tokens and follows the existing update dialog.

## Outcome
- Update dialog notes
  - Now: `## What's new`, then the bullets, then `<details><summary>All changes (10)</summary>`, the PR titles and `**Full changelog:** https://…`
  - After: a list of the What's new items, then `See all changes`
- First start after installing 0.4.0 from the app
  - After: `What's new in tiili 0.4.0`, up to 6 items, `See all changes`, `Close`

## Assumptions
- The panel shows the first 6 items, at the top of the brief's "5-6" range. This rules out 5.
- If the saved version differs from the running one (the install failed, or a different version was installed), the entry is cleared without showing the panel. The alternative was keeping it until a matching start.
- The update dialog lists all of the What's new items. Only the post-update panel is capped.
- The panel is a modal `<dialog>` like the update dialog, and Close or Esc dismisses it. A non-modal toast was ruled out.
- A `.deb` install never saves an entry, because it has no Install now.
