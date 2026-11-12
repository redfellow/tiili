import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;

// Vite settings for Tauri: fixed port, no screen clearing, and src-tauri left to cargo.
export default defineConfig({
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
  test: {
    include: ["src/**/*.test.ts"],
  },
});
