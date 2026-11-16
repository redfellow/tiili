# Tasks

- [x] 1.1 Refuse non-loopback hosts in `devBridge()`'s `config(user)` hook when bridge port and token are set; add a
  table-driven unit test (`scripts/vite-dev-bridge.test.ts`, first line `// @harvaaja-test-tier: fast`) covering undefined, false,
  localhost, 127.0.0.1, ::1 (allowed, proxy returned), true and 0.0.0.0 / a LAN IP (throws), and no port/token (returns `{}`).
  Keep vite.config.ts free of runtime imports other than vite.
  - proof: `npx vitest run scripts/vite-dev-bridge.test.ts`
  - proof: `npx eslint vite.config.ts scripts/vite-dev-bridge.test.ts`
  - proof: `npm run typecheck`

## Manual checks after merge (The user)
- `TIILI_BRIDGE_PORT=1 TIILI_BRIDGE_TOKEN=x npx vite --host 0.0.0.0` exits with the refusal message.
- `npm run dev:browser -- --host 127.0.0.1 --port 5173 --strictPort` starts and opens a working shell in the browser.
