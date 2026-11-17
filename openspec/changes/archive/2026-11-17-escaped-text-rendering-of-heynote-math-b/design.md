## Approach

`public/heynote` is generated, so the fix is a source patch that runs in `scripts/heynote.mjs` beside the bridge swap.

- New `scripts/heynote-patches.mjs` (with `.d.mts`, like the other scripts) exports `patchMathResult(source)`. It takes the upstream math-result widget file (find it in the Heynote checkout with `grep -rn displayResult src/editor`). It replaces the `innerHTML = this.displayResult` assignment, and the "Copied!" `innerHTML`, with `textContent`. It throws if the source has no `innerHTML = this.displayResult`, and it throws if any `innerHTML` assignment is left in the widget.
- `heynote.mjs` reads that file, writes the patched text, restores the original in its `finally`, and mentions the patch in its header comment and in the generated README.
- Run `npm run heynote` (it clones the pinned commit) to regenerate `public/heynote`. Afterwards, `grep` the new `main-*.js` to confirm it has no `innerHTML=this.displayResult`.

## Test

`scripts/heynote-patches.test.ts` (fast) holds a small fixture of the upstream widget's `toDOM`. It patches the fixture, evaluates it with a stub `document` whose elements record `innerHTML` and `textContent`, and checks that the HTML-looking string result and the `format()` result land in `textContent` while `innerHTML` stays unset. The test is table-driven. A second case checks that the patch throws on source it does not recognise.
