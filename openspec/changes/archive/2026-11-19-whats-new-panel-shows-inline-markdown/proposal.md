## Why

After updating to 1.2.0, the What's new panel showed each item's Markdown as raw text: `**New window from the Dock or taskbar.** Open a fresh tiili window…`, asterisks and all. The panel put each saved item into its list as plain text, while the update dialog already renders the same notes' bold, italic, code and links. Release notes now lead each item with a bold headline, so every item looked broken.

## What Changes

- The What's new panel renders each item's inline Markdown (bold, italic, inline code, `https:` links) with the update dialog's renderer, from text nodes only, never HTML. Links open in the system browser.
- The panel's item limit and parsing move into `src/updates.ts` as `whatsNewPanelItems`, so they are unit-tested without a DOM.
- The panel's code and links get the update dialog's styles.

## Outcome

- What's new in tiili 1.2.0, first item
  - Now: `**New window from the Dock or taskbar.** Open a fresh tiili window on the desktop you're on…`
  - After: **New window from the Dock or taskbar.** Open a fresh tiili window on the desktop you're on…

## Assumptions

- The saved items stay raw Markdown lines, so a panel saved by 1.2.0 before this fix renders correctly once the fix is installed; nothing in storage changes.
