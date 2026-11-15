## 1. Split the requirement

- [x] 1.1 Keep the delta in `openspec/changes/on-hold-openspec-4/specs/pane-tiling/spec.md` as planned, and check that it validates and that every requirement in it is at most 500 characters (change validation does not apply the length rule to deltas)
  - proof: `openspec validate on-hold-openspec-4 --strict && awk '/^### Requirement:/{getline; if (length($0) > 500) bad=1} END{exit bad}' openspec/changes/on-hold-openspec-4/specs/pane-tiling/spec.md`
