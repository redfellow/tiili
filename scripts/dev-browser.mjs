// Browser preview with a real shell: builds the dev bridge, then runs it and the Vite dev server with a
// per-run token and a free loopback port. Stops the bridge when Vite exits, and both on SIGINT or SIGTERM.
// Arguments are passed to Vite, e.g. `npm run dev:browser -- --port 5173 --strictPort`.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = fileURLToPath(new URL("../src-tauri/Cargo.toml", import.meta.url));
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

/** Builds the bridge and returns its executable, wherever CARGO_TARGET_DIR puts it. */
function buildBridge() {
  const build = spawnSync(
    "cargo",
    ["build", "--manifest-path", manifest, "--bin", "dev-bridge", "--message-format=json-render-diagnostics"],
    { cwd: root, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (build.status !== 0) throw new Error(`building the dev bridge failed (${build.status ?? build.signal})`);
  for (const line of build.stdout.split("\n")) {
    if (!line.startsWith("{")) continue;
    const message = JSON.parse(line);
    if (message.reason === "compiler-artifact" && message.target?.name === "dev-bridge" && message.executable) {
      return message.executable;
    }
  }
  throw new Error("cargo did not report the dev bridge's executable");
}

/** A loopback port nothing listens on right now. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

const token = randomBytes(24).toString("hex");
const port = await freePort();
const env = { ...process.env, TIILI_BRIDGE_PORT: String(port), TIILI_BRIDGE_TOKEN: token };

const bridge = spawn(buildBridge(), [], { cwd: root, env, stdio: ["ignore", "inherit", "inherit"] });
const vite = spawn(process.execPath, [viteBin, ...process.argv.slice(2)], { cwd: root, env, stdio: "inherit" });

let stopping = false;
/** Stops both processes and exits with `code` once they are gone. */
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of [vite, bridge]) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
}

vite.on("exit", (code, signal) => stop(code ?? (signal ? 1 : 0)));
bridge.on("exit", (code) => {
  if (!stopping) console.error(`dev-bridge exited (${code}); stopping the dev server`);
  stop(code || 1);
});
vite.on("error", (error) => {
  console.error(`could not start vite: ${error.message}`);
  stop(1);
});
bridge.on("error", (error) => {
  console.error(`could not start the dev bridge: ${error.message}`);
  stop(1);
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => stop(130));
// Last resort: never leave the bridge behind, even if this script ends unexpectedly.
process.on("exit", () => {
  if (bridge.exitCode === null && bridge.signalCode === null) bridge.kill("SIGKILL");
});
