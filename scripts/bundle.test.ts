// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { bundleArgs } from "./bundle.mjs";

const NO_UPDATER = ["--config", '{"bundle":{"createUpdaterArtifacts":false}}'];

describe("bundle", () => {
  it.each([
    ["Local bundle without the key: updater bundles are off", "linux", [], {},
      ["tauri", "build", "--bundles", "appimage,deb", ...NO_UPDATER, "--", "--no-default-features"]],
    ["an empty key counts as missing", "win32", [], { TAURI_SIGNING_PRIVATE_KEY: "" },
      ["tauri", "build", "--bundles", "nsis", ...NO_UPDATER, "--", "--no-default-features"]],
    ["with the key the config's updater bundles are made", "darwin", [], { TAURI_SIGNING_PRIVATE_KEY: "key" },
      ["tauri", "build", "--target", "aarch64-apple-darwin", "--bundles", "app,dmg", "--", "--no-default-features"]],
    ["extra arguments after -- keep their cargo arguments", "linux", ["--verbose", "--", "--locked"],
      { TAURI_SIGNING_PRIVATE_KEY: "key" },
      ["tauri", "build", "--bundles", "appimage,deb", "--verbose", "--", "--locked", "--no-default-features"]],
  ])("%s", (_name, platform, extra, env, expected) => {
    expect(bundleArgs(platform, extra, env)).toEqual(expected);
  });

  it("has no installers for an unknown platform", () => {
    expect(bundleArgs("aix", [], {})).toBeUndefined();
  });
});
