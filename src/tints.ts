/** How many project tints the brand defines (`--tint-1` … `--tint-16`). */
export const TINT_COUNT = 16;

/**
 * The tint a `pane-cwd` report gives its pane: the core assigns tints app-wide (`src-tauri/src/tints.rs`), so a
 * repository has the same tint in every window. Anything but a tint number from 1 to `TINT_COUNT` leaves the pane
 * untinted, since it would name a colour the stylesheet does not have.
 */
export function paneTint(place: { tint?: number | null }): number | undefined {
  const { tint } = place;
  return typeof tint === "number" && Number.isInteger(tint) && tint >= 1 && tint <= TINT_COUNT ? tint : undefined;
}
