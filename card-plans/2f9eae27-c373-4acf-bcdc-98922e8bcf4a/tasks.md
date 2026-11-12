# Tasks

- [x] 1.1 Add `README.md` at the repository root with the project name tiili, one line saying it is planned and built through härvääjä with OpenSpec, and that specs live in `openspec/specs` and changes in `openspec/changes`
  - proof: `grep -E 'openspec/specs' README.md && grep -E 'openspec/changes' README.md && grep -E 'tiili' README.md`
  - proof: `openspec validate --all --strict`
