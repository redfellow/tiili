// @harvaaja-test-tier: fast
import type { ConfigEnv, UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import { devBridge } from "../vite.config";

const ENV: ConfigEnv = { command: "serve", mode: "development" };
const BRIDGE = { TIILI_BRIDGE_PORT: "4000", TIILI_BRIDGE_TOKEN: "secret" };
const PROXY = { server: { proxy: { "/pty": { target: "ws://127.0.0.1:4000", ws: true } } } };

function run(env: Record<string, string | undefined>, host: string | boolean | undefined) {
  const plugin = devBridge(env);
  const config = plugin.config as (user: UserConfig, env: ConfigEnv) => unknown;
  return config({ server: { host } }, ENV);
}

describe("dev bridge host check", () => {
  it.each([undefined, false, "localhost", "127.0.0.1", "::1"])(
    "Bridge is local: host %s keeps the proxy",
    (host) => {
      expect(run(BRIDGE, host)).toEqual(PROXY);
    },
  );

  it.each([true, "0.0.0.0", "192.168.1.20"])("Bridge is local: host %s is refused", (host) => {
    expect(() => run(BRIDGE, host)).toThrow(
      `tiili dev bridge: refusing to serve a shell on host ${String(host)}; use 127.0.0.1 or localhost`,
    );
  });

  it.each([{}, { TIILI_BRIDGE_PORT: "4000" }, { TIILI_BRIDGE_TOKEN: "secret" }])(
    "Bridge is local: without port and token (%j) any host is left alone",
    (env) => {
      expect(run(env, "0.0.0.0")).toEqual({});
    },
  );
});
