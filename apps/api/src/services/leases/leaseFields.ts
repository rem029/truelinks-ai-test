import type { SourcedField } from '@truelinks/shared';

export function formatMoney(amount: number, currency: string | null): string {
  const formatted = amount.toLocaleString('en-US');
  return currency ? `${currency} ${formatted}` : formatted;
}

export function getClauseIds(...fields: (SourcedField | null | undefined)[]): string[] {
  const ids = new Set<string>();
  for (const f of fields) {
    if (f?.source?.type === 'document' && f.source.clauseId) {
      ids.add(f.source.clauseId);
    }
  }
  return Array.from(ids);
}
