import { readFileSync } from "node:fs";
import type { Plugin, UserConfig } from "vite";

/** The app version from package.json (Tauri reads the same one), baked into the frontend as `__APP_VERSION__`. */
const appVersion = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;

const host = process.env.TAURI_DEV_HOST;

/**
 * Dev server only: when `npm run dev:browser` set the bridge's port and per-run token, gives the page the
 * token in a meta tag and proxies `/pty` WebSockets to the dev bridge. Builds never see any of it.
 */
function devBridge(): Plugin {
  const port = process.env.TIILI_BRIDGE_PORT;
  const token = process.env.TIILI_BRIDGE_TOKEN;
  return {
    name: "tiili-dev-bridge",
    apply: "serve",
    config: () =>
      port && token ? { server: { proxy: { "/pty": { target: `ws://127.0.0.1:${port}`, ws: true } } } } : {},
    transformIndexHtml: () =>
      port && token ? [{ tag: "meta", attrs: { name: "tiili-bridge-token", content: token }, injectTo: "head" }] : [],
  };
}

// Vite settings for Tauri: fixed port, no screen clearing, and src-tauri left to cargo.
// Keep runtime imports out of this file other than plain vite: the design preview's dev
// server loads it before vitest is necessarily installed. Test settings live in vitest.config.ts.
const config: UserConfig = {
  clearScreen: false,
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
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
