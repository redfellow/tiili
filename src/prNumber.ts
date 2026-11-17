/**
 * The pull request number in `gh pr view --json number -q .number` output ("123\n"), or "" when the output is
 * anything else (empty, an error message, a number with other text). Pure: vite.config.ts uses it at build time.
 */
export function parsePrNumber(output: string): string {
  const text = output.trim();
  return /^[1-9]\d*$/.test(text) ? text : "";
}
