// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { createSettingsSession, type SettingsSession } from "./settingsSession";

const opening: Settings = { ...DEFAULT_SETTINGS, theme: "nord" };
const dracula: Settings = { ...DEFAULT_SETTINGS, theme: "dracula" };
const big: Settings = { ...opening, font: { ...opening.font, size: 16 } };

type Step = (s: SettingsSession) => unknown;
const cases: [string, Step[], unknown, Settings, Settings][] = [
  // name, steps, result of the last step, saved after, draft after
  ["edit with the same settings marks no change", [(s) => s.edit({ ...opening })], false, opening, opening],
  ["edit with different settings marks a change", [(s) => s.edit(dracula)], true, opening, dracula],
  ["Cancel reverts the preview: cancel returns the opening settings",
    [(s) => s.edit(dracula), (s) => s.edit(big), (s) => s.cancel()], opening, opening, opening],
  ["Save keeps the preview: commit makes the draft the new baseline",
    [(s) => s.edit(big), (s) => s.commit(s.draft)], undefined, big, big],
  ["cancel after commit returns the committed settings",
    [(s) => s.edit(big), (s) => s.commit(s.draft), (s) => s.edit(dracula), (s) => s.cancel()], big, big, big],
  ["commit records what was written, not an edit made while saving", [(s) => s.edit(big), (s) => {
    const written = s.draft;
    s.edit(dracula);
    s.commit(written);
  }], undefined, big, dracula],
];

describe("createSettingsSession", () => {
  it.each(cases)("%s", (_name, steps, result, saved, draft) => {
    const session = createSettingsSession(opening);
    let last: unknown;
    for (const step of steps) last = step(session);
    expect(last).toEqual(result);
    expect(session.saved).toEqual(saved);
    expect(session.draft).toEqual(draft);
  });
});
