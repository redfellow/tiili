// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { THEME_IDS } from "./settings";
import { contrast, THEME_TOKENS, THEMES, heynoteStartKind, themeKind } from "./themes";

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

  it.each([
    ...THEMES.filter((theme) => theme.kind !== "system").flatMap((theme) =>
      [false, true].map((prefersDark) => [theme.id, prefersDark, theme.kind] as const),
    ),
    ["system", false, "light"] as const,
    ["system", true, "dark"] as const,
  ])("Heynote follows tiili's light or dark: %s with the OS dark %s is %s", (id, prefersDark, kind) => {
    expect(themeKind(id, prefersDark)).toBe(kind);
  });

  it.each([
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
    ["light", "light", "light"],
    ["dark", "dark", "dark"],
    ["system", "light", "light"],
    ["system", "dark", "dark"],
    [undefined, "light", "light"],
    [undefined, "dark", "dark"],
    [null, "dark", "dark"],
  ] as const)("Heynote opens without a flash: chosen in Heynote %s under tiili %s starts %s", (saved, tiili, kind) => {
    expect(heynoteStartKind(saved, tiili)).toBe(kind);
  });
});
