// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { bundleArgs, dmgPostSteps } from "./bundle.mjs";

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

  const DMG = "/out/tiili_1.0.0_aarch64.dmg";
  const SCRATCH = { dir: "/scratch", password: "pw" };
  const CONVERT = [
    ["hdiutil", ["convert", DMG, "-format", "ULMO", "-ov", "-o", "/scratch/converted.dmg"]],
    ["mv", ["-f", "/scratch/converted.dmg", DMG]],
  ];
  const KEYCHAIN = "/scratch/signing.keychain-db";
  const ID = "Developer ID Application: Someone (TEAM)";

  it.each([
    ["Unsigned local bundle: the .dmg is converted and left unsigned", {}, CONVERT, []],
    ["an empty identity counts as missing", { APPLE_SIGNING_IDENTITY: "", APPLE_CERTIFICATE: "cert" }, CONVERT, []],
    ["DMG converted after the build: re-signed from the keychains when the identity is set",
      { APPLE_SIGNING_IDENTITY: ID }, [...CONVERT, ["codesign", ["--force", "--sign", ID, DMG]]], []],
    ["with a certificate it is signed from a keychain of its own, deleted afterwards",
      { APPLE_SIGNING_IDENTITY: ID, APPLE_CERTIFICATE: "cert", APPLE_CERTIFICATE_PASSWORD: "secret" },
      [
        ...CONVERT,
        ["security", ["create-keychain", "-p", "pw", KEYCHAIN]],
        ["security", ["unlock-keychain", "-p", "pw", KEYCHAIN]],
        ["security", ["import", "/scratch/certificate.p12", "-k", KEYCHAIN, "-P", "secret", "-T", "/usr/bin/codesign"]],
        ["security", ["set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", "pw", KEYCHAIN]],
        ["codesign", ["--force", "--sign", ID, "--keychain", KEYCHAIN, DMG]],
      ],
      [["security", ["delete-keychain", KEYCHAIN]]]],
  ])("%s", (_name, env, steps, cleanup) => {
    expect(dmgPostSteps(env, DMG, SCRATCH)).toEqual({ steps, cleanup });
  });
});
