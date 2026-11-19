// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import {
  CHECK_INTERVAL_MS,
  LAST_CHECK_KEY,
  SKIPPED_KEY,
  WHATS_NEW_KEY,
  WHATS_NEW_LIMIT,
  autoCheck,
  isSkipped,
  saveWhatsNew,
  shouldAutoCheck,
  skipVersion,
  takeWhatsNew,
  whatsNew,
  whatsNewPanelItems,
  type FoundUpdate,
} from "./updates";

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("shouldAutoCheck", () => {
  it.each([
    ["never checked", undefined, true, true],
    ["Checked today already: 3 hours ago", NOW - 3 * HOUR, true, false],
    ["just under a day ago", NOW - CHECK_INTERVAL_MS + 1, true, false],
    ["a day ago", NOW - CHECK_INTERVAL_MS, true, true],
    ["Checks off: never checked", undefined, false, false],
    ["Checks off: a week ago", NOW - 7 * CHECK_INTERVAL_MS, false, false],
    ["last check in the future (clock went back)", NOW + HOUR, true, true],
    ["unreadable last check", Number.NaN, true, true],
  ])("%s", (_name, lastCheck, enabled, expected) => {
    expect(shouldAutoCheck(NOW, lastCheck, enabled)).toBe(expected);
  });
});

describe("isSkipped", () => {
  it.each([
    ["Skip a version: the skipped version", "0.3.0", "0.3.0", true],
    ["A newer version after a skip", "0.3.1", "0.3.0", false],
    ["nothing skipped", "0.3.0", undefined, false],
  ])("%s", (_name, version, skipped, expected) => {
    expect(isSkipped(version, skipped)).toBe(expected);
  });
});

function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    map,
  };
}

const found = (version: string): FoundUpdate => ({
  version,
  currentVersion: "0.2.0",
  notes: "",
  whatsNew: [],
  kind: "bundle",
  releaseUrl: "",
  install: async () => undefined,
});

describe("autoCheck", () => {
  it.each([
    ["Checked today already: no request", true, { [LAST_CHECK_KEY]: String(NOW - 3 * HOUR) }, "0.3.0", false, false],
    ["Checks off: no request", false, {}, "0.3.0", false, false],
    ["Skip a version: no dialog the next day", true,
      { [LAST_CHECK_KEY]: String(NOW - CHECK_INTERVAL_MS), [SKIPPED_KEY]: "0.3.0" }, "0.3.0", true, false],
    ["A newer version after a skip: the dialog is shown", true, { [SKIPPED_KEY]: "0.3.0" }, "0.3.1", true, true],
    ["up to date: no dialog", true, {}, undefined, true, false],
    ["Focused a day later: one request, the dialog is shown", true,
      { [LAST_CHECK_KEY]: String(NOW - 25 * HOUR) }, "0.3.0", true, true],
    ["Focused soon after a check: no request", true, { [LAST_CHECK_KEY]: String(NOW - 2 * HOUR) }, "0.3.0", false, false],
  ])("%s", async (_name, enabled, entries, latest, requested, shown) => {
    const storage = memoryStorage(entries);
    const find = vi.fn(async () => (latest ? found(latest) : undefined));
    const show = vi.fn();
    await autoCheck({ enabled, show, storage, now: NOW, find });
    expect(find).toHaveBeenCalledTimes(requested ? 1 : 0);
    expect(show).toHaveBeenCalledTimes(shown ? 1 : 0);
    if (requested) expect(storage.map.get(LAST_CHECK_KEY)).toBe(String(NOW));
  });

  it("busy: no request, and no check is recorded so the next focus can check", async () => {
    const entries = { [LAST_CHECK_KEY]: String(NOW - 25 * HOUR) };
    const storage = memoryStorage(entries);
    const find = vi.fn(async () => found("0.3.0"));
    const show = vi.fn();
    await autoCheck({ enabled: true, show, storage, now: NOW, find, busy: () => true });
    expect(find).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
    expect(storage.map.get(LAST_CHECK_KEY)).toBe(entries[LAST_CHECK_KEY]);
  });

  it("a failed check shows nothing and waits a day", async () => {
    const storage = memoryStorage();
    const show = vi.fn();
    await autoCheck({ enabled: true, show, storage, now: NOW, find: () => Promise.reject(new Error("offline")) });
    expect(show).not.toHaveBeenCalled();
    expect(shouldAutoCheck(NOW + HOUR, Number(storage.map.get(LAST_CHECK_KEY)), true)).toBe(false);
  });

  it("Skip a version: skipVersion keeps the version for later checks", () => {
    const storage = memoryStorage();
    skipVersion("0.3.0", storage);
    expect(storage.map.get(SKIPPED_KEY)).toBe("0.3.0");
  });
});

