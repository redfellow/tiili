export const ICON_NAME: string;
export function splitIcon(svg: string): { tile: string; layer: string };
export function srgb(hex: string): string;
export function iconJson(light: { tile: string }, dark: { tile: string }): Record<string, unknown>;
export function actoolArgs(iconPath: string, outDir: string): string[];
export function actoolMajor(): number | undefined;
export function iconFingerprint(iconPath: string): string;
export function compile(iconPath: string, carPath: string): void;
export const KOIVU: string;
export const KALKKI: string;
export const LIGHT_BLOOM: number[];
export const DARK_MIX: number[];
export function mix(a: string, b: string, t: number): string;
export function workingStyle(
  variant: "light" | "dark",
  frame: number,
): { cursor: string; bloom: string; opacity: number };
export function workingSvg(svg: string, variant: "light" | "dark", frame: number): string;
