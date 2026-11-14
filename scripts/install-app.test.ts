// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { buildArgs, builtAppPath, dependenciesStale, dockEntryXml, isPinned } from "./install-app.mjs";

describe("install-app", () => {
  const lock = (packages: Record<string, { version?: string; optional?: boolean }>) =>
    JSON.stringify({ packages: { "": { name: "tiili" }, ...packages } });

  it.each([
    ["nothing installed yet", undefined, true],
    ["installed matches the lock", lock({ "node_modules/a": { version: "1.0.0" } }), false],
    ["a new dependency", lock({}), true],
    ["a changed version", lock({ "node_modules/a": { version: "0.9.0" } }), true],
  ])("Dependencies after a promotion: %s", (_name, installed, expected) => {
    const wanted = lock({
      "node_modules/a": { version: "1.0.0" },
      "node_modules/@esbuild/win32-x64": { version: "0.25.0", optional: true },
    });
    expect(dependenciesStale(wanted, installed)).toBe(expected);
  });

  it.each([
    ["empty dock", "", false],
    ["other apps only", '(\n {\n "bundle-identifier" = "com.apple.Safari";\n }\n)', false],
    ["lookalike identifier", '"bundle-identifier" = "app.tiili-dev";', false],
    ["pinned by identifier", '"bundle-identifier" = "app.tiili";', true],
    ["pinned by path", '"_CFURLString" = "file:///Applications/tiili.app/";', true],
  ])("Already pinned: %s", (_name, dump, expected) => {
    expect(isPinned(dump)).toBe(expected);
  });

  it("First install: the Dock entry points at /Applications/tiili.app", () => {
    const xml = dockEntryXml();
    expect(xml).toContain("<string>/Applications/tiili.app</string>");
    expect(isPinned(xml)).toBe(true);
  });

  it("builds only the host-architecture .app", () => {
    expect(buildArgs()).toEqual(["tauri", "build", "--bundles", "app", "--", "--no-default-features"]);
    expect(builtAppPath("/repo")).toBe("/repo/src-tauri/target/release/bundle/macos/tiili.app");
  });
});
