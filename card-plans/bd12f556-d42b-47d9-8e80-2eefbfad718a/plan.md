# Dev bridge: refuse to proxy a shell when Vite binds a non-loopback host

## Why
`npm run dev:browser` puts the bridge token in index.html and Vite proxies `/pty` to the bridge from loopback. With
`--host` or `TAURI_DEV_HOST`, Vite serves on the LAN, so anyone on the network can read the token and open a login
shell as the developer. That breaks the "Bridge is local, tokened and dev-only" requirement's intent.

## What Changes
- `vite.config.ts` `devBridge()`: when `TIILI_BRIDGE_PORT` and `TIILI_BRIDGE_TOKEN` are set, the `config(user)` hook
  reads `user.server?.host` (CLI options are merged in) and throws
  `tiili dev bridge: refusing to serve a shell on host <h>; use 127.0.0.1 or localhost` unless the host is
  `undefined`, `false`, `"localhost"`, `"127.0.0.1"` or `"::1"` (`true` = all interfaces, refused). Otherwise it
  returns the proxy config as today. Without port and token nothing changes.
- Export the host check (e.g. `isLoopbackHost`) or the plugin factory so a unit test can call it.

## Outcome
- Dev server on a LAN host with the bridge
  - Now: starts and serves a shell to the network
  - After: `tiili dev bridge: refusing to serve a shell on host 0.0.0.0; use 127.0.0.1 or localhost`

## Acceptance
- `TIILI_BRIDGE_PORT=1 TIILI_BRIDGE_TOKEN=x npx vite --host 0.0.0.0` exits with the refusal message.
- The design check (`--host 127.0.0.1`) and plain `npm run dev:browser` still start.

## Citations
- openspec/specs/dev-browser-backend/spec.md — Requirement: Bridge is local, tokened and dev-only
- vite.config.ts — `devBridge()`

## Assumptions
- Only the listed literal hosts count as loopback (no `127.x.x.x` range, no hostname resolution); rules out a broader
  resolver-based check.
- The test lives in `scripts/vite-dev-bridge.test.ts` (vitest only includes src/, scripts/ and eslint-rules/); rules out widening vitest's include for a root test.
