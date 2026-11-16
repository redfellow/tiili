## Approach

- Workflow: reorder and harden steps only; signed and unsigned builds behave as before. Delivered as a triage task
  because `.github/workflows/` is human-only.
- Stale tag: add `export function tagPlan(existing, commit)` in `scripts/release.mjs` returning `"create"` (no local
  tag), `"push"` (local tag at `commit`) or `"retag"` (local tag elsewhere). `tagMain` reads
  `git rev-parse --verify --quiet refs/tags/<tag>^{commit}`, then runs `git tag -a` for create, `git tag -f -a` for
  retag, and pushes. The tag is not on origin at that point (checked first), so a forced local retag is safe.
- Bundle: `spawnSync(process.execPath, [resolve(root, "node_modules/@tauri-apps/cli/tauri.js"), ...args.slice(1)])`
  with no `shell`. Arguments reach the process as an array, so no quoting is lost. `bundleArgs` keeps its shape.
- Spec: rewrite the two requirements to what `scripts/release.mjs` and `release.yml` do now.
