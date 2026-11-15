// @harvaaja-test-tier: fast
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES } from "../themes";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/** A theme's family: its name without a Light or Dark ending, so Solarized Light and Dark are one family. */
const FAMILIES = [
  ...new Set(THEMES.filter((t) => t.kind !== "system").map((t) => t.name.replace(/ (Light|Dark)$/, ""))),
];

/** Where each doc names the themes: the README's "Themes and fonts" bullet and the site's paragraph of that name. */
const DOCS: [file: string, section: RegExp][] = [
  ["README.md", /\*\*Themes and fonts\.\*\*([\s\S]*?)\n\n/],
  ["site/index.html", /<h3>Themes and fonts<\/h3>\s*<p>([\s\S]*?)<\/p>/],
];

describe("theme families in the docs", () => {
  it.each(DOCS)("%s names every theme family", (file, section) => {
    const text = section.exec(read(file))?.[1];
    expect(text, `no themes section found in ${file}`).toBeDefined();
    expect(FAMILIES.filter((family) => !new RegExp(`\\b${family}\\b`).test(text!))).toEqual([]);
  });
});
