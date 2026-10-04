import { describe, it, expect } from 'vitest';
import { splitClauses } from './splitClauses.ts';

describe('splitClauses', () => {
  it('splits numbered and section headings in sequence', () => {
    const pages = [
      {
        page: 1,
        text: `RESIDENTIAL LEASE AGREEMENT
Reference: REF-001
PARTIES
Landlord: Acme Corp.
Tenant: John Doe.
PREMISES
Apartment 101.
1. Term
The term is 12 months.
2. Rent
Rent is 5000 QAR.
SIGNATURES
Signed by all parties.`,
      },
    ];

    const { clauses, usedFallback } = splitClauses(pages);
    expect(usedFallback).toBe(false);
    expect(clauses.map((c) => c.id)).toEqual([
      'preamble',
      'parties',
      'premises',
      '1',
      '2',
      'signatures',
    ]);
    expect(clauses.map((c) => c.heading)).toEqual([
      'Preamble',
      'PARTIES',
      'PREMISES',
      'Term',
      'Rent',
      'SIGNATURES',
    ]);
  });

  it('preserves hyphenated words/identifiers split across lines without extra space', () => {
    const pages = [
      {
        page: 1,
        text: `LEASE
PREMISES
Apartment 1204 (Unit ID MC-
B-1204) with parking.`,
      },
    ];

    const { clauses } = splitClauses(pages);
    const premises = clauses.find((c) => c.id === 'premises');
    expect(premises?.text).toBe('Apartment 1204 (Unit ID MC-B-1204) with parking.');
  });

  it('ignores wrapped lines or mid-text lines starting with numbers (sequential guard)', () => {
    const pages = [
      {
        page: 1,
        text: `LEASE AGREEMENT
1. Term
The term commences on
1 November 2026 and continues for 12 months.
12. Random text that is not the next heading.
2. Rent
Rent is 5000 QAR.`,
      },
    ];

    const { clauses, usedFallback } = splitClauses(pages);
    expect(usedFallback).toBe(false);
    expect(clauses.map((c) => c.id)).toEqual(['preamble', '1', '2']);
    const clause1 = clauses.find((c) => c.id === '1');
    expect(clause1?.text).toContain('1 November 2026 and continues for 12 months');
    expect(clause1?.text).toContain('12. Random text that is not the next heading');
  });

  it('captures preamble before the first heading and treats first line as title', () => {
    const pages = [
      {
        page: 1,
        text: `COMMERCIAL LEASE
Version 2026
PARTIES
Landlord and Tenant`,
      },
    ];

    const { clauses, usedFallback } = splitClauses(pages);
    expect(usedFallback).toBe(false);
    expect(clauses[0]).toEqual({
      id: 'preamble',
      heading: 'Preamble',
      text: 'COMMERCIAL LEASE Version 2026',
      pages: { start: 1, end: 1 },
    });
  });

  it('computes correct page ranges for clauses spanning multiple pages', () => {
    const pages = [
      {
        page: 1,
        text: `LEASE
1. Maintenance
The landlord shall maintain structural elements.`,
      },
      {
        page: 2,
        text: `The tenant shall maintain internal fixtures and promptly report damages.
2. Notices
All notices in writing.`,
      },
    ];

    const { clauses, usedFallback } = splitClauses(pages);
    expect(usedFallback).toBe(false);
    const maintenance = clauses.find((c) => c.id === '1');
    expect(maintenance?.pages).toEqual({ start: 1, end: 2 });
    const notices = clauses.find((c) => c.id === '2');
    expect(notices?.pages).toEqual({ start: 2, end: 2 });
  });

  it('handles duplicate section heading slugs by appending suffix', () => {
    const pages = [
      {
        page: 1,
        text: `LEASE
TERMS
First terms block.
TERMS
Second terms block.
TERMS
Third terms block.`,
      },
    ];

    const { clauses, usedFallback } = splitClauses(pages);
    expect(usedFallback).toBe(false);
    expect(clauses.map((c) => c.id)).toEqual(['preamble', 'terms', 'terms-2', 'terms-3']);
  });

  it('falls back to paragraph splitting when no headings exist', () => {
    const pages = [
      {
        page: 1,
        text: `This is the first paragraph with some details.
It continues on the second line.

This is the second paragraph after a blank line.

And this is the third paragraph.`,
      },
    ];

    const { clauses, usedFallback } = splitClauses(pages);
    expect(usedFallback).toBe(true);
    expect(clauses.map((c) => c.id)).toEqual(['p1', 'p2', 'p3']);
    expect(clauses[0]?.heading).toBe('Paragraph 1');
    expect(clauses[0]?.text).toBe('This is the first paragraph with some details. It continues on the second line.');
    expect(clauses[1]?.heading).toBe('Paragraph 2');
    expect(clauses[2]?.heading).toBe('Paragraph 3');
  });

  it('falls back to page-based paragraph splitting when no blank lines exist', () => {
    const pages = [
      {
        page: 1,
        text: `Single block of text on page 1 without any blank lines.`,
      },
      {
        page: 2,
        text: `Single block of text on page 2 without any blank lines.`,
      },
    ];

    const { clauses, usedFallback } = splitClauses(pages);
    expect(usedFallback).toBe(true);
    expect(clauses.map((c) => c.id)).toEqual(['p1', 'p2']);
    expect(clauses[0]?.pages).toEqual({ start: 1, end: 1 });
    expect(clauses[1]?.pages).toEqual({ start: 2, end: 2 });
  });

  it('sets pages to null for DOCX-style input with null page numbers', () => {
    const pages = [
      {
        page: null,
        text: `LEASE AGREEMENT
PARTIES
Landlord and Tenant
1. Term
Twelve months.`,
      },
    ];

    const { clauses, usedFallback } = splitClauses(pages);
    expect(usedFallback).toBe(false);
    expect(clauses.length).toBeGreaterThan(0);
    for (const clause of clauses) {
      expect(clause.pages).toBeNull();
    }
  });
});
