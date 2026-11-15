// @harvaaja-test-tier: fast
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FONTS = new URL("../assets/fonts/", import.meta.url);
const LICENSES = readFileSync(new URL("LICENSES.md", FONTS), "utf8");
const WOFF2 = readdirSync(FONTS).filter((file) => file.endsWith(".woff2"));

/** Whether LICENSES.md covers a font file: it names the file, or the family its name starts with (GeistMono-… → Geist Mono). */
function covered(file: string): boolean {
  const family = file.split("-")[0];
  return LICENSES.includes(file) || LICENSES.replace(/ /g, "").includes(family);
}

describe("bundled font licences", () => {
  it("finds the bundled fonts", () => {
    expect(WOFF2.length).toBeGreaterThan(0);
  });

  it("LICENSES.md covers every bundled .woff2", () => {
    expect(WOFF2.filter((file) => !covered(file))).toEqual([]);
  });
});
