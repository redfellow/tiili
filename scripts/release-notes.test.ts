// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { buildNotes, parsePromotion, promotionNumber } from "./release-notes.mjs";

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
});