/** The body of the real v0.3.0 release. */
const V030_BODY = `## What's new

- The v0.3.0 release is fixed for Windows, where line endings were previously stamped incorrectly.
- The macOS update bundle is fixed, so the app's updater on macOS works with this release.
- A retry step was added to the release process.
- The settings window has been redesigned, with pickers shown as cards.
- Settings now include a live preview.
- The footer stays pinned at the bottom of the settings window.
- Every settings tab fits within a 720×640 window.
- You can now get app updates from within the app.
- The tiili app window is now titled "tiili >_" in the alt-tab window switcher.

<details><summary>All changes (10)</summary>

- Fix the v0.3.0 release: CRLF stamp on Windows, macOS updater bundle, retry (#134)
- In-app updates (#127)

</details>

**Full changelog:** https://github.com/redfellow/tiili/compare/v0.2.0...v0.3.0`;

const NO_SECTION_BODY = `## Fixes

<b>Faster</b> start-up.`;

describe("whatsNew", () => {
  it.each([
    ["the v0.3.0 body", V030_BODY, 9, "The v0.3.0 release is fixed for Windows, where line endings were previously stamped incorrectly.", "The tiili app window is now titled \"tiili >_\" in the alt-tab window switcher."],
    ["a body without a What's new heading", NO_SECTION_BODY, 0, undefined, undefined],
    ["empty body", "", 0, undefined, undefined],
    ["section ended by the changelog line, * bullets", "### Whats New\r\n* one\r\n**Full changelog:** x\r\n- not this", 1, "one", "one"],
  ])("%s", (_name, body, count, first, last) => {
    const items = whatsNew(body);
    expect(items).toHaveLength(count);
    expect(items[0]).toBe(first);
    expect(items.at(-1)).toBe(last);
  });
});

describe("whatsNewPanelItems", () => {
  it("Item with bold: the bold lead is a strong run and the asterisks are gone", () => {
    expect(whatsNewPanelItems(["**Close a pane right where it is.** Every pane has its own ×"])).toEqual([
      [{ kind: "strong", text: "Close a pane right where it is." }, { kind: "text", text: " Every pane has its own ×" }],
    ]);
  });

  it("lists at most WHATS_NEW_LIMIT items", () => {
    const items = Array.from({ length: WHATS_NEW_LIMIT + 3 }, (_, i) => `item ${i}`);
    expect(whatsNewPanelItems(items)).toHaveLength(WHATS_NEW_LIMIT);
  });
});

describe("saveWhatsNew and takeWhatsNew", () => {
  it("Shown once after updating: take returns the items once on the matching version", () => {
    const storage = memoryStorage();
    saveWhatsNew("0.4.0", ["one", "two"], storage);
    expect(takeWhatsNew("0.4.0", storage)).toEqual(["one", "two"]);
    expect(takeWhatsNew("0.4.0", storage)).toBeUndefined();
  });

  it.each([
    ["Version does not match: cleared, nothing returned", JSON.stringify({ version: "0.4.0", items: ["one"] })],
    ["corrupt JSON: cleared, nothing returned", "{not json"],
    ["wrong shape: cleared, nothing returned", JSON.stringify(["0.3.0"])],
  ])("%s", (_name, saved) => {
    const storage = memoryStorage({ [WHATS_NEW_KEY]: saved });
    expect(takeWhatsNew("0.3.0", storage)).toBeUndefined();
    expect(storage.map.has(WHATS_NEW_KEY)).toBe(false);
  });

  it("Updated outside the app: no saved entry, nothing returned", () => {
    expect(takeWhatsNew("0.4.0", memoryStorage())).toBeUndefined();
  });
});
