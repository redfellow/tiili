import type { PromptId } from "./settings";

/** A run of preview text in one of the theme's ANSI slots (0–15), or in its terminal text colour. */
export interface PromptSegment {
  text: string;
  ansi: number | "fg";
}

export interface PromptStyle {
  id: PromptId;
  label: string;
  /** The list group the style is shown in; Off stands first, outside any group. */
  group?: "One-line" | "Two-line";
  /** What the prompt looks like, line by line, in the same ANSI slots the shell scripts use; empty for Off. */
  preview: PromptSegment[][];
}

const user: PromptSegment[] = [
  { text: "user", ansi: 6 },
  { text: "@", ansi: "fg" },
  { text: "host", ansi: 2 },
];

/** Every prompt choice in list order: Off, then the one-line styles, then the two-line one. */
export const PROMPT_STYLES: readonly PromptStyle[] = [
  { id: "off", label: "Off — my shell's own prompt", preview: [] },
  {
    id: "classic",
    label: "Classic",
    group: "One-line",
    preview: [[...user, { text: ":", ansi: "fg" }, { text: "~/src", ansi: 4 }, { text: "$", ansi: "fg" }]],
  },
  {
    id: "minimal",
    label: "Minimal",
    group: "One-line",
    preview: [[{ text: "~/src", ansi: 4 }, { text: " ", ansi: "fg" }, { text: "❯", ansi: 5 }]],
  },
  {
    id: "tiili",
    label: "Tiili",
    group: "Two-line",
    preview: [[...user, { text: " ", ansi: "fg" }, { text: "~/src", ansi: 4 }], [{ text: "❯", ansi: 3 }]],
  },
];
