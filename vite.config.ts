import type { UserConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// Vite settings for Tauri: fixed port, no screen clearing, and src-tauri left to cargo.
// Keep runtime imports out of this file other than plain vite: the design preview's dev
// server loads it before vitest is necessarily installed. Test settings live in vitest.config.ts.
const config: UserConfig = {
  clearScreen: false,
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
