## ADDED Requirements

### Requirement: Math results shown as text

The Heynote pane SHALL show every math-block result, including string results and the output of a custom `format` function, as literal text and never interpret it as HTML.

#### Scenario: HTML-looking math result shown literally

- **WHEN** a math-block line evaluates to the string `<img src=x onerror=alert(1)>`, directly or through `format`
- **THEN** the result widget shows those characters as text, and no element is created and no script runs
