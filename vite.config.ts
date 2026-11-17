import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { Plugin, UserConfig } from "vite";
import { parsePrNumber } from "./src/prNumber";

/**
 * The app version from src-tauri/Cargo.toml's [package] table (Tauri reads the same one), baked into the frontend as
 * `__APP_VERSION__`. package.json has no version, so npm's script banner shows none.
 */
const cargoToml = readFileSync(new URL("./src-tauri/Cargo.toml", import.meta.url), "utf8");
const appVersion = /^\[package\][^[]*?^version\s*=\s*"([^"]+)"/m.exec(cargoToml)?.[1] ?? "0.0.0-dev";

/** Asks `gh` for the current branch's pull request number; throws when `gh` is missing or fails. */
function askGh(): string {
  return execFileSync("gh", ["pr", "view", "--json", "number", "-q", ".number"], {
    encoding: "utf8",
    timeout: 5000,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/**
 * The pull request number of the checked-out branch, from `gh`, baked into the frontend as `__APP_PR__`. Only a dev
 * build (a pre-release version) looks; a release, a missing `gh`, no pull request or any failure gives "" so the
 * build never fails over it. It never looks under Vitest (`VITEST` is set), so tests make no GitHub request.
 */
export function lookupPr(
  version: string,
  env: Record<string, string | undefined> = process.env,
  ask: () => string = askGh,
): string {
  if (!version.includes("-") || env.VITEST) return "";
  try {
    return parsePrNumber(ask());
  } catch {
    return "";
  }
}

const host = process.env.TAURI_DEV_HOST;

/** Hosts a Vite dev server may bind to while it proxies a shell: this machine only (`undefined`/`false` = Vite's own localhost). */
export function isLoopbackHost(host: string | boolean | undefined): boolean {
  return host === undefined || host === false || host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Dev server only: when `npm run dev:browser` set the bridge's port and per-run token, gives the page the
 * token in a meta tag and proxies `/pty` WebSockets to the dev bridge. Builds never see any of it.
 * It refuses to start when the server is bound beyond this machine: the page carries the token and the proxy opens a
 * login shell, so anyone on the network could use both.
 */
export function devBridge(env: Record<string, string | undefined> = process.env): Plugin {
  const port = env.TIILI_BRIDGE_PORT;
  const token = env.TIILI_BRIDGE_TOKEN;
  return {
    name: "tiili-dev-bridge",
    apply: "serve",
    config(user) {
      if (!port || !token) return {};
      const bound = user.server?.host;
      if (!isLoopbackHost(bound)) {
        throw new Error(
          `tiili dev bridge: refusing to serve a shell on host ${String(bound)}; use 127.0.0.1 or localhost`,
        );
      }
      return { server: { proxy: { "/pty": { target: `ws://127.0.0.1:${port}`, ws: true } } } };
    },
    transformIndexHtml: () =>
      port && token ? [{ tag: "meta", attrs: { name: "tiili-bridge-token", content: token }, injectTo: "head" }] : [],
  };
}

// Vite settings for Tauri: fixed port, no screen clearing, and src-tauri left to cargo.
// Keep runtime imports out of this file other than plain vite: the design preview's dev
// server loads it before vitest is necessarily installed. Test settings live in vitest.config.ts.
const config: UserConfig = {
  clearScreen: false,
  define: { __APP_VERSION__: JSON.stringify(appVersion), __APP_PR__: JSON.stringify(lookupPr(appVersion)) },
  plugins: [devBridge()],
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2022",
  },
};

export default config;
