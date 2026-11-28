// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { isLight, localDay, mix, PACE, type Palette, SKIP_PACE, splashDue, splashStamp, TIMELINE, toHex, wallLayout } from "./splash";

describe("splash colours", () => {
  it.each([
    ["#0F1516", "#0f1516"],
    ["  #abc ", "#aabbcc"],
    ["rgb(24, 32, 35)", "#182023"],
    ["rgba(255 255 255 / 0.5)", "#ffffff"],
    ["var(--nope)", "#123456"],
    ["", "#123456"],
  ])("reads %j as %s", (value, hex) => {
    expect(toHex(value, "#123456")).toBe(hex);
  });

  it("mixes halfway between two colours", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it.each([
    ["#F6F1E9", true],
    ["#E8DECD", true],
    ["#0F1516", false],
    ["#002B36", false],
  ])("treats %s as light: %s", (bg, light) => {
    expect(isLight(bg)).toBe(light);
  });
});

describe("splash timeline", () => {
  it("lays every letter before the dots, and the dots before the wall", () => {
    expect(TIMELINE.lock(4)).toBeLessThan(TIMELINE.dot(0));
    expect(TIMELINE.dot(2)).toBeLessThan(TIMELINE.wall);
  });

  it("types >_ and shows the hint before the dive", () => {
    expect(TIMELINE.underscore).toBeLessThan(TIMELINE.dive);
    expect(TIMELINE.hint).toBeLessThan(TIMELINE.dive);
  });

  it("plays in about seven seconds, and a skipped dive is quick", () => {
    const real = TIMELINE.end / PACE;
    expect(real).toBeGreaterThan(6);
    expect(real).toBeLessThan(8);
    expect((TIMELINE.diveDur + TIMELINE.fade) / SKIP_PACE).toBeLessThan(0.6);
  });
});

describe("splash once a day, and after an update", () => {
  const noon = new Date(2026, 10, 14, 12, 0, 0);
  it.each([
    ["nothing is stored", null, noon, true],
    ["an earlier day is stored", "2026-11-13 1.3.0", noon, true],
    ["today is stored", "2026-11-14 1.3.0", noon, false],
    ["a later day is stored", "2026-11-15 1.3.0", noon, true],
    ["today in an earlier version is stored", "2026-11-14 1.2.0", noon, true],
    ["today without a version is stored, as before versions were", "2026-11-14", noon, true],
    ["garbage is stored", "yesterday", noon, true],
    ["an empty string is stored", "", noon, true],
    ["today is stored just after local midnight", "2026-11-14 1.3.0", new Date(2026, 10, 14, 0, 0, 1), false],
    ["yesterday is stored just after local midnight", "2026-11-13 1.3.0", new Date(2026, 10, 14, 0, 0, 1), true],
    ["today is stored just before local midnight", "2026-11-14 1.3.0", new Date(2026, 10, 14, 23, 59, 59), false],
  ])("is due when %s: %s", (_name, stored, now, due) => {
    expect(splashDue(stored, now, "1.3.0")).toBe(due);
  });

  it("stamps the local day and the version", () => {
    expect(splashStamp(noon, "1.3.0")).toBe("2026-11-14 1.3.0");
  });

  it("writes the local day with zero padding", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("splash wall", () => {
  const palette: Palette = {
    bg: "#121414", fg: "#cececa", muted: "#8f938f", termBg: "#1c1f21", accent: "#c9764f", light: false,
    brick: { tiili: "#a4472b", klinkkeri: "#6b2a1e", savi: "#c9764f", laasti: "#e8decd", graniitti: "#8d877d", prompt: "#111617" },
  };

  it.each([[0, 0], [1578, 0]])("lays nothing in a %ix%i window, as a hidden one measures", (w, h) => {
    expect(wallLayout(w, h, palette)).toBeNull();
  });

  it.each([[1578, 763], [900, 600], [320, 200]])("lays the focus brick in a %ix%i window", (w, h) => {
    const wall = wallLayout(w, h, palette);
    expect(wall?.focus.focus).toBe(true);
    expect(wall?.bricks).toContain(wall?.focus);
  });
});
