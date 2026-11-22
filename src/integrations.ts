/** One integration's row in Settings → Integrations, as the app reads it from disk and PATH when the settings open. */
export interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  /** The folder it installs to. */
  location: string;
  installed: boolean;
  /** Whether it can be turned on: its tool (omp, claude) is on PATH. One that is installed can be turned off either way. */
  available: boolean;
  /** Why it is not available, and what to do about it. */
  reason: string | null;
}

/** Turn integration `id` on or off. */
export interface IntegrationChange {
  id: string;
  on: boolean;
}

/** How one change went: when it failed, what went wrong and a fix to try. */
export interface IntegrationOutcome {
  id: string;
  ok: boolean;
  error: string | null;
  fix: string | null;
}

/** Installing and uninstalling integrations, where the backend can (the Tauri app). */
export interface Integrations {
  /** Every integration's row. */
  status(): Promise<IntegrationStatus[]>;
  /** Makes each change on its own, so one failing leaves the others made, and says how each went. */
  apply(changes: IntegrationChange[]): Promise<IntegrationOutcome[]>;
}

/** What a row shows: its box, whether the box can be changed, why not, and the last Save's error and fix. */
export interface IntegrationRowView {
  checked: boolean;
  disabled: boolean;
  reason: string | null;
  error: string | null;
  fix: string | null;
}

/** Whether row `row`'s box can be changed: it can be turned on, or it is installed and so can be turned off. */
function changeable(row: IntegrationStatus): boolean {
  return row.available || row.installed;
}

/**
 * The changes Save makes: each row whose box (`ticked`, by id) differs from what is installed, where that change can
 * be made (turning off always can; turning on needs the row available).
 */
export function integrationChanges(
  rows: readonly IntegrationStatus[],
  ticked: ReadonlyMap<string, boolean>,
): IntegrationChange[] {
  return rows.flatMap((row) => {
    const on = ticked.get(row.id);
    return on !== undefined && on !== row.installed && (row.available || !on) ? [{ id: row.id, on }] : [];
  });
}

/**
 * Row `row` as shown: its box ticked as in `ticked` (else as installed) unless it cannot be changed, the reason when it
 * cannot be turned on, and the error and fix of `outcome` when that failed. An installed row whose tool is missing can
 * still be unticked, and ticked back.
 */
export function integrationRowView(
  row: IntegrationStatus,
  ticked: boolean | undefined,
  outcome?: IntegrationOutcome,
): IntegrationRowView {
  const failed = outcome !== undefined && !outcome.ok;
  return {
    checked: changeable(row) ? (ticked ?? row.installed) : row.installed,
    disabled: !changeable(row),
    reason: row.available ? null : row.reason,
    error: failed ? outcome.error : null,
    fix: failed ? outcome.fix : null,
  };
}
