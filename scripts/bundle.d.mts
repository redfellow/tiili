export function bundleArgs(
  platform: string,
  extra: string[],
  env: Record<string, string | undefined>,
): string[] | undefined;

export function dmgPostSteps(
  env: Record<string, string | undefined>,
  dmgPath: string,
  scratch: { dir: string; password: string },
): { steps: [string, string[]][]; cleanup: [string, string[]][] };
