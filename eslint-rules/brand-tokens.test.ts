// @harvaaja-test-tier: fast
import css from "@eslint/css";
import { RuleTester } from "eslint";
import { describe, expect, it } from "vitest";
import brand, { styleBlocks } from "./brand-tokens.js";

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const rule = brand.rules.tokens;
const options = [{ allowThemeIds: ["^nord$"], allowFiles: ["src/heynotePane.ts"] }];

const cssTester = new RuleTester({ plugins: { css }, language: "css/css" });
const jsTester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: "module" } });

const exact = (replacement: string, literal: string) => ({ messageId: "exact", data: { replacement, literal } });

describe("brand/tokens", () => {
  cssTester.run("css", rule, {
    valid: [
      // Allowed literal: a tokens-allow line, a hairline border, @font-face, sizes outside a token family.
      "a { color: var(--accent); background: color-mix(in srgb, var(--fg) 10%, transparent); }",
      { name: "Allowed literal: a hairline 1px border is not reported", code: "a { border: 1px solid var(--line); border-radius: 1px; }" },
      { name: "Allowed literal: a tokens-allow comment on the line allows it", code: "a { color: #123456; /* tokens-allow: traffic light */ }" },
      "a {\n  /* tokens-allow: traffic light */\n  color: #123456;\n}",
      '@font-face { font-family: "Geist"; color: #123456; }',
      "a { width: 4px; padding: 5px; font-size: 12px; }",
      "a { font: 500 var(--text-label)/16px var(--font-sans); }",
      'a { font-family: "red", sans-serif; background: url(#red); }',
    ],
    invalid: [
      // Exact colour: fixed to the semantic token before the tint and palette ones.
      { name: "Exact colour: #A4472B in a stylesheet is fixed to var(--accent)", code: "a { color: #A4472B; }", output: "a { color: var(--accent); }", errors: [exact("var(--accent)", "#A4472B")] },
      { code: "a { color: #a4472b; }", output: "a { color: var(--accent); }", errors: [exact("var(--accent)", "#a4472b")] },
      { code: "a { color: white; }", output: "a { color: var(--on-accent); }", errors: [exact("var(--on-accent)", "white")] },
      { code: "a { color: rgb(164 71 43); }", output: "a { color: var(--accent); }", errors: [exact("var(--accent)", "rgb(164 71 43)")] },
      {
        code: "a { background: rgba(164, 71, 43, 0.5); }",
        output: "a { background: color-mix(in srgb, var(--accent) 50%, transparent); }",
        errors: [exact("color-mix(in srgb, var(--accent) 50%, transparent)", "rgba(164, 71, 43, 0.5)")],
      },
      { code: "a { --chip: #F6F1E9; }", output: "a { --chip: var(--bg); }", errors: [exact("var(--bg)", "#F6F1E9")] },
      // Near colour: no fix, a suggestion naming the nearest token.
      {
        name: "Near colour: a colour with no token gets a suggestion naming the nearest",
        code: "a { color: #ffe6d2; }",
        output: null,
        errors: [{
          messageId: "near",
          suggestions: [{ messageId: "useNearest", data: { token: "--sunken", literal: "#ffe6d2" }, output: "a { color: var(--sunken); }" }],
        }],
      },
      // Sizes equal to a token of their property's family.
      { code: "a { border-radius: 3px; }", output: "a { border-radius: var(--radius-brick); }", errors: [exact("var(--radius-brick)", "3px")] },
      { code: "a { padding: 4px 8px; }", output: "a { padding: var(--space-1) var(--space-2); }", errors: [exact("var(--space-1)", "4px"), exact("var(--space-2)", "8px")] },
      { code: "a { margin-top: -4px; }", output: "a { margin-top: calc(-1 * var(--space-1)); }", errors: [exact("calc(-1 * var(--space-1))", "-4px")] },
      { code: "a { font-size: 11.5px; }", output: "a { font-size: var(--text-label); }", errors: [exact("var(--text-label)", "11.5px")] },
      {
        code: "a { font: 500 11.5px/16px var(--font-sans); }",
        output: "a { font: 500 var(--text-label)/16px var(--font-sans); }",
        errors: [exact("var(--text-label)", "11.5px")],
      },
    ],
  });

  jsTester.run("js", rule, {
    valid: [
      { code: 'const ids = ["red-team", "brightRed", "Fix the issue"];', options },
      { code: 'el.style.color = "var(--fg)";', options },
      // Allowed literal: a declared third-party theme, an allowed file, a tokens-allow line.
      { code: 'const t = { id: "nord", tokens: f({ bg: "#2E3440" }, "#3B4252 #BF616A") };', options },
      { code: 'const ground = "#252B37";', filename: "/repo/src/heynotePane.ts", options },
      { code: '// tokens-allow: published palette\nconst c = "#123456";', options },
    ],
    invalid: [
      { code: 'const c = "#A4472B";', output: 'const c = "var(--accent)";', options, errors: [exact("var(--accent)", "#A4472B")] },
      {
        code: "const s = `0 ${n}px 4px #A4472B`;",
        output: "const s = `0 ${n}px 4px var(--accent)`;",
        options,
        errors: [exact("var(--accent)", "#A4472B")],
      },
      { code: 'const t = { id: "other", bg: "#A4472B" };', output: 'const t = { id: "other", bg: "var(--accent)" };', options, errors: [exact("var(--accent)", "#A4472B")] },
      {
        code: 'const h = "#ffe6d2";',
        output: null,
        options,
        errors: [{ messageId: "near", suggestions: [{ messageId: "useNearest", data: { token: "--sunken", literal: "#ffe6d2" }, output: 'const h = "var(--sunken)";' }] }],
      },
    ],
  });

  it("The <style> processor keeps the page's offsets, so reports land on the page's lines", () => {
    const html = '<p style="color:red">x</p>\n<style>\n  a { color: #A4472B; }\n</style>\n<style>b{}</style>';
    const blocks = styleBlocks(html)!;
    expect(blocks).toHaveLength(html.length);
    const at = html.indexOf("#A4472B");
    expect(blocks.slice(at, at + 7)).toBe("#A4472B");
    expect(blocks).not.toContain("color:red");
    expect(blocks.split("\n")).toHaveLength(html.split("\n").length);
    expect(styleBlocks("<p>no style</p>")).toBeNull();
  });
});
