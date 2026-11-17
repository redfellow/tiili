## Why
The update dialog shows release notes as monospace raw text when the body has no What's new heading, so `**bold**` and `- ` markers show literally. Reijo wants cheap, low-footprint Markdown rendering for the patch notes.

## What Changes
- The update dialog renders the whole release body as basic Markdown (headings, paragraphs, `-`/`*`/`1.` lists, `**bold**`, `*italic*`, `` `code` ``, `[text](url)` links) instead of the What's new list or the plain-text fallback.
- `<details>` blocks and the `**Full changelog` line are still left out; other HTML is stripped as before.
- Links with `https:` URLs open in the system browser; other links show as their text.
- A tiny in-house parser builds DOM nodes (never innerHTML); no new dependency.
- The What's new panel after an update is unchanged (it still uses the saved What's new items).

## Outcome
- Notes without a What's new heading (the screenshot)
  - Now: ![monospace raw notes](../../../card-plans/616e6517-4093-4ceb-b5e5-5ffdd4c346ce/attachments/image.png)
  - After: `Highlights` as a heading, then a bulleted list whose items start with bold `Tabs in a window.`, in the dialog's normal font
- Notes with a What's new heading
  - Now: only the What's new bullets
  - After: the whole body (minus details block and Full changelog line) rendered as Markdown

## Assumptions
- Headings render as one small heading style (h3/h4) regardless of level, rather than full h1–h6 sizes.
- Nested lists, tables, images, blockquotes and fenced code are shown as plain paragraph text, rather than supported.
- `whatsNew()` stays for saving the post-update panel's items; `plainNotes()` is removed if nothing else uses it.
