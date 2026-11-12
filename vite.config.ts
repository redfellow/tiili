import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

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
export default defineConfig({
  clearScreen: false,
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
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
