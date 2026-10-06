import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Kysely } from 'kysely';
import { createStubProvider } from '../../agents/modelProvider/stubProvider.ts';
import { createDb } from '../../../db/db.ts';
import { migrateToLatest } from '../../../migrations/migrate.ts';
import { seed } from '../../../db/seed.ts';
import { createRepositories, type Repositories } from '../../../db/repositories/index.ts';
import type { Database } from '../../../db/schema.ts';
import { createConversation } from '../../conversations/createConversation.ts';
import { ingestLease } from '../ingest/ingestLease.ts';
import { extractLease } from '../extract/extractLease.ts';
import { analyzeLease } from '../extract/analyzeLease.ts';
import { getField } from '../leaseFields.ts';
import { applyCardAction } from './applyCardAction.ts';
import { confirmLease } from './confirmLease.ts';
import { HttpError } from '../../../utils/httpError.ts';

const sampleLeasesDir = resolve(import.meta.dirname, '../../../../../../data/sample-leases');

describe('applyCardAction and confirmLease', () => {
  let db: Kysely<Database>;
  let repositories: Repositories;
  let uploadDir: string;
  const modelProvider = createStubProvider();

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repositories = createRepositories(db);
    uploadDir = mkdtempSync(join(tmpdir(), 'card-actions-test-'));
  });

  afterEach(async () => {
    await db.destroy();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  async function uploadSampleLease(filename: string) {
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

  it('lease-05 upload + analyze -> VALUE_CONFLICT open -> edit rent.monthly resolves conflict and reports changes', async () => {
    const { conversation, document, lease } = await uploadSampleLease('lease-05-unknown-unit-rent-conflict.pdf');
    await analyzeLease(lease, document, { repositories, modelProvider });

    const analyzedLease = await repositories.leases.get(lease.id);
    expect(analyzedLease).not.toBeNull();
    const conflictFlag = analyzedLease!.flags.find((f) => f.code === 'VALUE_CONFLICT');
    expect(conflictFlag).toBeDefined();
    expect(conflictFlag?.reviewStatus).toBe('open');

    const result = await applyCardAction(
      conversation.id,
      { type: 'edit', cardId: 'field:rent.monthly', value: 'QAR 8,500' },
      { repositories }
    );

    expect(result.lease.flags.some((f) => f.code === 'VALUE_CONFLICT')).toBe(false);
    expect(getField(result.lease.record, 'rent.monthly').value).toBe(8500);
    expect(getField(result.lease.record, 'rent.monthly').review.status).toBe('edited');

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.role).toBe('user');
    expect(result.messages[0]?.text).toBe('Changed Monthly Rent to QAR 8,500');
    expect(result.messages[1]?.role).toBe('assistant');
    expect(result.messages[1]?.text).toContain('Flag resolved:');
  });

  it('accepts and dismisses flags', async () => {
    const { conversation, document, lease } = await uploadSampleLease('lease-02-problems-MC-B-0902.pdf');
    await analyzeLease(lease, document, { repositories, modelProvider });

    const currentLease = (await repositories.leases.get(lease.id))!;
    const targetFlag = currentLease.flags.find((f) => f.reviewStatus === 'open');
    expect(targetFlag).toBeDefined();

    const acceptRes = await applyCardAction(
      conversation.id,
      { type: 'accept', cardId: `flag:${targetFlag!.id}` },
      { repositories }
    );
    const acceptedFlag = acceptRes.lease.flags.find((f) => f.id === targetFlag!.id);
    expect(acceptedFlag?.reviewStatus).toBe('accepted');
    expect(acceptRes.messages[0]?.text).toBe(`Acknowledged flag: ${targetFlag!.message}`);

    const dismissRes = await applyCardAction(
      conversation.id,
      { type: 'reject', cardId: `flag:${targetFlag!.id}` },
      { repositories }
    );
    const dismissedFlag = dismissRes.lease.flags.find((f) => f.id === targetFlag!.id);
    expect(dismissedFlag?.reviewStatus).toBe('dismissed');
    expect(dismissRes.messages[0]?.text).toBe(`Dismissed flag: ${targetFlag!.message}`);
  });

  it('acceptAll leaves flagged fields pending', async () => {
    const { conversation, document, lease } = await uploadSampleLease('lease-05-unknown-unit-rent-conflict.pdf');
    await analyzeLease(lease, document, { repositories, modelProvider });

    const result = await applyCardAction(
      conversation.id,
      { type: 'acceptAll' },
      { repositories }
    );

    const commencement = getField(result.lease.record, 'commencementDate');
    expect(commencement.value).not.toBeNull();
    expect(commencement.review.status).toBe('accepted');

    const monthlyRent = getField(result.lease.record, 'rent.monthly');
    expect(monthlyRent.review.status).toBe('pending');
    expect(result.messages[0]?.text).toBe('Accepted all remaining fields');
    expect(result.messages[1]?.text).toContain('Accepted 16 fields.');

    const secondResult = await applyCardAction(
      conversation.id,
      { type: 'acceptAll' },
      { repositories }
    );
    expect(secondResult.messages[1]?.text).toContain('Nothing left to accept.');
  });

  it('returns 400 for bad card id or disallowed action', async () => {
    const { conversation } = await uploadSampleLease('lease-01-clean-MC-B-1204.pdf');

    await expect(
      applyCardAction(conversation.id, { type: 'accept', cardId: 'invalid-card-id' }, { repositories })
    ).rejects.toThrow(HttpError);

    await expect(
      applyCardAction(conversation.id, { type: 'accept', cardId: 'rule:R1' }, { repositories })
    ).rejects.toThrow(HttpError);

    await expect(
      applyCardAction(
        conversation.id,
        { type: 'edit', cardId: 'field:rent.monthly', value: 'not-a-number' },
        { repositories }
      )
    ).rejects.toThrow(HttpError);

    await expect(
      applyCardAction(
        conversation.id,
        { type: 'choose', cardId: 'unitMatch', option: 'NON-EXISTENT-UNIT' },
        { repositories }
      )
    ).rejects.toThrow(HttpError);
  });

  it('a 400 edit adds no message to the conversation', async () => {
    const { conversation } = await uploadSampleLease('lease-01-clean-MC-B-1204.pdf');
    const messagesBefore = await repositories.conversations.listMessages(conversation.id);

    await expect(
      applyCardAction(
        conversation.id,
        { type: 'edit', cardId: 'field:rent.monthly', value: 'not-a-number' },
        { repositories }
      )
    ).rejects.toThrow(HttpError);

    const messagesAfter = await repositories.conversations.listMessages(conversation.id);
    expect(messagesAfter).toHaveLength(messagesBefore.length);
  });

  it('lease-02 choose MC-B-0902 sets unitId and R7 is no longer NOT_DETERMINABLE', async () => {
    const { conversation, lease } = await uploadSampleLease('lease-02-problems-MC-B-0902.pdf');
    expect(lease.unitId).toBeNull();
    const r7Before = lease.ruleResults.find((r) => r.ruleId === 'R7');
    expect(r7Before?.status).toBe('NOT_DETERMINABLE');

    const result = await applyCardAction(
      conversation.id,
      { type: 'choose', cardId: 'unitMatch', option: 'MC-B-0902' },
      { repositories }
    );

    expect(result.lease.unitId).toBe('MC-B-0902');
    const r7After = result.lease.ruleResults.find((r) => r.ruleId === 'R7');
    expect(r7After?.status).not.toBe('NOT_DETERMINABLE');
    expect(result.messages[0]?.text).toBe('Unit is MC-B-0902');
  });

  it('editing the unit ID only accepts one of the owner\'s units', async () => {
    const { conversation } = await uploadSampleLease('lease-02-problems-MC-B-0902.pdf');

    await expect(
      applyCardAction(conversation.id, { type: 'edit', cardId: 'field:unit.unitId', value: 'MC-B-12O4' }, { repositories })
    ).rejects.toMatchObject({ status: 400, message: 'MC-B-12O4 is not one of your units' });

    const result = await applyCardAction(
      conversation.id,
      { type: 'edit', cardId: 'field:unit.unitId', value: 'MC-B-0902' },
      { repositories }
    );
    expect(result.lease.unitId).toBe('MC-B-0902');
  });

  it('confirm with pending items throws 409 listing them', async () => {
    const { conversation } = await uploadSampleLease('lease-01-clean-MC-B-1204.pdf');

    try {
      await applyCardAction(
        conversation.id,
        { type: 'confirm', conversationId: conversation.id },
        { repositories }
      );
      expect.fail('Expected confirm to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(409);
      expect(httpErr.message).toContain('not reviewed');
    }
  });

  it('confirm with high FAIL requires override reason', async () => {
    const { conversation, document, lease } = await uploadSampleLease('lease-03-occupied-MC-B-1205.pdf');
    await analyzeLease(lease, document, { repositories, modelProvider });

    // Review all fields
    await applyCardAction(conversation.id, { type: 'acceptAll' }, { repositories });

    // Try confirm without override
    try {
      await applyCardAction(
        conversation.id,
        { type: 'confirm', conversationId: conversation.id },
        { repositories }
      );
      expect.fail('Expected confirm to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError;
      expect(httpErr.status).toBe(409);
      expect(httpErr.message).toContain('Override reason required for high-severity rule failures: R7');
    }

    // Confirm with override
    const result = await applyCardAction(
      conversation.id,
      {
        type: 'confirm',
        conversationId: conversation.id,
        overrideReason: 'Approved by board for existing tenant renewal',
      },
      { repositories }
    );

    expect(result.lease.status).toBe('confirmed');
    expect(result.lease.overrideReason).toBe('Approved by board for existing tenant renewal');
    expect(result.messages[0]?.text).toContain('Confirmed lease (override: Approved by board for existing tenant renewal)');
  });

  it('successful confirm occupies unit, confirms conversation, and blocks subsequent actions with 409', async () => {
    const { conversation, document, lease } = await uploadSampleLease('lease-01-clean-MC-B-1204.pdf');
    await analyzeLease(lease, document, { repositories, modelProvider });

    await applyCardAction(conversation.id, { type: 'acceptAll' }, { repositories });

    const confirmResult = await applyCardAction(
      conversation.id,
      { type: 'confirm', conversationId: conversation.id },
      { repositories }
    );

    expect(confirmResult.lease.status).toBe('confirmed');

    const unit = await repositories.units.get('MC-B-1204');
    expect(unit?.status).toBe('occupied');

    const conv = await repositories.conversations.get(conversation.id);
    expect(conv?.status).toBe('confirmed');

    // Subsequent action fails with 409
    await expect(
      applyCardAction(conversation.id, { type: 'acceptAll' }, { repositories })
    ).rejects.toThrow(HttpError);
  });

  it('confirmLease rolls back unit status if lease update fails inside the transaction', async () => {
    const { conversation, document, lease } = await uploadSampleLease('lease-01-clean-MC-B-1204.pdf');
    await analyzeLease(lease, document, { repositories, modelProvider });
    await applyCardAction(conversation.id, { type: 'acceptAll' }, { repositories });

    const unitBefore = await repositories.units.get('MC-B-1204');
    expect(unitBefore?.status).toBe('available');

    // Create a repositories wrapper whose leases.update throws inside the transaction
    const failingRepos: Repositories = {
      ...repositories,
      transaction: async <T>(fn: (repos: Repositories) => Promise<T>): Promise<T> => {
        return repositories.transaction(async (trxRepos) => {
          const failingTrxRepos: Repositories = {
            ...trxRepos,
            leases: {
              ...trxRepos.leases,
              update: async () => {
                throw new Error('Database disk write failure');
              },
            },
          };
          return fn(failingTrxRepos);
        });
      },
    };

    const currentLease = (await repositories.leases.get(lease.id))!;
    await expect(confirmLease(currentLease, undefined, failingRepos)).rejects.toThrow(
      'Database disk write failure'
    );

    // Unit must remain available
    const unitAfter = await repositories.units.get('MC-B-1204');
    expect(unitAfter?.status).toBe('available');

    // Conversation must remain open
    const convAfter = await repositories.conversations.get(conversation.id);
    expect(convAfter?.status).toBe('open');
  });
});
