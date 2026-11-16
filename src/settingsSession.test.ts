// @harvaaja-test-tier: fast
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { createSettingsSession, dirty, type SettingsSession, turnsOffRestore, whileTyping } from "./settingsSession";

const opening: Settings = { ...DEFAULT_SETTINGS, theme: "nord" };
const dracula: Settings = { ...DEFAULT_SETTINGS, theme: "dracula" };
const big: Settings = { ...opening, font: { ...opening.font, size: 16 } };
const faded: Settings = { ...opening, inactive: { opacity: 0.5, desaturate: true } };
const stacked: Settings = { ...opening, tiling: { layout: "rows" } };
const flatText: Settings = { ...opening, responsive: { enabled: false, strength: 0.5 } };
const noHover: Settings = { ...opening, behaviour: { ...opening.behaviour, hoverHighlight: false } };

type Step = (s: SettingsSession) => unknown;
const cases: [string, Step[], unknown, Settings, Settings][] = [
  // name, steps, result of the last step, saved after, draft after
  ["edit with the same settings marks no change", [(s) => s.edit({ ...opening })], false, opening, opening],
  ["edit with different settings marks a change", [(s) => s.edit(dracula)], true, opening, dracula],
  ["Change inactive looks: a new opacity and desaturate marks a change", [(s) => s.edit(faded)], true, opening, faded],
  ["choosing another tiling mode marks a change", [(s) => s.edit(stacked)], true, opening, stacked],
  ["turning off responsive text marks a change", [(s) => s.edit(flatText)], true, opening, flatText],
  ["turning off mouseover highlight marks a change", [(s) => s.edit(noHover)], true, opening, noHover],
  ["Change inactive looks: Save keeps the faded preview",
    [(s) => s.edit(faded), (s) => s.commit(s.draft)], undefined, faded, faded],
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

describe("dirty", () => {
  it.each<[string, Step[], boolean]>([
    ["a fresh session has nothing unsaved", [], false],
    ["an edit is unsaved", [(s) => s.edit(dracula)], true],
    ["an edit undone by hand is no change", [(s) => s.edit(dracula), (s) => s.edit({ ...opening })], false],
    ["a committed edit is saved", [(s) => s.edit(dracula), (s) => s.commit(s.draft)], false],
    ["a cancelled edit is gone", [(s) => s.edit(dracula), (s) => s.cancel()], false],
  ])("%s", (_name, steps, unsaved) => {
    const session = createSettingsSession(opening);
    for (const step of steps) step(session);
    expect(dirty(session)).toBe(unsaved);
  });
});

const withScrollback = (settings: Settings, scrollback: number): Settings =>
  ({ ...settings, behaviour: { ...settings.behaviour, scrollback } });

const typingCases: [string, Settings, Settings, Settings][] = [
  // name, read from the form, draft, applied
  ["Change scrollback: a partial 500 typed on the way to 50 000 keeps the panes' 10 000",
    withScrollback(opening, 1000), opening, opening],
  ["Change scrollback: other fields still apply while typing", withScrollback(dracula, 1000), opening, dracula],
];

describe("whileTyping", () => {
  it.each(typingCases)("%s", (_name, read, draft, applied) => {
    expect(whileTyping(read, draft)).toEqual(applied);
  });
});

const restoring = (settings: Settings, restoreScrollback: boolean): Settings =>
  ({ ...settings, behaviour: { ...settings.behaviour, restoreScrollback } });

describe("turnsOffRestore", () => {
  it.each([
    ["Turned off: saving on to off deletes what was kept", true, false, true],
    ["saving off to on keeps nothing to delete", false, true, false],
    ["saving with it left on deletes nothing", true, true, false],
    ["saving with it left off deletes nothing", false, false, false],
  ])("%s", (_name, before, after, cleared) => {
    expect(turnsOffRestore(restoring(dracula, before), restoring(big, after))).toBe(cleared);
  });
});
