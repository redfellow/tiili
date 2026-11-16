## ADDED Requirements

### Requirement: Heynote fonts in woff2 only
The Heynote build SHALL ship each font face only as `.woff2`, with no `.woff` files and no `format("woff")` sources in its CSS. The build SHALL fail if Heynote's output no longer has the expected woff and woff2 pairs.

#### Scenario: Built output
- **WHEN** `npm run heynote` finishes
- **THEN** `public/heynote/assets` has no `.woff` file, and every font URL in its CSS points at an existing `.woff2`
