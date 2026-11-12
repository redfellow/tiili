# Add a README

## Why
The repository has no README, so a newcomer cannot tell what it is or where its specs live.

## What Changes
- Add `README.md` at the repository root with: the title `tiili`; one line saying the repository is planned and built through härvääjä with OpenSpec; where specs (`openspec/specs`) and changes (`openspec/changes`) live.
- No code, no new tools, no spec change.

## Outcome
- Repository root README
  - After: `# tiili` followed by a line about härvääjä and OpenSpec and the two folder paths.

## Acceptance
- `README.md` exists at the root and names tiili, härvääjä, OpenSpec, `openspec/specs` and `openspec/changes`.
- `openspec validate --all --strict` passes.

## Citations
- Card description (contents and proof).
- `.harvaaja/instructions/plan.md`: only checked artifact is `openspec validate --all --strict`.
- Repository root has no README today.

## Assumptions
- Plain Markdown, about five lines; ruled out a longer README with setup or contribution sections.
