// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { buildArgs, builtAppPath, dockEntryXml, isPinned } from "./install-app.mjs";

describe("install-app", () => {
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
    expect(buildArgs()).toEqual(["tauri", "build", "--bundles", "app"]);
    expect(builtAppPath("/repo")).toBe("/repo/src-tauri/target/release/bundle/macos/tiili.app");
  });
});
