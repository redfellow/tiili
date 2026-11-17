// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { parseMarkdown, type Block } from "./markdown";

/** The body of the real v0.3.0 release, shortened. */
const V030_BODY = `## What's new

- The v0.3.0 release is fixed for Windows.
- You can now get app updates from within the app.

<details><summary>All changes (10)</summary>

- In-app updates (#127)

</details>

**Full changelog:** https://github.com/redfellow/tiili/compare/v0.2.0...v0.3.0`;

/** A body without a What's new heading, as in the card's screenshot. */
const HIGHLIGHTS_BODY = `## Highlights\r
\r
- **Tabs in a window.** Open several tabs\r
  in one window.\r
* *Faster* start-up with \`tiili --fast\`.\r
\r
See the [release page](https://github.com/redfellow/tiili/releases).`;

const text = (t: string) => ({ kind: "text", text: t }) as const;

describe("parseMarkdown", () => {
  it.each<[string, string, Block[]]>([
    ["Body with What's new: heading and items, without the details block or changelog line", V030_BODY, [
      { kind: "heading", inlines: [text("What's new")] },
      { kind: "list", ordered: false, items: [
        [text("The v0.3.0 release is fixed for Windows.")],
        [text("You can now get app updates from within the app.")],
      ] },
    ]],
    ["Body without What's new: heading, list with bold, italic and code, paragraph with an https link", HIGHLIGHTS_BODY, [
      { kind: "heading", inlines: [text("Highlights")] },
      { kind: "list", ordered: false, items: [
        [{ kind: "strong", text: "Tabs in a window." }, text(" Open several tabs in one window.")],
        [{ kind: "em", text: "Faster" }, text(" start-up with "), { kind: "code", text: "tiili --fast" }, text(".")],
      ] },
      { kind: "paragraph", inlines: [
        text("See the "),
        { kind: "link", text: "release page", href: "https://github.com/redfellow/tiili/releases" },
        text("."),
      ] },
    ]],
    ["ordered list after a paragraph, joined paragraph lines", "Two\nlines\n1. one\n2) two", [
      { kind: "paragraph", inlines: [text("Two lines")] },
      { kind: "list", ordered: true, items: [[text("one")], [text("two")]] },
    ]],
    ["Unsafe link: a javascript link is its text", "[x](javascript:alert(1))", [
      { kind: "paragraph", inlines: [text("x")] },
    ]],
    ["Unsafe link: an http link is its text", "go [here](http://example.com) now", [
      { kind: "paragraph", inlines: [text("go here now")] },
    ]],
    ["HTML tags stripped, including a tag left behind by one pass", "<b>Faster</b> <scr<b>ipt>alert(1)</script> a < b", [
      { kind: "paragraph", inlines: [text("Faster iptalert(1) a  b")] },
    ]],
    ["lone asterisks are text", "2 * 3 * 4", [{ kind: "paragraph", inlines: [text("2 * 3 * 4")] }]],
    ["empty body", "", []],
  ])("%s", (_name, body, expected) => {
    expect(parseMarkdown(body)).toEqual(expected);
  });
});
