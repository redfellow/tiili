// @harvaaja-test-tier: fast
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "../src/shortcuts";
import { END_MARKER, fillShortcuts, renderShortcuts, START_MARKER, TARGETS } from "./docs-render.mjs";

describe("generated shortcut tables", () => {
  it.each(TARGETS)("Stale tables: %s holds what npm run docs writes", (file, format) => {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const fresh = fillShortcuts(text, renderShortcuts(SHORTCUTS, format));
    expect(text === fresh, `${file}'s shortcut table is stale: run npm run docs`).toBe(true);
  });

  it("Stale tables: filling the markers replaces only what is between them, keeping the end marker's indentation", () => {
    const text = `before\n  ${START_MARKER}\n  old rows\n  ${END_MARKER}\nafter\n`;
    expect(fillShortcuts(text, "  new rows")).toBe(`before\n  ${START_MARKER}\n  new rows\n  ${END_MARKER}\nafter\n`);
  });

  it("refuses a file without the markers", () => {
    expect(() => fillShortcuts("no markers here", "rows")).toThrow(/markers/);
  });
});
