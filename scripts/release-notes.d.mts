export function parsePromotion(body: string): { notes: string[]; changes: string[] };
export function promotionNumber(subject: string): string | undefined;
export function buildNotes(input: {
  entries: ({ promotion: { number: string; body?: string } } | { subject: string })[];
  compareUrl?: string;
}): string;
