# Theme-aware brand lockup as the README header

## Why
The public README opens with the bare mark and a separate "tiili" heading. The finished lockup (mark + brick-dot wordmark) exists on branch `docs/readme-lockup` (PR #52) and should land on hv/main.

## What Changes
- Bring `docs/brand/logo/lockup-dark.svg` and `docs/brand/logo/lockup-light.svg` from `origin/docs/readme-lockup` unchanged.
- `README.md`: replace the mark `<picture>` and `<h1>tiili</h1>` with a centred `<picture>`: dark source `lockup-dark.svg` for `(prefers-color-scheme: dark)`, `<img src="docs/brand/logo/lockup-light.svg" alt="tiili" width="360">` fallback (as on the branch).
- `docs/brand/README.md`: list `lockup-{light,dark}.svg` in the logo files line.

## Outcome
- README header
  - Now: mark image above a `tiili` heading
  - After: one lockup image (mark + wordmark), dark or light following the reader's GitHub theme

## Acceptance
- Both SVGs match `origin/docs/readme-lockup` byte for byte and render via @resvg/resvg-js without error.
- README header is the `<picture>` above; no `<h1>tiili</h1>` remains.

## Citations
- README.md:1-8; `git diff HEAD...origin/docs/readme-lockup`; docs/brand/README.md:37

## Assumptions
- Files are taken verbatim from the branch (`git checkout origin/docs/readme-lockup -- <files>` during the build), not regenerated; alternative was rebuilding them from the brand book.
- The README header is checked by grep rather than a diff against the branch, so later README edits on the base don't break the proof; alternative was diffing the whole README against the branch.
- Closing PR #52 as superseded is listed as a manual step after merge, since the build should not act on GitHub PRs.
