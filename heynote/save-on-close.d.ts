import type { NoteChange } from "../src/heynoteStore";

export function pathsGone(change: NoteChange): string[];
export function notesToSave(contents: Iterable<[string, string]>, gone: ReadonlySet<string>): [string, string][];
