import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readLeaseDocument } from './readDocument.ts';
import { splitClauses } from './splitClauses.ts';
import { ingestLease } from './ingestLease.ts';
import { sampleLeaseRecords } from '../sampleLeaseRecords.ts';
import { createStubProvider } from '../../agents/modelProvider/stubProvider.ts';
import { createDb } from '../../../db/db.ts';
import { migrateToLatest } from '../../../migrations/migrate.ts';
import { createRepositories } from '../../../db/repositories/index.ts';

describe('ingestSamples', () => {
  const sampleLeasesDir = resolve(import.meta.dirname, '../../../../../../data/sample-leases');
  const modelProvider = createStubProvider();

  const sampleFiles: Array<{ filename: string; mimeType: string }> = [
    { filename: 'lease-01-clean-MC-B-1204.pdf', mimeType: 'application/pdf' },
    { filename: 'lease-02-problems-MC-B-0902.pdf', mimeType: 'application/pdf' },
    { filename: 'lease-03-occupied-MC-B-1205.pdf', mimeType: 'application/pdf' },
    { filename: 'lease-04-quarterly-no-deposit-MC-A-0301.pdf', mimeType: 'application/pdf' },
    { filename: 'lease-05-unknown-unit-rent-conflict.pdf', mimeType: 'application/pdf' },
    { filename: 'lease-06-long-MC-B-1204.pdf', mimeType: 'application/pdf' },
    { filename: 'lease-07-docx-MC-A-0302.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { filename: 'lease-08-image-MC-A-0301.png', mimeType: 'image/png' },
  ];

  for (const { filename, mimeType } of sampleFiles) {
    it(`reads and splits ${filename} with exact clause ids and quotes`, async () => {
      const filePath = resolve(sampleLeasesDir, filename);
      const buffer = readFileSync(filePath);
      const { pages } = await readLeaseDocument(buffer, mimeType, {
        filename,
        modelProvider,
      });
      const { clauses, usedFallback } = splitClauses(pages);

      expect(usedFallback).toBe(false);

      // Verify clause sequence: ['preamble', 'parties', 'premises', '1'..'n', 'signatures']
      const clauseIds = clauses.map((c) => c.id);
      expect(clauseIds[0]).toBe('preamble');
      expect(clauseIds[1]).toBe('parties');
      expect(clauseIds[2]).toBe('premises');
      expect(clauseIds[clauseIds.length - 1]).toBe('signatures');

      // The intermediate clauses must be strictly sequential numbers starting from '1'
      const numberedIds = clauseIds.slice(3, -1);
      const expectedNumberedIds = numberedIds.map((_, i) => String(i + 1));
      expect(numberedIds).toEqual(expectedNumberedIds);

      // Verify every verbatim quote in sampleLeaseRecords is contained in the cited clause
      const record = sampleLeaseRecords[filename];
      expect(record).toBeDefined();

      const clauseMap = new Map(clauses.map((c) => [c.id, c]));
      let verifiedQuoteCount = 0;

      function verifyQuotes(obj: unknown, path: string = '') {
        if (!obj || typeof obj !== 'object') return;

        const candidate = obj as { source?: { type?: string; clauseId?: string; quote?: string } };
        if (candidate.source && candidate.source.type === 'document' && candidate.source.clauseId) {
          const citedClause = clauseMap.get(candidate.source.clauseId);
          expect(
            citedClause,
            `Clause '${candidate.source.clauseId}' cited by ${path} should exist in ${filename}`
          ).toBeDefined();

          const normClause = citedClause!.text.replace(/\s+/g, ' ').trim();
          const normQuote = (candidate.source.quote ?? '').replace(/\s+/g, ' ').trim();
          expect(
            normClause.includes(normQuote),
            `Verbatim quote for ${path} not found in clause '${candidate.source.clauseId}' of ${filename}.\nQuote: "${normQuote}"\nClause text: "${normClause}"`
          ).toBe(true);
          verifiedQuoteCount++;
        }

        for (const [key, value] of Object.entries(obj)) {
          if (key !== 'source') {
            verifyQuotes(value, path ? `${path}.${key}` : key);
          }
        }
      }

      verifyQuotes(record);
      expect(verifiedQuoteCount).toBeGreaterThan(0);
    });
  }

  it('verifies lease-06 is >= 4 pages, has cross-page clauses, and deposit/signatures on page >= 2', async () => {
    const filePath = resolve(sampleLeasesDir, 'lease-06-long-MC-B-1204.pdf');
    const buffer = readFileSync(filePath);
    const { pages } = await readLeaseDocument(buffer, 'application/pdf');
    expect(pages.length).toBeGreaterThanOrEqual(4);

    const { clauses } = splitClauses(pages);
    const spanningClauses = clauses.filter((c) => c.pages && c.pages.start < c.pages.end);
    expect(spanningClauses.length).toBeGreaterThan(0);

    const depositClause = clauses.find((c) => c.id === '4');
    expect(depositClause?.pages?.start).toBeGreaterThanOrEqual(2);

    const signaturesClause = clauses.find((c) => c.id === 'signatures');
    expect(signaturesClause?.pages?.start).toBeGreaterThanOrEqual(2);
  });

  it('verifies lease-07 has null pages and textSource "text"', async () => {
    const filePath = resolve(sampleLeasesDir, 'lease-07-docx-MC-A-0302.docx');
    const buffer = readFileSync(filePath);
    const { pages, textSource } = await readLeaseDocument(
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(textSource).toBe('text');
    expect(pages.every((p) => p.page === null)).toBe(true);

    const { clauses } = splitClauses(pages);
    expect(clauses.every((c) => c.pages === null)).toBe(true);
  });

  it('verifies lease-08 has textSource "image"', async () => {
    const filePath = resolve(sampleLeasesDir, 'lease-08-image-MC-A-0301.png');
    const buffer = readFileSync(filePath);
    const { textSource, pages } = await readLeaseDocument(buffer, 'image/png', {
      filename: 'lease-08-image-MC-A-0301.png',
      modelProvider,
    });
    expect(textSource).toBe('image');
    expect(pages[0]?.text.length).toBeGreaterThan(0);
  });

  it('verifies lease-09 with stub provider falls back to clauseSplit "paragraphs"', async () => {
    const uploadDir = mkdtempSync(join(tmpdir(), 'truelinks-lease09-test-'));
    try {
      const db = createDb('file::memory:');
      await migrateToLatest(db);
      const repositories = createRepositories(db);
      const conv = await repositories.conversations.create({
        id: 'conv-l9',
        kind: 'lease',
        unitId: null,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const filePath = resolve(sampleLeasesDir, 'lease-09-inline-headings.pdf');
      const buffer = readFileSync(filePath);

      const result = await ingestLease(
        {
          conversationId: conv.id,
          file: {
            buffer,
            originalName: 'lease-09-inline-headings.pdf',
            mimeType: 'application/pdf',
          },
        },
        { repositories, uploadDir, modelProvider }
      );

      expect(result.document.clauseSplit).toBe('paragraphs');
      expect(result.document.clauses[0]?.id).toBe('p1');
    } finally {
      rmSync(uploadDir, { recursive: true, force: true });
    }
  });

  it('rejects unsupported mime types with clear error', async () => {
    await expect(readLeaseDocument(Buffer.from('hello'), 'text/plain')).rejects.toThrow(
      "Unsupported document type 'text/plain'"
    );
  });
});
