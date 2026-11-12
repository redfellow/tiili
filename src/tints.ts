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
