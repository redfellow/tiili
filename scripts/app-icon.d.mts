export const ICON_NAME: string;
export function splitIcon(svg: string): { tile: string; layer: string };
export function srgb(hex: string): string;
export function iconJson(light: { tile: string }, dark: { tile: string }): Record<string, unknown>;
export function actoolArgs(iconPath: string, outDir: string): string[];
export function actoolMajor(): number | undefined;
export function compile(iconPath: string, carPath: string): void;
