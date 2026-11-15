# Fix CodeQL alert 1: incomplete HTML tag stripping in plainNotes

## Why
CodeQL (js/incomplete-multi-character-sanitization, alert 1) flags `plainNotes` in `src/updates.ts`: one pass of `/<[^>]*>/g` can leave a tag behind (`<scr<b>ipt>` → `<script>`). It is not exploitable today, since `updateDialog.ts` renders the notes as text only, but the function should do what its name says, and a later switch to innerHTML must not be able to turn this into an injection.

## What Changes
- `plainNotes` repeats the tag removal until the text stops changing, then removes any `<` or `>` left over, then strips heading markers and trims as it does now.
- A comment at `plainNotes` says its output is shown as text, never as HTML.
- A table-driven unit test in `src/updates.test.ts` covers `<scr<b>ipt>alert(1)</script>`, `<<b>b>` and a stray `<`.

## Acceptance
- None of the new test inputs produce output that contains `<` or `>`; the existing plainNotes cases still pass.
- After merge, CodeQL alert 1 closes on the next run on main.

## Citations
- openspec/specs/app-updates/spec.md, "Release notes in the update dialog": shows the notes as plain text without tags (this change keeps that contract).
- src/updates.ts `plainNotes`; src/updates.test.ts "whatsNew and plainNotes".

## Assumptions
- Every `<`/`>` left over is removed, including literal ones in prose such as `a < b`. The alternative, escaping them, ruled out: the card asks for removal, and the notes are shown as text anyway.
