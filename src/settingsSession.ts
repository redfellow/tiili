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
  /** Makes `written` the saved settings once it is in the settings file; the draft is left as it is. */
  commit(written: Settings): void;
}

/** Whether two settings are equal by value. */
export const same = (a: Settings, b: Settings) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Settings read from the form while the user is typing: the scrollback stays the draft's until its field is
 * committed (left or Enter), since the partial numbers on the way to 50 000 clamp to 1 000 and would cut every open
 * pane's history.
 */
/** Whether saving `written` over `saved` turns Restore scrollback and commands off, so what was kept is deleted. */
export const turnsOffRestore = (saved: Settings, written: Settings) =>
  saved.behaviour.restoreScrollback && !written.behaviour.restoreScrollback;

export function whileTyping(read: Settings, draft: Settings): Settings {
  return { ...read, behaviour: { ...read.behaviour, scrollback: draft.behaviour.scrollback } };
}

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
    commit(written) {
      baseline = written;
    },
  };
}
