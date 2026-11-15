// @harvaaja-test-tier: fast
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES } from "./themes";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("docs/brand/tiili.css");

/** Each `selector { --name: value; }` block of a stylesheet, by selector; nested blocks are read by their own selector. */
function blocks(source: string): Map<string, Record<string, string>> {
  const found = new Map<string, Record<string, string>>();
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selector, body] of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const props: Record<string, string> = {};
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) props[name] = value.trim();
    found.set(selector.trim(), props);
  }
  return found;
}

const SELECTORS: Record<string, string> = {
  "tiili-light": ":root",
  "tiili-dark": ':root[data-theme="dark"]',
  savi: ':root[data-variant="savi"]',
  muratti: ':root[data-variant="muratti"]',
  koski: ':root[data-variant="koski"]',
  laasti: ':root[data-variant="laasti"]',
};

const upper = (map: Record<string, string>) =>
  Object.fromEntries(Object.entries(map).map(([name, value]) => [name, value.toUpperCase()]));

describe("brand tokens", () => {
  const parsed = blocks(css);

  it("Variant blocks present: tiili.css holds the four variants and the shadow and text tokens", () => {
    for (const id of ["savi", "muratti", "koski", "laasti"]) expect(parsed.has(SELECTORS[id]), id).toBe(true);
    const root = parsed.get(":root") ?? {};
    expect(Object.keys(root).filter((name) => /^--shadow-\d$/.test(name)).length).toBeGreaterThan(0);
    expect(root["--text-label"]).toBe("11.5px");
  });

  it.each(Object.entries(SELECTORS))(
    "Dark theme in step: the %s theme holds the same values as its tiili.css block",
    (id, selector) => {
      const theme = THEMES.find((t) => t.id === id);
      expect(theme, id).toBeDefined();
      const block = parsed.get(selector) ?? {};
      const tokens = theme!.tokens as Record<string, string>;
      const shared = Object.fromEntries(Object.keys(tokens).map((name) => [name, block[name] ?? "(missing)"]));
      expect(upper(shared)).toEqual(upper(tokens));
      // A variant block lists exactly what the theme sets; the brand sets also carry palette and shape tokens.
      if (selector.includes("data-variant")) expect(Object.keys(block).sort()).toEqual(Object.keys(tokens).sort());
    },
  );

  it("Theme copies match the tokens: site/brand holds the same tiili.css", () => {
    expect(read("site/brand/tiili.css")).toBe(css);
  });
});
