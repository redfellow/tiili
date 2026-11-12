// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { THEME_IDS } from "./settings";
import { THEME_TOKENS, THEMES } from "./themes";

const fixedThemes = THEMES.filter((theme) => theme.kind !== "system");

describe("themes", () => {
  it("Theme choice: every selectable theme id has a theme", () => {
    expect(THEMES.map((theme) => theme.id)).toEqual([...THEME_IDS]);
  });

  it.each(fixedThemes.map((theme) => [theme.name, theme] as const))(
    "Theme choice: %s defines the app colours and all 16 ANSI colours as hex",
    (_name, theme) => {
      for (const token of THEME_TOKENS) {
        expect(theme.tokens[token], token).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    },
  );
});
