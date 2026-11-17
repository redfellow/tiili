## MODIFIED Requirements

### Requirement: Release notes in the update dialog
The update dialog SHALL show the release body rendered as basic Markdown (headings, paragraphs, lists, bold, italic, inline code and links), with a link to the release page, and SHALL NOT show `<details>` blocks, the Full changelog line, HTML tags or Markdown markers as text. Only `https:` links SHALL be clickable, opening in the system browser; other links show their text.

#### Scenario: Body with What's new
- **WHEN** the release body has a What's new list followed by a details block and a Full changelog line
- **THEN** the dialog shows the What's new heading and its items as a list, without the details block or changelog line, and a See all changes link

#### Scenario: Body without What's new
- **WHEN** the release body has a `Highlights` heading and items like `- **Tabs in a window.** Open several tabs`
- **THEN** the dialog shows a heading and a list whose items start with bold text, with no `#`, `-` or `**` markers

#### Scenario: Unsafe link
- **WHEN** the body contains `[x](javascript:alert(1))`
- **THEN** the dialog shows `x` as plain text, not a link
