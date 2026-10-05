import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { ModelProvider } from '../../agents/modelProvider/types.ts';
import { createStubProvider } from '../../agents/modelProvider/stubProvider.ts';
import { createDb } from '../../../db/db.ts';
import { migrateToLatest } from '../../../migrations/migrate.ts';
import { seed } from '../../../db/seed.ts';
import { createRepositories, type Repositories } from '../../../db/repositories/index.ts';
import type { Database } from '../../../db/schema.ts';
import { createConversation } from '../../conversations/createConversation.ts';
import { ingestLease } from '../ingest/ingestLease.ts';
import { sampleLeaseRecords } from '../sampleLeaseRecords.ts';
import { extractLease } from './extractLease.ts';
import { analyzeLease } from './analyzeLease.ts';

const sampleLeasesDir = resolve(import.meta.dirname, '../../../../../../data/sample-leases');

const Expected = z.record(
  z.string(),
  z.object({ rules: z.record(z.string(), z.string()), flags: z.array(z.string()) })
);
const expected = Expected.parse(JSON.parse(readFileSync(join(sampleLeasesDir, 'expected.json'), 'utf-8')));

// Policy breaches are rule results, not flags (task 04 phase 3 decision), so these expected.json strings show up as R3/R7 FAIL
const COVERED_BY_RULES = new Set(['Unit is currently occupied', 'Term 48 months exceeds 36 without owner approval']);

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
};

describe('extractLease', () => {
  let db: Kysely<Database>;
  let repositories: Repositories;
  let uploadDir: string;
  const modelProvider = createStubProvider();

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repositories = createRepositories(db);
    uploadDir = mkdtempSync(join(tmpdir(), 'extract-lease-'));
  });

  afterEach(async () => {
    await db.destroy();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  async function uploadSample(filename: string, provider: ModelProvider = modelProvider) {
    const conversation = await createConversation({ kind: 'lease' }, repositories);
    const ext = filename.slice(filename.lastIndexOf('.'));
    const { document } = await ingestLease(
      {
        conversationId: conversation.id,
        file: { buffer: readFileSync(join(sampleLeasesDir, filename)), originalName: filename, mimeType: MIME_TYPES[ext]! },
      },
      { repositories, uploadDir, modelProvider: provider }
    );
    return { conversation, document };
  }

  for (const filename of Object.keys(sampleLeaseRecords)) {
    it(`extracts and analyzes ${filename} into the fixture record with rules and flags from expected.json`, async () => {
      const { conversation, document } = await uploadSample(filename);
      const extracted = await extractLease(document, { repositories, modelProvider });
      expect(extracted.analysisStatus).toBe('pending');
      const lease = await analyzeLease(extracted, document, { repositories, modelProvider });
      expect(lease.analysisStatus).toBe('done');

      expect(lease.record).toEqual(sampleLeaseRecords[filename]);
      expect(lease.status).toBe('draft');

      const statuses = Object.fromEntries(lease.ruleResults.map((r) => [r.ruleId, r.status]));
      expect(statuses).toEqual(expected[filename]!.rules);

      // expected.json writes amounts without the currency the code prefixes ("QAR 72,000")
      const messages = lease.flags.map((f) => f.message.replaceAll('QAR ', ''));
      for (const flagMessage of expected[filename]!.flags) {
        if (COVERED_BY_RULES.has(flagMessage)) continue;
        expect(messages, `${filename} should flag "${flagMessage}"`).toContain(flagMessage);
      }
      expect(lease.flags.map((f) => f.code)).not.toContain('UNVERIFIED_QUOTE');

      expect(await repositories.leases.getByConversation(conversation.id)).toEqual(lease);
    });
  }

  it('adds conflicts and concerns only in the background analysis', async () => {
    const { document } = await uploadSample('lease-05-unknown-unit-rent-conflict.pdf');
    const extracted = await extractLease(document, { repositories, modelProvider });
    expect(extracted.flags.map((f) => f.code)).not.toContain('VALUE_CONFLICT');

    const analyzed = await analyzeLease(extracted, document, { repositories, modelProvider });
    const added = analyzed.flags.filter((f) => !extracted.flags.some((e) => e.id === f.id));
    expect(added.map((f) => f.code)).toEqual(['VALUE_CONFLICT']);
  });

  it("keeps the owner's changes made while the analysis ran", async () => {
    const { document } = await uploadSample('lease-02-problems-MC-B-0902.pdf');
    const extracted = await extractLease(document, { repositories, modelProvider });
    const dismissed = extracted.flags.map((f) => ({ ...f, reviewStatus: 'dismissed' as const }));
    await repositories.leases.update({ ...extracted, flags: dismissed });

    const analyzed = await analyzeLease(extracted, document, { repositories, modelProvider });
    expect(analyzed.flags.slice(0, dismissed.length)).toEqual(dismissed);
    expect(analyzed.flags.at(-1)?.message).toBe('Renewal terms vague');
  });

  it('records a failed analysis on the lease instead of throwing', async () => {
    const { document } = await uploadSample('lease-01-clean-MC-B-1204.pdf');
    const extracted = await extractLease(document, { repositories, modelProvider });
    const failing: ModelProvider = {
      name: 'stub',
      async complete() {
        throw new Error('model down');
      },
    };

    const analyzed = await analyzeLease(extracted, document, { repositories, modelProvider: failing });
    expect(analyzed.analysisStatus).toBe('failed');
    expect(analyzed.flags.map((f) => f.code)).toContain('ANALYSIS_FAILED');
    expect(await repositories.leases.get(extracted.id)).toEqual(analyzed);
  });

  it('sets the lease unit only when the unit is matched', async () => {
    const matched = await extractLease((await uploadSample('lease-01-clean-MC-B-1204.pdf')).document, { repositories, modelProvider });
    expect(matched.unitId).toBe('MC-B-1204');
    const unconfirmed = await extractLease((await uploadSample('lease-02-problems-MC-B-0902.pdf')).document, { repositories, modelProvider });
    expect(unconfirmed.unitId).toBeNull();
  });

  it('returns 502 and saves no lease when the model fails', async () => {
    const { conversation, document } = await uploadSample('lease-01-clean-MC-B-1204.pdf');
    const failing: ModelProvider = {
      name: 'stub',
      async complete() {
        throw new Error('model down');
      },
    };
    await expect(extractLease(document, { repositories, modelProvider: failing })).rejects.toMatchObject({ status: 502 });
    expect(await repositories.leases.getByConversation(conversation.id)).toBeNull();
  });

  it('rejects a second upload to a conversation that already has a lease', async () => {
    const { conversation, document } = await uploadSample('lease-01-clean-MC-B-1204.pdf');
    await extractLease(document, { repositories, modelProvider });
    const buffer = readFileSync(join(sampleLeasesDir, 'lease-01-clean-MC-B-1204.pdf'));
    await expect(
      ingestLease(
        { conversationId: conversation.id, file: { buffer, originalName: 'again.pdf', mimeType: 'application/pdf' } },
        { repositories, uploadDir, modelProvider }
      )
    ).rejects.toMatchObject({ status: 409 });
  });
});
