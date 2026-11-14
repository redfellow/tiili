// @harvaaja-test-tier: fast
import { describe, expect, it, vi } from "vitest";
import {
  CHECK_INTERVAL_MS,
  LAST_CHECK_KEY,
  SKIPPED_KEY,
  isSkipped,
  shouldAutoCheck,
  skipVersion,
  startupCheck,
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
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), map };
}

const found = (version: string): FoundUpdate => ({
  version,
  currentVersion: "0.2.0",
  notes: "",
  kind: "bundle",
  releaseUrl: "",
  install: async () => undefined,
});

describe("startupCheck", () => {
  it.each([
    ["Checked today already: no request", true, { [LAST_CHECK_KEY]: String(NOW - 3 * HOUR) }, "0.3.0", false, false],
    ["Checks off: no request", false, {}, "0.3.0", false, false],
    ["Skip a version: no dialog the next day", true,
      { [LAST_CHECK_KEY]: String(NOW - CHECK_INTERVAL_MS), [SKIPPED_KEY]: "0.3.0" }, "0.3.0", true, false],
    ["A newer version after a skip: the dialog is shown", true, { [SKIPPED_KEY]: "0.3.0" }, "0.3.1", true, true],
    ["up to date: no dialog", true, {}, undefined, true, false],
  ])("%s", async (_name, enabled, entries, latest, requested, shown) => {
    const storage = memoryStorage(entries);
    const find = vi.fn(async () => (latest ? found(latest) : undefined));
    const show = vi.fn();
    await startupCheck({ enabled, show, storage, now: NOW, find });
    expect(find).toHaveBeenCalledTimes(requested ? 1 : 0);
    expect(show).toHaveBeenCalledTimes(shown ? 1 : 0);
    if (requested) expect(storage.map.get(LAST_CHECK_KEY)).toBe(String(NOW));
  });

  it("a failed check shows nothing and waits a day", async () => {
    const storage = memoryStorage();
    const show = vi.fn();
    await startupCheck({ enabled: true, show, storage, now: NOW, find: () => Promise.reject(new Error("offline")) });
    expect(show).not.toHaveBeenCalled();
    expect(shouldAutoCheck(NOW + HOUR, Number(storage.map.get(LAST_CHECK_KEY)), true)).toBe(false);
  });

  it("Skip a version: skipVersion keeps the version for later checks", () => {
    const storage = memoryStorage();
    skipVersion("0.3.0", storage);
    expect(storage.map.get(SKIPPED_KEY)).toBe("0.3.0");
  });
});
