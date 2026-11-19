## Approach

- `src/updateDialog.ts`: export `renderInline` (one inline run as a DOM node, text nodes only; links call `open`).
- `src/updates.ts`: `WHATS_NEW_LIMIT` (6) moves here from `src/whatsNewDialog.ts`, and `whatsNewPanelItems(items)` returns the first `WHATS_NEW_LIMIT` items as `parseInline` runs.
- `src/whatsNewDialog.ts`: each `<li>` is built from `whatsNewPanelItems` with `renderInline`; a link opens through `openUrl`, and a failure shows in the panel's status line, as in the update dialog.
- `src/styles.css`: `.update-items code` and `.update-items a` share the `.update-markdown` rules.
