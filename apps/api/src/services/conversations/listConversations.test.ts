import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Kysely } from 'kysely';
import { createDb } from '../db/db.ts';
import { migrateToLatest } from '../../migrations/migrate.ts';
import { seed } from '../db/seed.ts';
import { createRepositories, type Repositories } from '../db/repositories/index.ts';
import type { Database } from '../db/schema.ts';
import { createConversation } from './createConversation.ts';
import { listConversations } from './listConversations.ts';
import type { Lease, LeaseDocument, LeaseRecord } from '@truelinks/shared';

describe('listConversations', () => {
  let db: Kysely<Database>;
  let repositories: Repositories;

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repositories = createRepositories(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  const dummyField = {
    value: null,
    source: null,
    confidence: 1,
    review: { status: 'pending' as const },
  };

  const dummyRecord: LeaseRecord = {
    landlord: { name: dummyField, signed: dummyField },
    tenant: { name: dummyField, signed: dummyField },
    unit: { unitId: dummyField, label: dummyField, parkingBay: dummyField },
    commencementDate: dummyField,
    expiryDate: dummyField,
    termMonths: dummyField,
    rent: {
      amount: dummyField,
      frequency: dummyField,
      monthly: dummyField,
      annual: dummyField,
    },
    currency: dummyField,
    deposit: dummyField,
    escalation: { text: dummyField, isDefined: dummyField },
    renewal: dummyField,
    termination: dummyField,
  };

  it('returns empty array when no conversations exist', async () => {
    const list = await listConversations({ kind: 'lease' }, repositories);
    expect(list).toEqual([]);
  });

  it('returns draft conversation with open items and filename', async () => {
    const conv = await createConversation({ kind: 'lease', unitId: 'MC-B-1204' }, repositories);

    const doc: LeaseDocument = {
      id: 'doc-1',
      conversationId: conv.id,
      filename: 'test-lease.pdf',
      mimeType: 'application/pdf',
      textSource: 'text',
      clauseSplit: 'headings',
      pageCount: 1,
      clauses: [],
      createdAt: new Date().toISOString(),
    };
    await repositories.documents.create(doc, 'test-lease.pdf');

    const draftLease: Lease = {
      id: 'lease-1',
      conversationId: conv.id,
      unitId: 'MC-B-1204',
      record: dummyRecord,
      flags: [],
      ruleResults: [],
      rulesetVersion: '1.0',
      status: 'draft',
      analysisStatus: 'done',
      overrideReason: null,
      confirmedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repositories.leases.create(draftLease);

    const summaries = await listConversations({ kind: 'lease' }, repositories);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: conv.id,
      kind: 'lease',
      status: 'open',
      unitId: 'MC-B-1204',
      filename: 'test-lease.pdf',
      leaseStatus: 'draft',
      analysisStatus: 'done',
    });
    expect(summaries[0]?.openItems).toBeGreaterThanOrEqual(0);
  });

  it('returns confirmed conversation with confirmed status and sorts newest first', async () => {
    // Conv 1: older draft with document
    const conv1 = await createConversation({ kind: 'lease' }, repositories);
    const doc1: LeaseDocument = {
      id: 'doc-1',
      conversationId: conv1.id,
      filename: 'lease-1.pdf',
      mimeType: 'application/pdf',
      textSource: 'text',
      clauseSplit: 'headings',
      pageCount: 1,
      clauses: [],
      createdAt: new Date().toISOString(),
    };
    await repositories.documents.create(doc1, 'lease-1.pdf');

    // Conv 2: newer confirmed with document
    const conv2 = await createConversation({ kind: 'lease', unitId: 'MC-B-1204' }, repositories);
    const doc2: LeaseDocument = {
      id: 'doc-2',
      conversationId: conv2.id,
      filename: 'lease-2.pdf',
      mimeType: 'application/pdf',
      textSource: 'text',
      clauseSplit: 'headings',
      pageCount: 1,
      clauses: [],
      createdAt: new Date().toISOString(),
    };
    await repositories.documents.create(doc2, 'lease-2.pdf');
    await repositories.conversations.setStatus(conv2.id, 'confirmed');

    const confirmedLease: Lease = {
      id: 'lease-2',
      conversationId: conv2.id,
      unitId: 'MC-B-1204',
      record: dummyRecord,
      flags: [],
      ruleResults: [],
      rulesetVersion: '1.0',
      status: 'confirmed',
      analysisStatus: 'done',
      overrideReason: null,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repositories.leases.create(confirmedLease);

    const summaries = await listConversations({ kind: 'lease' }, repositories);
    expect(summaries).toHaveLength(2);
    // conv2 updated_at was bumped by setStatus so it is newest first
    expect(summaries[0]?.id).toBe(conv2.id);
    expect(summaries[0]?.leaseStatus).toBe('confirmed');
    expect(summaries[1]?.id).toBe(conv1.id);
    expect(summaries[1]?.leaseStatus).toBeNull();
  });

  it('omits conversations that have no documents', async () => {
    // Conversation without document
    await createConversation({ kind: 'lease' }, repositories);

    // Conversation with document
    const convWithDoc = await createConversation({ kind: 'lease' }, repositories);
    const doc: LeaseDocument = {
      id: 'doc-with-file',
      conversationId: convWithDoc.id,
      filename: 'lease-with-file.pdf',
      mimeType: 'application/pdf',
      textSource: 'text',
      clauseSplit: 'headings',
      pageCount: 1,
      clauses: [],
      createdAt: new Date().toISOString(),
    };
    await repositories.documents.create(doc, 'lease-with-file.pdf');

    const summaries = await listConversations({ kind: 'lease' }, repositories);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.id).toBe(convWithDoc.id);
    expect(summaries[0]?.filename).toBe('lease-with-file.pdf');
  });
});
