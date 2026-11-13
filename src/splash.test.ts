// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { isLight, mix, PACE, SKIP_PACE, TIMELINE, toHex } from "./splash";

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
