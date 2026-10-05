import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Kysely } from 'kysely';
import { createDb } from '../../db/db.ts';
import { migrateToLatest } from '../../../migrations/migrate.ts';
import { seed } from '../../db/seed.ts';
import { createRepositories, type Repositories } from '../../db/repositories/index.ts';
import type { Database } from '../../db/schema.ts';
import { createStubProvider } from '../../agents/modelProvider/stubProvider.ts';
import { createConversation } from '../../conversations/createConversation.ts';
import { ingestLease } from '../ingest/ingestLease.ts';
import { extractLease } from '../extract/extractLease.ts';
import { getField } from '../leaseFields.ts';
import { runCorrectionTurn } from './correctionTurn.ts';
import { HttpError } from '../../../utils/httpError.ts';

const sampleLeasesDir = resolve(import.meta.dirname, '../../../../../../data/sample-leases');

describe('correctionTurn', () => {
  let db: Kysely<Database>;
  let repositories: Repositories;
  let uploadDir: string;
  const modelProvider = createStubProvider();

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repositories = createRepositories(db);
    uploadDir = mkdtempSync(join(tmpdir(), 'correction-turn-test-'));
  });

  afterEach(async () => {
    await db.destroy();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  async function uploadSample(filename: string) {
    const conversation = await createConversation({ kind: 'lease' }, repositories);
    const { document } = await ingestLease(
      {
        conversationId: conversation.id,
        file: {
          buffer: readFileSync(join(sampleLeasesDir, filename)),
          originalName: filename,
          mimeType: 'application/pdf',
        },
      },
      { repositories, uploadDir, modelProvider }
    );
    const lease = await extractLease(document, { repositories, modelProvider });
    return { conversation, document, lease };
  }

  it('updates rent.amount on lease-05 when owner specifies "monthly rent is 8,000"', async () => {
    const { conversation } = await uploadSample('lease-05-unknown-unit-rent-conflict.pdf');

    const result = await runCorrectionTurn(
      conversation.id,
      'monthly rent is 8,000',
      { repositories, modelProvider }
    );

    const rentField = getField(result.lease.record, 'rent.amount');
    expect(rentField.value).toBe(8000);
    expect(rentField.source?.type).toBe('user');
    if (rentField.source?.type === 'user') {
      expect(rentField.source.messageId).toBe(result.messages[0]?.id);
    }

    const assistantMsg = result.messages[1];
    expect(assistantMsg?.agentRun?.toolCalls.some((tc) => tc.name === 'update_field')).toBe(true);
    expect(assistantMsg?.text).toContain('rent.amount:');
  });

  it('asks clarifying question when instruction is vague ("the rent looks wrong")', async () => {
    const { conversation, lease } = await uploadSample('lease-05-unknown-unit-rent-conflict.pdf');
    const initialRent = getField(lease.record, 'rent.amount').value;

    const result = await runCorrectionTurn(
      conversation.id,
      'the rent looks wrong',
      { repositories, modelProvider }
    );

    expect(getField(result.lease.record, 'rent.amount').value).toBe(initialRent);
    const assistantMsg = result.messages[1];
    expect(assistantMsg?.text).toBe('Which field should I change, and to what value?');
    expect(assistantMsg?.agentRun?.toolCalls.some((tc) => tc.name === 'ask_user')).toBe(true);
  });

  it('returns 409 when attempting correction on a confirmed lease', async () => {
    const { conversation, lease } = await uploadSample('lease-01-clean-MC-B-1204.pdf');
    await repositories.leases.update({
      ...lease,
      status: 'confirmed',
    });

    await expect(
      runCorrectionTurn(conversation.id, 'monthly rent is 9,000', { repositories, modelProvider })
    ).rejects.toThrow(HttpError);
  });
});
