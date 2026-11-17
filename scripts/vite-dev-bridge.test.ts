// @harvaaja-test-tier: fast
import type { ConfigEnv, UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import { devBridge, lookupPr } from "../vite.config";

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

describe("lookupPr", () => {
  it.each([
    ["Dev build with a pull request: the number is found", "0.0.0-dev", {}, "123\n", 1, "123"],
    ["Release: gh is not asked", "1.2.3", {}, "123\n", 0, ""],
    ["Tests: gh is not asked, so no GitHub request is made", "0.0.0-dev", { VITEST: "true" }, "123\n", 0, ""],
    ["Dev build without a pull request: the number is empty", "0.0.0-dev", {}, "", 1, ""],
  ])("%s", (_name, version, env, output, calls, expected) => {
    let asked = 0;
    const ask = () => {
      asked += 1;
      return output;
    };
    expect(lookupPr(version, env, ask)).toBe(expected);
    expect(asked).toBe(calls);
  });

  it("Dev build where gh fails: the number is empty", () => {
    const ask = () => {
      throw new Error("gh: not found");
    };
    expect(lookupPr("0.0.0-dev", {}, ask)).toBe("");
  });
});
