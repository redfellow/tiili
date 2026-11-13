/** How many project tints the brand defines (`--tint-1` … `--tint-16`). */
export const TINT_COUNT = 16;

/** Open panes per tint number; tints missing from the map have none. */
export type TintCounts = ReadonlyMap<number, number>;

/** Counts open panes per tint, from each pane's tint (`undefined` for untinted panes). */
export function tintCounts(tints: Iterable<number | undefined>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const tint of tints) {
    if (tint !== undefined) counts.set(tint, (counts.get(tint) ?? 0) + 1);
  }
  return counts;
}

/**
 * Gives each repository root a project tint for the session: the first sixteen roots get tints 1 to 16 in
 * the order they appear, and a root keeps its tint even after its panes close. Once all sixteen are taken, a
 * new root gets the tint with the fewest open panes, ties going to the lowest number.
 */
export class TintAssigner {
  private readonly tints = new Map<string, number>();

  /** The tint of repository `root`, assigning one if it is new; `openCounts` are the open panes per tint. */
  assign(root: string, openCounts: TintCounts): number {
    const known = this.tints.get(root);
    if (known !== undefined) return known;
    let tint = this.tints.size + 1;
    if (tint > TINT_COUNT) {
      tint = 1;
      for (let candidate = 2; candidate <= TINT_COUNT; candidate++) {
        if ((openCounts.get(candidate) ?? 0) < (openCounts.get(tint) ?? 0)) tint = candidate;
      }
    }
    this.tints.set(root, tint);
    return tint;
  }
}

/**
 * The key a pane's tint is assigned by: a local repository's root; for a remote pane, its host and repository root,
 * else its host alone. A local pane outside any repository has none and stays untinted. NUL can't occur in a path or
 * a host, so remote keys never equal a local root or another host's key.
 */
export function tintKey(place: {
  repo: { root: string } | null;
  host: string | null;
}): string | undefined {
  if (place.host === null) return place.repo?.root;
  return place.repo ? `remote\0${place.host}\0${place.repo.root}` : `remote\0${place.host}`;
}
