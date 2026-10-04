import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Clause } from '@truelinks/shared';
import { readLeaseDocument } from '../ingest/readDocument.ts';
import { splitClauses } from '../ingest/splitClauses.ts';
import { createStubProvider } from '../../agents/modelProvider/stubProvider.ts';
import { sampleLeaseRecords } from '../sampleLeaseRecords.ts';
import { toExtraction } from './fromRecord.ts';
import { buildLeaseRecord } from './buildLeaseRecord.ts';

describe('buildLeaseRecord', () => {
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

  const clausesByFile = new Map<string, Clause[]>();

  beforeAll(async () => {
    for (const { filename, mimeType } of sampleFiles) {
      const filePath = resolve(sampleLeasesDir, filename);
      const buffer = readFileSync(filePath);
      const { pages } = await readLeaseDocument(buffer, mimeType, { filename, modelProvider });
      const { clauses } = splitClauses(pages);
      clausesByFile.set(filename, clauses);
    }
  });

  for (const { filename } of sampleFiles) {
    it(`round-trips ${filename} with matching values and verified quotes`, () => {
      const clauses = clausesByFile.get(filename)!;
      expect(clauses).toBeDefined();

      const fixture = sampleLeaseRecords[filename]!;
      expect(fixture).toBeDefined();

      const extraction = toExtraction(fixture);
      const { record, flags } = buildLeaseRecord(extraction, clauses);

      expect(record).toEqual(fixture);

      function checkAllSourcesVerified(obj: unknown, path = ''): void {
        if (!obj || typeof obj !== 'object') return;
        const candidate = obj as { source?: { type?: string; verified?: boolean } };
        if (candidate.source?.type === 'document') {
          expect(
            candidate.source.verified,
            `${path} in ${filename} should have verified: true`
          ).toBe(true);
        }
        for (const [k, v] of Object.entries(obj)) {
          if (k !== 'source') {
            checkAllSourcesVerified(v, path ? `${path}.${k}` : k);
          }
        }
      }
      checkAllSourcesVerified(record);

      expect(flags).toEqual([]);
    });
  }

  it('sets verified to false when quote does not match clause text', () => {
    const clauses = clausesByFile.get('lease-01-clean-MC-B-1204.pdf')!;
    const fixture = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
    const extraction = toExtraction(fixture);
    extraction.fields.rent.amount.quote = 'not a real quote from clause 2';

    const { record, flags } = buildLeaseRecord(extraction, clauses);

    expect(record.rent.amount.source?.type).toBe('document');
    if (record.rent.amount.source?.type === 'document') {
      expect(record.rent.amount.source.verified).toBe(false);
    }
    expect(record.rent.amount.value).toBe(9500);
    // Unverified quotes are not flagged here (handled in step 2 flags)
    expect(flags.some((f) => f.code === 'UNVERIFIED_QUOTE')).toBe(false);
  });

  it('sets value to null and creates UNREADABLE_VALUE flag for an invalid date', () => {
    const clauses = clausesByFile.get('lease-01-clean-MC-B-1204.pdf')!;
    const fixture = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
    const extraction = toExtraction(fixture);
    extraction.fields.commencementDate.value = 'invalid-date-string';

    const { record, flags } = buildLeaseRecord(extraction, clauses);
    expect(record.commencementDate.value).toBeNull();
    expect(record.commencementDate.source).toBeNull();
    expect(record.commencementDate.confidence).toBe(0);

    expect(flags).toContainEqual({
      id: 'UNREADABLE_VALUE:commencementDate',
      code: 'UNREADABLE_VALUE',
      severity: 'medium',
      message: 'Could not read commencementDate: "invalid-date-string"',
      fieldPaths: ['commencementDate'],
      clauseIds: ['1'],
      reviewStatus: 'open',
    });
  });

});
