import { describe, it, expect } from 'vitest';
import type { Clause } from '@truelinks/shared';
import { verifyQuote } from './verifyQuote.ts';

describe('verifyQuote', () => {
  const clauses: Clause[] = [
    {
      id: 'parties',
      heading: 'Parties',
      text: 'Landlord: Marina Crest Holdings W.L.L. (the "Landlord"). Tenant: Daniel Okafor (the "Tenant").',
      pages: { start: 1, end: 1 },
    },
    {
      id: '1',
      heading: 'Term',
      text: 'The term of this Lease is twenty-four (24) months, commencing on 1 November 2026.',
      pages: { start: 1, end: 1 },
    },
    {
      id: '2',
      heading: 'Rent',
      text: 'Rent is QAR 9,500 per month, payable monthly in advance.',
      pages: { start: 1, end: 1 },
    },
  ];

  it('matches exact quotes', () => {
    expect(verifyQuote(clauses, '1', 'twenty-four (24) months')).toBe(true);
  });

  it('matches across whitespace and newline differences', () => {
    const clausesWithNewlines: Clause[] = [
      {
        id: '1',
        heading: 'Term',
        text: 'The term of this Lease is\n  twenty-four (24)\n  months, commencing on\n  1 November 2026.',
        pages: { start: 1, end: 1 },
      },
    ];

    expect(verifyQuote(clausesWithNewlines, '1', 'twenty-four (24) months')).toBe(true);
    expect(verifyQuote(clauses, '1', 'twenty-four   \t  (24)\nmonths')).toBe(true);
  });

  it('normalises curly quotes to straight quotes', () => {
    const clauseWithCurly: Clause[] = [
      {
        id: 'parties',
        heading: 'Parties',
        text: 'Landlord: Marina Crest Holdings W.L.L. (the “Landlord”). Tenant’s representative.',
        pages: { start: 1, end: 1 },
      },
    ];

    expect(verifyQuote(clauseWithCurly, 'parties', '(the "Landlord")')).toBe(true);
    expect(verifyQuote(clauseWithCurly, 'parties', "Tenant's representative")).toBe(true);
    expect(verifyQuote(clauses, 'parties', '(the “Landlord”)')).toBe(true);
  });

  it('normalises en-dashes and em-dashes to hyphens', () => {
    const clauseWithDashes: Clause[] = [
      {
        id: '1',
        heading: 'Term',
        text: 'The term is twenty–four (24) months — commencing 1 November 2026.',
        pages: { start: 1, end: 1 },
      },
    ];

    expect(verifyQuote(clauseWithDashes, '1', 'twenty-four (24) months - commencing')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(verifyQuote(clauses, '2', 'qar 9,500 per month')).toBe(true);
    expect(verifyQuote(clauses, '2', 'QAR 9,500 PER MONTH')).toBe(true);
  });

  it('returns false for unknown clause id', () => {
    expect(verifyQuote(clauses, 'non-existent', 'twenty-four (24) months')).toBe(false);
  });

  it('returns false for empty or whitespace-only quotes', () => {
    expect(verifyQuote(clauses, '1', '')).toBe(false);
    expect(verifyQuote(clauses, '1', '   \t\n  ')).toBe(false);
  });

  it('returns false when quote exists in another clause but not the cited clause', () => {
    // Quote is in clause '2', but we cite clause '1'
    expect(verifyQuote(clauses, '1', 'QAR 9,500 per month')).toBe(false);
  });
});
