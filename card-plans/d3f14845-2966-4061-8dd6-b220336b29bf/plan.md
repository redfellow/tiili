# Tiili design mode dev server failing on missing vitest package in worktree

This card is a chore: it has no proposal, design or specs.

## Origin

Tiili design mode cannot start:

› git fetch origin hv/main
› git worktree add -b harvaaja/design-508802ec /Users/red/.local/share/hv-worktrees/tiili-60fa9839/_design 806f3d78
› npm run dev -- --port "$HV_PREVIEW_PORT" --strictPort

> tiili@0.1.0 dev
> vite --port 47818 --strictPort

› GET http://design-tiili-60fa9839.localhost:47818
vite.config.ts (1:384) [33m[UNRESOLVED_IMPORT] [0mCould not resolve 'vitest/config' in vite.config.ts
 - Module not found, treating it as an external dependency in vite.config.ts at 384..399

failed to load config from /Users/red/.local/share/hv-worktrees/tiili-60fa9839/_design/vite.config.ts
error when starting dev server:
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vitest' imported from /Users/red/.local/share/hv-worktrees/tiili-60fa9839/_design/vite.config.ts.timestamp-1794517570865-e42f196fc28418.mjs
    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:331:9)
    at packageResolve (node:internal/modules/esm/resolve:784:25)
    at moduleResolve (node:internal/modules/esm/resolve:873:18)
    at defaultResolve (node:internal/modules/esm/resolve:1006:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:708:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:728:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:766:56)
    at #resolve (node:internal/modules/esm/loader:690:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:610:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:277:33) {
  code: 'ERR_MODULE_NOT_FOUND'
}
npm run dev -- --port "$HV_PREVIEW_PORT" --strictPort exited 1
