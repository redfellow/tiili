// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import {
  buildNotes,
  claudePrompt,
  parseClaudeNotes,
  parsePromotion,
  promotionNumber,
  pullNumbers,
  pullRequestBrief,
} from "./release-notes.mjs";

const promotion = (notes: string[], changes: string[]) =>
  [
    ...notes,
    "",
    "Promotes what härvääjä merged into `hv/main` since the last promotion.",
    "",
    ...changes.map((change) => `- ${change}`),
    "",
    "Any merge method works: this branch carries only what is new since the last promotion.",
  ].join("\n");

describe("release notes", () => {
  it("Promotion notes: parsePromotion splits the update notes from the pull requests it lists", () => {
    const body = promotion(
      ["tiili is updated to version 0.2.0.", "You can now open several tiili windows at once."],
      ["Several tiili windows (#98)", "Fix the repo_tracking host test race (#99)"],
    );
    expect(parsePromotion(body)).toEqual({
      notes: ["You can now open several tiili windows at once."],
      changes: ["Several tiili windows (#98)", "Fix the repo_tracking host test race (#99)"],
    });
  });

  it("Promotion notes: promotionNumber reads only promotion subjects", () => {
    expect(promotionNumber("Promote hv/main to main (#121)")).toBe("121");
    expect(promotionNumber("Fix the build (#12)")).toBeUndefined();
  });

  it("Promotion notes: buildNotes puts the update notes first and collapses every change", () => {
    const text = buildNotes({
      entries: [
        { promotion: { number: "121", body: promotion(["tiili is updated to version 0.2.0."], ["Release v0.2.0 (#120)"]) } },
        { promotion: { number: "112", body: promotion(["The splash appears at most once per day."], ["Splash once a day (#111)"]) } },
        { subject: "Hotfix the icon" },
      ],
      compareUrl: "https://github.com/o/r/compare/v0.1.1...v0.2.0",
    });
    expect(text).toBe(
      [
        "## What's new",
        "",
        "- The splash appears at most once per day.",
        "",
        "<details><summary>All changes (2)</summary>",
        "",
        "- Splash once a day (#111)",
        "- Hotfix the icon",
        "",
        "</details>",
        "",
        "**Full changelog:** https://github.com/o/r/compare/v0.1.1...v0.2.0",
        "",
      ].join("\n"),
    );
  });

  it("Promotion notes: without update notes the changes are listed openly", () => {
    const text = buildNotes({ entries: [{ promotion: { number: "9", body: promotion([], ["Fix a test (#8)"]) } }] });
    expect(text).toBe("## Changes\n\n- Fix a test (#8)\n");
  });

  it("Claude notes: buildNotes uses Claude's items as What's new and keeps every change", () => {
    const text = buildNotes({
      entries: [{ promotion: { number: "9", body: promotion(["Close button."], ["Per-pane close button (#8)"]) } }],
      compareUrl: "https://github.com/o/r/compare/v1.0.0...v1.1.0",
      whatsNew: ["**Close a pane right where it is.** Every pane has its own ×."],
    });
    expect(text).toContain("## What's new\n\n- **Close a pane right where it is.** Every pane has its own ×.\n");
    expect(text).not.toContain("- Close button.");
    expect(text).toContain("<details><summary>All changes (1)</summary>");
    expect(text).toContain("**Full changelog:** https://github.com/o/r/compare/v1.0.0...v1.1.0");
  });

  it("Claude notes: pullNumbers reads the trailing (#N) of each change once", () => {
    expect(pullNumbers(["New window (#233)", "Idea list (#231)", "New window (#233)", "No number"])).toEqual(["233", "231"]);
  });

  it("Claude notes: pullRequestBrief keeps Why and What changes, not the evidence", () => {
    const body = ["## Why", "", "Needed.", "", "## What changes", "", "- A Dock menu.", "", "## Tasks and evidence", "", "- proof"].join("\n");
    const brief = pullRequestBrief({ number: 233, title: "New window", body });
    expect(brief).toBe("### #233 New window\n\n## Why\n\nNeeded.\n\n## What changes\n\n- A Dock menu.");
  });

  it("Claude notes: a fast-lane pull request is described by its commit messages, without co-author lines", () => {
    const brief = pullRequestBrief({
      number: 220,
      title: "Attention ring",
      body: "**Fast lane: not reviewed.**\n\n## Checks\n\n- lint",
      commits: [{ messageHeadline: "Breathe a ring round the Dock icon", messageBody: "While a pane wants attention.\n\nCo-Authored-By: X <x@y>" }],
    });
    expect(brief).toBe("### #220 Attention ring\n\nBreathe a ring round the Dock icon\nWhile a pane wants attention.");
  });

  it("Claude notes: the prompt holds the rules, the hints and every brief", () => {
    const prompt = claudePrompt({ briefs: ["### #1 One", "### #2 Two"], hints: ["A hint."] });
    expect(prompt).toMatch(/biggest and best change/);
    expect(prompt).toMatch(/no in-jokes, codenames or Finnish words/);
    expect(prompt).toContain("- A hint.");
    expect(prompt).toContain("### #1 One\n\n### #2 Two");
  });

  it.each([
    ["plain bullets", "- **One.** First.\n- **Two.** Second.", ["**One.** First.", "**Two.** Second."]],
    ["intro, fence and a wrapped line", "Here are the notes:\n```\n- **One.** First\n  continues.\n```", ["**One.** First continues."]],
  ])("Claude notes: parseClaudeNotes reads %s", (_name, reply, items) => {
    expect(parseClaudeNotes(reply)).toEqual(items);
  });

  it("Claude notes: a reply without bullets is refused", () => {
    expect(() => parseClaudeNotes("Sorry, I can't.")).toThrow(/no bullet list/);
  });
});
