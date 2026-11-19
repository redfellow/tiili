## ADDED Requirements

### Requirement: What's new items show their Markdown
Each item in the What's new panel SHALL show its inline Markdown (bold, italic, inline code and `https:` links) as the update dialog does, built from text nodes only, never HTML. A link SHALL open in the system browser.

#### Scenario: Item with bold
- **WHEN** a saved item is `**Close a pane right where it is.** Every pane has its own ×`
- **THEN** the panel shows "Close a pane right where it is." in bold followed by the rest as plain text, with no asterisks
