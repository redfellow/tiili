// @harvaaja-test-tier: fast
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const SCRIPTS = Object.keys((JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts);

const DOCS = readdirSync(join(ROOT, "docs"), { recursive: true, encoding: "utf8" }).map((file) => join("docs", file));
const MARKDOWN = ["README.md", ...DOCS.filter((file) => file.endsWith(".md"))];
const PROSE = [...MARKDOWN, ...DOCS.filter((file) => file.endsWith(".html")), "site/index.html"];

/**
 * A file's relative link targets: `src`/`href` attributes, and in Markdown `](…)` links too, without web, mail, anchor
 * or `${…}` (JS template) ones.
 */
function relativeLinks(file: string, text: string): string[] {
  const targets = [
    ...(file.endsWith(".md") ? [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]) : []),
    ...[...text.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]),
  ];
  return targets.filter((t) => !/^([a-z]+:|#|\/\/)/i.test(t) && !t.includes("${"));
}

describe("doc links and scripts", () => {
  it.each(PROSE)("every npm run in %s is a package.json script", (file) => {
    const mentioned = [...read(file).matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
    expect(mentioned.filter((script) => !SCRIPTS.includes(script))).toEqual([]);
  });

  it.each([...MARKDOWN, "site/index.html"])("every relative link in %s resolves", (file) => {
    const broken = relativeLinks(file, read(file)).filter(
      (target) => !existsSync(join(ROOT, dirname(file), decodeURIComponent(target.split("#")[0]))),
    );
    expect(broken).toEqual([]);
  });
});
