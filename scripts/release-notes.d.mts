export interface NotesEntryPromotion {
  promotion: { number: string; body?: string };
}
export type NotesEntry = NotesEntryPromotion | { subject: string };
export function parsePromotion(body: string): { notes: string[]; changes: string[] };
export function promotionNumber(subject: string): string | undefined;
export function buildNotes(input: { entries: NotesEntry[]; compareUrl?: string; whatsNew?: string[] }): string;
export function pullNumbers(changes: string[]): string[];
export function pullRequestBrief(pr: {
  number: number | string;
  title: string;
  body?: string;
  commits?: { messageHeadline?: string; messageBody?: string }[];
}): string;
export function claudePrompt(input: { briefs: string[]; hints?: string[] }): string;
export function parseClaudeNotes(text: string): string[];
export function mainEntries(range: string): Promise<NotesEntry[]>;
export function claudePromptFor(entries: NotesEntry[]): Promise<string>;
