import type { Clause } from '@truelinks/shared';

// PDF text extraction and model output differ in whitespace and typography; the words must still match.
function normalise(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function verifyQuote(clauses: Clause[], clauseId: string, quote: string): boolean {
  const normQuote = normalise(quote);
  if (!normQuote) {
    return false;
  }

  const clause = clauses.find((c) => c.id === clauseId);
  if (!clause) {
    return false;
  }

  return normalise(clause.text).includes(normQuote);
}
