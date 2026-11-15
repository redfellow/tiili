// @harvaaja-test-tier: fast
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TINT_COUNT } from "../tints";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

interface Tint {
  tint: string;
  on: string;
}

const HEX = "#[0-9A-Fa-f]{6}";

/** The brand README's tint table: token → tint, label colour and stated contrast. */
const table = new Map(
  [
    ...read("docs/brand/README.md").matchAll(
      new RegExp(`^\\| \`(--tint-\\d+)\` \\| [^|]+\\| \`(${HEX})\` \\| \`(${HEX})\` \\| ([\\d.]+):1 \\|$`, "gm"),
    ),
  ].map(([, token, tint, on, ratio]) => [
    token,
    { tint: tint.toUpperCase(), on: on.toUpperCase(), contrast: Number(ratio) },
  ]),
);

/** tiili.css's tints: token → tint and label colour. */
const css = new Map<string, Tint>(
  [...read("docs/brand/tiili.css").matchAll(new RegExp(`(--tint-\\d+): (${HEX}); \\1-on: (${HEX});`, "g"))].map(
    ([, token, tint, on]) => [token, { tint: tint.toUpperCase(), on: on.toUpperCase() }],
  ),
);

/** WCAG 2 relative luminance of `#RRGGBB`. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("brand tint table", () => {
  it("lists every tint tiili.css defines, and as many as the app assigns", () => {
    expect([...table.keys()]).toEqual([...css.keys()]);
    expect(css.size).toBe(TINT_COUNT);
  });

  it.each([...table])("%s matches tiili.css and states its contrast", (token, row) => {
    expect({ tint: row.tint, on: row.on }).toEqual(css.get(token));
    expect(Math.abs(contrast(row.tint, row.on) - row.contrast)).toBeLessThanOrEqual(0.05);
  });
});
