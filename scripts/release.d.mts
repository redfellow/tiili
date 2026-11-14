export const KINDS: string[];
export function bumpVersion(version: string, kind: string): string;
export function compareVersions(a: string, b: string): number;
export function highestTag(tags: string[]): string;
export function pickTarget(
  arg: string | undefined,
  latest: string,
  latestPublished: boolean,
): { version: string | undefined; resume: boolean };
export function setJsonVersion(text: string, version: string): string;
export function setCargoVersion(text: string, version: string): string;
