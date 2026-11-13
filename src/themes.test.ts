// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { THEME_IDS } from "./settings";
import { contrast, THEME_TOKENS, THEMES } from "./themes";

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

  it.each(
    fixedThemes.flatMap((theme) =>
      (["--bg", "--surface"] as const).flatMap((ground) => [
        [theme.name, "--fg", ground, 4.5, theme] as const,
        [theme.name, "--muted", ground, 4.5, theme] as const,
        [theme.name, "--focus", ground, 3, theme] as const,
      ]),
    ),
  )("Readable theme colours: %s %s on %s reaches %s:1", (_name, token, ground, target, theme) => {
    expect(contrast(theme.tokens[token]!, theme.tokens[ground]!)).toBeGreaterThanOrEqual(target);
  });
});
