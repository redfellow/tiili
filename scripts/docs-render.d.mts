import type { Shortcut } from "../src/shortcuts";

export const START_MARKER: string;
export const END_MARKER: string;
export const TARGETS: [file: string, format: "md" | "html"][];
export function renderShortcuts(list: readonly Shortcut[], format: "md" | "html"): string;
export function fillShortcuts(text: string, rendered: string): string;
