import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";

/**
 * Updates from tiili's latest GitHub release: the once-a-day startup check, the skipped version and installing.
 * The check is one anonymous request for the release's `latest.json` (the endpoint is in tauri.conf.json).
 */

/** The least time between two automatic checks. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** localStorage key of the last automatic check's time, in milliseconds since the epoch. */
export const LAST_CHECK_KEY = "tiili.updates.lastCheck";
/** localStorage key of the version the user chose to skip. */
export const SKIPPED_KEY = "tiili.updates.skipped";

/** How tiili was installed: a Linux `.deb`, which can't update itself, or a bundle that can. */
export type InstallKind = "deb" | "bundle";

/** A newer version than the running one. */
export interface FoundUpdate {
  version: string;
  currentVersion: string;
  /** The release notes, as plain text; empty when the release has none. */
  notes: string;
  kind: InstallKind;
  /** The release's page on GitHub. */
  releaseUrl: string;
  /**
   * Downloads and installs the update, then restarts tiili; `onProgress` gets the share downloaded, 0–1, or
   * `undefined` while the size is unknown.
   */
  install(onProgress: (fraction: number | undefined) => void): Promise<void>;
}

/** Whether an automatic check is due at `now`: checks are on and the last one (if any) is a day old or more. */
export function shouldAutoCheck(now: number, lastCheck: number | undefined, enabled: boolean): boolean {
  if (!enabled) return false;
  if (lastCheck === undefined || !Number.isFinite(lastCheck)) return true;
  // A last check in the future means the clock went back: check rather than wait for the clock to catch up.
  return lastCheck > now || now - lastCheck >= CHECK_INTERVAL_MS;
}

/** Whether `version` is the one the user skipped. */
export function isSkipped(version: string, skipped: string | undefined): boolean {
  return skipped !== undefined && skipped === version;
}

/** The GitHub page of the release of `version`. */
export function releasePageUrl(version: string): string {
  return `https://github.com/redfellow/tiili/releases/tag/v${version}`;
}

/** The storage the check keeps its state in; localStorage in the app. */
export type UpdateStorage = Pick<Storage, "getItem" | "setItem">;

function read(storage: UpdateStorage, key: string): string | undefined {
  try {
    return storage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function write(storage: UpdateStorage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage is unavailable: the next start checks again, or offers the skipped version again.
  }
}

/** Skip this version: automatic checks no longer offer `version`. */
export function skipVersion(version: string, storage: UpdateStorage = localStorage): void {
  write(storage, SKIPPED_KEY, version);
}

/** Asks GitHub for the latest release: the update when it is newer than the running tiili, else undefined. */
export async function findUpdate(): Promise<FoundUpdate | undefined> {
  const update = await check();
  if (!update) return undefined;
  const kind = await invoke<InstallKind>("update_install_kind").catch((): InstallKind => "bundle");
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body?.trim() ?? "",
    kind,
    releaseUrl: releasePageUrl(update.version),
    async install(onProgress) {
      let total: number | undefined;
      let done = 0;
      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          total = event.data.contentLength || undefined;
          onProgress(total ? 0 : undefined);
        } else if (event.event === "Progress") {
          done += event.data.chunkLength;
          onProgress(total ? Math.min(1, done / total) : undefined);
        } else {
          onProgress(1);
        }
      });
      await relaunch();
    },
  };
}

export interface StartupCheck {
  /** Whether automatic checks are on in Settings. */
  enabled: boolean;
  /** Shows the update dialog. */
  show: (update: FoundUpdate) => void;
  storage?: UpdateStorage;
  now?: number;
  find?: () => Promise<FoundUpdate | undefined>;
}

/**
 * The startup check: when checks are on and none was made in the last day, asks for the latest release and shows
 * an update that is newer and not skipped. A failed check stays quiet and waits for the next day.
 */
export async function startupCheck({
  enabled,
  show,
  storage = localStorage,
  now = Date.now(),
  find = findUpdate,
}: StartupCheck): Promise<void> {
  const last = read(storage, LAST_CHECK_KEY);
  if (!shouldAutoCheck(now, last === undefined ? undefined : Number(last), enabled)) return;
  write(storage, LAST_CHECK_KEY, String(now));
  const update = await find().catch(() => undefined);
  if (!update || isSkipped(update.version, read(storage, SKIPPED_KEY))) return;
  show(update);
}
