import type { Settings } from "./settings";

/** The settings dialogue's draft: edits preview the draft, Save commits it, Cancel returns to the saved settings. */
export interface SettingsSession {
  /** The settings last saved (or loaded), which Cancel returns to. */
  readonly saved: Settings;
  /** The settings being previewed. */
  readonly draft: Settings;
  /** Makes `next` the draft; returns whether it differs from the previous draft and so must be applied. */
  edit(next: Settings): boolean;
  /** Drops the draft and returns the saved settings, to be applied again. */
  cancel(): Settings;
  /** Makes the draft the saved settings, after it has been written to the settings file. */
  commit(): void;
}

const same = (a: Settings, b: Settings) => JSON.stringify(a) === JSON.stringify(b);

export function createSettingsSession(saved: Settings): SettingsSession {
  let baseline = saved;
  let draft = saved;
  return {
    get saved() { return baseline; },
    get draft() { return draft; },
    edit(next) {
      if (same(next, draft)) return false;
      draft = next;
      return true;
    },
    cancel() {
      draft = baseline;
      return baseline;
    },
    commit() {
      baseline = draft;
    },
  };
}
