import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CompletionRequest, CompletionResult, ModelProvider } from '../../agents/modelProvider/types.ts';
import { createDb } from '../../db/db.ts';
import { migrateToLatest } from '../../../migrations/migrate.ts';
import { createRepositories } from '../../db/repositories/index.ts';
import { detectHeadingsWithModel } from './detectHeadings.ts';
import { ingestLease } from './ingestLease.ts';

function createFakeProvider(handler: (req: CompletionRequest) => unknown): ModelProvider {
  return {
    name: 'stub',
    async complete<T = unknown>(req: CompletionRequest<T>): Promise<CompletionResult<T>> {
      const output = handler(req as CompletionRequest) as T;
      return {
        text: JSON.stringify(output),
        toolCalls: [],
        output,
        model: 'fake',
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    },
  };
}

describe('detectHeadingsWithModel', () => {
  const inlineLines = [
    { line: 'RESIDENTIAL LEASE AGREEMENT', page: 1 },
    { line: 'This agreement is between Marina Crest Holdings and Daniel Okafor for Apartment 1204 (MC-B-1204).', page: 1 },
    { line: '1. Term. The term of this Lease is twenty-four (24) months starting 1 November 2026.', page: 1 },
    { line: '2. Rent. The Tenant shall pay monthly rent of QAR 9,500 payable monthly in advance.', page: 1 },
    { line: '3. Security Deposit. The Tenant shall pay a security deposit of QAR 9,500 on signing.', page: 1 },
    { line: 'For Landlord: Khalid Al-Mansoori /s/ Khalid Al-Mansoori', page: 1 },
    { line: 'Tenant: Daniel Okafor /s/ Daniel Okafor', page: 1 },
  ];

  it('parses valid inline headings and includes first-sentence quote in clause text', async () => {
    const fakeProvider = createFakeProvider((req) => {
      expect(req.purpose).toBe('lease-clause-headings');
      return {
        headings: [
          { line: 2, id: '1' },
          { line: 3, id: '2' },
          { line: 4, id: '3' },
        ],
      };
    });

    const clauses = await detectHeadingsWithModel(inlineLines, fakeProvider);
    expect(clauses).not.toBeNull();
    expect(clauses!.map((c) => c.id)).toEqual(['preamble', '1', '2', '3']);

    const clause1 = clauses!.find((c) => c.id === '1');
    expect(clause1?.heading).toBe('Term');
    expect(clause1?.text).toContain('The term of this Lease is twenty-four (24) months');

    const clause2 = clauses!.find((c) => c.id === '2');
    expect(clause2?.heading).toBe('Rent');
    expect(clause2?.text).toContain('The Tenant shall pay monthly rent of QAR 9,500');
  });

  it('rejects out-of-range line indices and returns null', async () => {
    const fakeProvider = createFakeProvider(() => ({
      headings: [{ line: 99, id: '1' }],
    }));

    const result = await detectHeadingsWithModel(inlineLines, fakeProvider);
    expect(result).toBeNull();
  });

  it('rejects descending line indices and returns null', async () => {
    const fakeProvider = createFakeProvider(() => ({
      headings: [
        { line: 3, id: '1' },
        { line: 2, id: '2' },
      ],
    }));

    const result = await detectHeadingsWithModel(inlineLines, fakeProvider);
    expect(result).toBeNull();
  });

  it('rejects duplicate clause ids and returns null', async () => {
    const fakeProvider = createFakeProvider(() => ({
      headings: [
        { line: 2, id: '1' },
        { line: 3, id: '1' },
      ],
    }));

    const result = await detectHeadingsWithModel(inlineLines, fakeProvider);
    expect(result).toBeNull();
  });

  it('rejects heading that points to an empty line and returns null', async () => {
    const linesWithEmpty = [
      { line: 'Title', page: 1 },
      { line: '   ', page: 1 },
      { line: '1. Term. Some body text', page: 1 },
    ];
    const fakeProvider = createFakeProvider(() => ({
      headings: [{ line: 1, id: '1' }],
    }));

    const result = await detectHeadingsWithModel(linesWithEmpty, fakeProvider);
    expect(result).toBeNull();
  });

  it('rejects model output with > 200 headings', async () => {
    const fakeProvider = createFakeProvider(() => ({
      headings: Array.from({ length: 201 }, (_, i) => ({ line: i, id: String(i) })),
    }));

    const result = await detectHeadingsWithModel(inlineLines, fakeProvider);
    expect(result).toBeNull();
  });
});

describe('ingestLease with fake provider', () => {
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = mkdtempSync(join(tmpdir(), 'truelinks-ingest-test-'));
  });

  afterEach(() => {
    rmSync(uploadDir, { recursive: true, force: true });
  });

  async function setupConversation() {
    const db = createDb('file::memory:');
    await migrateToLatest(db);
    const repositories = createRepositories(db);
    const conv = await repositories.conversations.create({
      id: 'conv-test-1',
      kind: 'lease',
      unitId: null,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { repositories, conversationId: conv.id };
  }

  it('ingests image buffer with transcript -> textSource "image" and clauseSplit "ai"', async () => {
    const { repositories, conversationId } = await setupConversation();

    const transcriptText = [
      'RESIDENTIAL LEASE AGREEMENT',
      'Preamble text identifying parties Daniel Okafor and Marina Crest.',
      '1. Term. The term of this Lease is twenty-four (24) months commencing 1 November 2026.',
      '2. Rent. The Tenant shall pay monthly rent of QAR 9,500 in advance.',
      '3. Security Deposit. The Tenant shall pay QAR 9,500 upon signing.',
    ].join('\n');

    const fakeProvider = createFakeProvider((req) => {
      if (req.purpose === 'lease-transcription') {
        return { text: transcriptText };
      }
      if (req.purpose === 'lease-clause-headings') {
        return {
          headings: [
            { line: 2, id: '1' },
            { line: 3, id: '2' },
            { line: 4, id: '3' },
          ],
        };
      }
      throw new Error(`Unexpected purpose: ${req.purpose}`);
    });

    const result = await ingestLease(
      {
        conversationId,
        file: {
          buffer: Buffer.from('fake-png-bytes'),
          originalName: 'lease.png',
          mimeType: 'image/png',
        },
      },
      { repositories, uploadDir, modelProvider: fakeProvider }
    );

    expect(result.document.textSource).toBe('image');
    expect(result.document.clauseSplit).toBe('ai');
    expect(result.document.pageCount).toBe(1);
    expect(result.document.clauses.map((c) => c.id)).toEqual(['preamble', '1', '2', '3']);

    const clause2 = result.document.clauses.find((c) => c.id === '2');
    expect(clause2?.heading).toBe('Rent');
    expect(clause2?.text).toContain('The Tenant shall pay monthly rent of QAR 9,500');
  });

  it('falls back to "paragraphs" when AI heading detection fails', async () => {
    const { repositories, conversationId } = await setupConversation();

    const transcriptText = [
      'RESIDENTIAL LEASE AGREEMENT',
      '',
      'First paragraph of terms with Daniel Okafor.',
      '',
      'Second paragraph with rent of QAR 9,500.',
    ].join('\n');

    const fakeProvider = createFakeProvider((req) => {
      if (req.purpose === 'lease-transcription') {
        return { text: transcriptText };
      }
      if (req.purpose === 'lease-clause-headings') {
        // Return descending lines which fails validation
        return {
          headings: [
            { line: 4, id: '1' },
            { line: 2, id: '2' },
          ],
        };
      }
      throw new Error(`Unexpected purpose: ${req.purpose}`);
    });

    const result = await ingestLease(
      {
        conversationId,
        file: {
          buffer: Buffer.from('fake-jpeg-bytes'),
          originalName: 'lease.jpg',
          mimeType: 'image/jpeg',
        },
      },
      { repositories, uploadDir, modelProvider: fakeProvider }
    );

    expect(result.document.textSource).toBe('image');
    expect(result.document.clauseSplit).toBe('paragraphs');
    expect(result.document.clauses[0]?.id).toBe('p1');
  });

  it('throws 422 when image transcript is empty', async () => {
    const { repositories, conversationId } = await setupConversation();

    const fakeProvider = createFakeProvider((req) => {
      if (req.purpose === 'lease-transcription') {
        return { text: '   ' };
      }
      throw new Error(`Unexpected purpose: ${req.purpose}`);
    });

    await expect(
      ingestLease(
        {
          conversationId,
          file: {
            buffer: Buffer.from('fake-empty-image'),
            originalName: 'blank.png',
            mimeType: 'image/png',
          },
        },
        { repositories, uploadDir, modelProvider: fakeProvider }
      )
    ).rejects.toThrow('No text found in the document; scanned PDFs are not supported yet');
  });
});
