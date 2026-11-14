## Why
`openspec validate --all --strict` fails on hv/main since #131: the settings requirement "Remote shells snippets" is over 500 characters. Auto merge is on hold until the check is green again.

## What Changes
- Reword "Remote shells snippets" more tightly so it is under 500 characters. It keeps the same obligations and all three scenarios.
- No behaviour, code or test changes.

## Assumptions
- I shortened the requirement in place rather than splitting it into two. The validator does not allow scenarios to move out of a MODIFIED requirement, and the existing scenario names that `src/remoteSnippets.test.ts` refers to stay as they are.
