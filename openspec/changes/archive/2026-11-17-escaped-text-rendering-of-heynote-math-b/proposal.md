## Why

The vendored Heynote bundle shows math-block results with `innerHTML`. A math line that evaluates to a string, or a custom `format()` result, that looks like HTML is therefore run as markup in the Heynote frame. That frame is same-origin, has no sandbox and no CSP, so it can reach tiili's Tauri `invoke` (including `pty_spawn` and `pty_write`). A pasted note could run shell commands as the user. This was found in a security audit.

## What Changes

- `scripts/heynote.mjs` patches Heynote's math-result widget source before the build, so that `displayResult` is set with `textContent`. The "Copied!" label also uses `textContent`. The build fails if the patch target is no longer there.
- A tested helper module holds the patch.
- `public/heynote/` is built again from the same pinned commit.
- Out of scope: sandboxing the iframe and adding a CSP. Both need bridge work, so they are left for a follow-up.

## Outcome

- A math line `"<b>hi</b>"`
  - Now: the result shows as bold `hi`. An `<img onerror=…>` string runs script.
  - After: `<b>hi</b>` shows as literal text.

## Assumptions

- The patch lives in a separate `scripts/heynote-patches.mjs` module so it can be unit-tested, rather than inline in `heynote.mjs`.
- The test runs the patched widget code against a small stub DOM, because the repo has no jsdom or happy-dom. Adding a DOM library was ruled out.
- The "Copied!" text is a constant, so it is not exploitable. It is switched to `textContent` anyway, to keep things consistent.
