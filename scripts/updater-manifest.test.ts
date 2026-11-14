// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { buildManifest } from "./updater-manifest.mjs";

const URL = "https://github.com/redfellow/tiili/releases/download/v0.3.0";
const PUB_DATE = "2026-11-14T12:00:00.000Z";
const signatures = {
  "tiili.app.tar.gz.sig": "mac-signature\n",
  "tiili_0.3.0_x64-setup.exe.sig": "windows-signature\n",
  "tiili_0.3.0_amd64.AppImage.sig": "linux-signature\n",
  "tiili_0.3.0_amd64.deb.sig": "not an updater bundle",
};

describe("updater manifest", () => {
  it("Secrets set: latest.json holds version 0.3.0 and all three platforms", () => {
    expect(buildManifest({ tag: "v0.3.0", notes: "Updates.\n", signatures, pubDate: PUB_DATE })).toEqual({
      version: "0.3.0",
      notes: "Updates.",
      pub_date: PUB_DATE,
      platforms: {
        "darwin-aarch64": { signature: "mac-signature", url: `${URL}/tiili.app.tar.gz` },
        "windows-x86_64": { signature: "windows-signature", url: `${URL}/tiili_0.3.0_x64-setup.exe` },
        "linux-x86_64": { signature: "linux-signature", url: `${URL}/tiili_0.3.0_amd64.AppImage` },
      },
    });
  });

  it.each([
    ["darwin-aarch64", "tiili.app.tar.gz.sig"],
    ["windows-x86_64", "tiili_0.3.0_x64-setup.exe.sig"],
    ["linux-x86_64", "tiili_0.3.0_amd64.AppImage.sig"],
  ])("fails when the %s signature is missing", (platform, file) => {
    const without = Object.fromEntries(Object.entries(signatures).filter(([name]) => name !== file));
    expect(() => buildManifest({ tag: "v0.3.0", notes: "", signatures: without, pubDate: PUB_DATE })).toThrow(platform);
  });

  it("fails for a tag that is not a version", () => {
    expect(() => buildManifest({ tag: "nightly", notes: "", signatures, pubDate: PUB_DATE })).toThrow();
  });
});
