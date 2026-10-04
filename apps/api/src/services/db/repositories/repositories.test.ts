import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Kysely } from 'kysely';
import {
  type Conversation,
  type Message,
  type Lease,
  type Issue,
  type WorkOrder,
  type Ruleset,
  type LeaseDocument,
} from '@truelinks/shared';

import { createDb } from '../db.ts';
import { migrateToLatest } from '../../../migrations/migrate.ts';
import { seed } from '../seed.ts';
import { createRepositories, type Repositories } from './index.ts';
import type { Database } from '../schema.ts';

describe('Repositories round-trip with JSON column boundary parsing', () => {
  let db: Kysely<Database>;
  let repos: Repositories;

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repos = createRepositories(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('UnitRepository: list, get, setStatus, and error on missing unit', async () => {
    const units = await repos.units.list();
    expect(units).toHaveLength(5);

    const unit = await repos.units.get('MC-B-1204');
    expect(unit).not.toBeNull();
    expect(unit?.label).toBe('Apartment 1204');
    expect(unit?.status).toBe('available');

    const updated = await repos.units.setStatus('MC-B-1204', 'occupied');
    expect(updated.status).toBe('occupied');

    const reFetched = await repos.units.get('MC-B-1204');
    expect(reFetched?.status).toBe('occupied');

    await expect(repos.units.setStatus('NON_EXISTENT', 'occupied')).rejects.toThrow(
      'Unit NON_EXISTENT not found'
    );
  });

  it('RulesetRepository: create, get, and getLatest with tie-break ordering', async () => {
    const latest = await repos.rulesets.getLatest();
    expect(latest).not.toBeNull();
    expect(latest?.version).toBe('1.0');
    expect(latest?.rules.length).toBeGreaterThan(0);

    const byVersion = await repos.rulesets.get('1.0');
    expect(byVersion?.name).toBe(latest?.name);

    const customRulesetV2: Ruleset = {
      name: 'Custom Standards 2.0',
      version: '2.0',
      rules: [
        {
          id: 'R10',
          description: 'Custom rule 10',
          check: 'deposit > 0',
          severity: 'high',
        },
      ],
    };

    await repos.rulesets.create(customRulesetV2);
    const fetchedLatest = await repos.rulesets.getLatest();
    expect(fetchedLatest?.version).toBe('2.0');
  });

  it('ConversationRepository: create, get, addMessage, listMessages, and setStatus', async () => {
    const conversation: Conversation = {
      id: 'conv-101',
      kind: 'lease',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: '2026-10-04T12:00:00.000Z',
      updatedAt: '2026-10-04T12:00:00.000Z',
    };

    await repos.conversations.create(conversation);
    const fetched = await repos.conversations.get('conv-101');
    expect(fetched).toEqual(conversation);

    const message: Message = {
      id: 'msg-1',
      conversationId: 'conv-101',
      role: 'assistant',
      text: 'Lease parsed with 1 flag',
      cards: [
        {
          id: 'card-1',
          type: 'flag',
          flag: {
            id: 'fl-1',
            code: 'TENANT_SIGNATURE_MISSING',
            severity: 'high',
            message: 'Tenant signature is missing',
            fieldPaths: ['tenant.signed'],
            clauseIds: ['clause-12'],
            reviewStatus: 'open',
          },
        },
      ],
      attachments: [
        {
          id: 'att-1',
          filename: 'lease.pdf',
          mimeType: 'application/pdf',
        },
      ],
      createdAt: '2026-10-04T12:01:00.000Z',
    };

    await repos.conversations.addMessage(message);
    const messages = await repos.conversations.listMessages('conv-101');
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(message);
    expect(messages[0]?.cards[0]?.type).toBe('flag');

    const updated = await repos.conversations.setStatus('conv-101', 'confirmed');
    expect(updated.status).toBe('confirmed');

    await expect(repos.conversations.setStatus('NON_EXISTENT', 'confirmed')).rejects.toThrow(
      'Conversation NON_EXISTENT not found'
    );
  });

  it('LeaseRepository: create, get, getByConversation, listByUnit, update, and fail loudly', async () => {
    const conversation: Conversation = {
      id: 'conv-202',
      kind: 'lease',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: '2026-10-04T12:00:00.000Z',
      updatedAt: '2026-10-04T12:00:00.000Z',
    };
    await repos.conversations.create(conversation);

    const lease: Lease = {
      id: 'lease-1',
      conversationId: 'conv-202',
      unitId: 'MC-B-1204',
      record: {
        landlord: {
          name: { value: 'Marina Crest Holdings', source: null, confidence: 1, review: { status: 'accepted' } },
          signed: { value: true, source: null, confidence: 1, review: { status: 'accepted' } },
        },
        tenant: {
          name: { value: 'John Smith', source: null, confidence: 1, review: { status: 'accepted' } },
          signed: { value: true, source: null, confidence: 1, review: { status: 'accepted' } },
        },
        unit: {
          unitId: { value: 'MC-B-1204', source: null, confidence: 1, review: { status: 'accepted' } },
          label: { value: 'Apartment 1204', source: null, confidence: 1, review: { status: 'accepted' } },
          parkingBay: { value: 'B-77', source: null, confidence: 1, review: { status: 'accepted' } },
        },
        commencementDate: { value: '2026-11-01', source: null, confidence: 1, review: { status: 'accepted' } },
        expiryDate: { value: '2027-10-31', source: null, confidence: 1, review: { status: 'accepted' } },
        termMonths: { value: 12, source: null, confidence: 1, review: { status: 'accepted' } },
        rent: {
          amount: { value: 8500, source: null, confidence: 1, review: { status: 'accepted' } },
          frequency: { value: 'monthly', source: null, confidence: 1, review: { status: 'accepted' } },
          monthly: { value: 8500, source: null, confidence: 1, review: { status: 'accepted' } },
          annual: { value: 102000, source: null, confidence: 1, review: { status: 'accepted' } },
        },
        currency: { value: 'QAR', source: null, confidence: 1, review: { status: 'accepted' } },
        deposit: { value: 8500, source: null, confidence: 1, review: { status: 'accepted' } },
        escalation: {
          text: { value: '5% annually', source: null, confidence: 1, review: { status: 'accepted' } },
          isDefined: { value: true, source: null, confidence: 1, review: { status: 'accepted' } },
        },
        renewal: { value: '60 days notice', source: null, confidence: 1, review: { status: 'accepted' } },
        termination: { value: '30 days notice', source: null, confidence: 1, review: { status: 'accepted' } },
      },
      flags: [
        {
          id: 'flg-1',
          code: 'TEST_FLAG',
          severity: 'low',
          message: 'Flag message',
          fieldPaths: ['deposit'],
          clauseIds: ['clause-3'],
          reviewStatus: 'open',
        },
      ],
      ruleResults: [
        {
          ruleId: 'R1',
          status: 'PASS',
          reason: 'Deposit meets monthly rent',
          clauseIds: ['clause-3'],
          severity: 'high',
          rulesetVersion: '1.0',
        },
      ],
      rulesetVersion: '1.0',
      status: 'draft',
      analysisStatus: 'done',
      overrideReason: null,
      confirmedAt: null,
      createdAt: '2026-10-04T12:00:00.000Z',
      updatedAt: '2026-10-04T12:00:00.000Z',
    };

    await repos.leases.create(lease);

    const byId = await repos.leases.get('lease-1');
    expect(byId).toEqual(lease);

    const byConv = await repos.leases.getByConversation('conv-202');
    expect(byConv).toEqual(lease);

    const byUnit = await repos.leases.listByUnit('MC-B-1204');
    expect(byUnit).toHaveLength(1);
    expect(byUnit[0]).toEqual(lease);

    const updatedLease: Lease = {
      ...lease,
      status: 'confirmed',
      confirmedAt: '2026-10-04T12:30:00.000Z',
      updatedAt: '2026-10-04T12:30:00.000Z',
    };
    await repos.leases.update(updatedLease);

    const reFetched = await repos.leases.get('lease-1');
    expect(reFetched?.status).toBe('confirmed');
    expect(reFetched?.confirmedAt).toBe('2026-10-04T12:30:00.000Z');

    const nonExistentLease: Lease = {
      ...lease,
      id: 'NON_EXISTENT',
    };
    await expect(repos.leases.update(nonExistentLease)).rejects.toThrow('Lease NON_EXISTENT not found');
  });

  it('IssueRepository: createIssue, getIssue, listByUnit, createWorkOrder, getWorkOrder, updateWorkOrder, and fail loudly', async () => {
    const conversation: Conversation = {
      id: 'conv-303',
      kind: 'issue',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: '2026-10-04T14:00:00.000Z',
      updatedAt: '2026-10-04T14:00:00.000Z',
    };
    await repos.conversations.create(conversation);

    const issue: Issue = {
      id: 'iss-1',
      unitId: 'MC-B-1204',
      conversationId: 'conv-303',
      reporterRole: 'tenant',
      note: 'Water dripping from AC',
      photos: [
        {
          id: 'photo-1',
          filename: 'issue-01-ac-leak-1.jpg',
          condition: 'damaged',
          damages: ['water stain down wall'],
          equipment: ['split AC (wall-mounted)'],
        },
      ],
      createdAt: '2026-10-04T14:00:00.000Z',
    };

    await repos.issues.createIssue(issue);
    const fetchedIssue = await repos.issues.getIssue('iss-1');
    expect(fetchedIssue).toEqual(issue);

    const issuesByUnit = await repos.issues.listByUnit('MC-B-1204');
    expect(issuesByUnit).toHaveLength(1);
    expect(issuesByUnit[0]?.photos[0]?.condition).toBe('damaged');

    const workOrder: WorkOrder = {
      id: 'wo-1',
      issueId: 'iss-1',
      unitId: 'MC-B-1204',
      title: 'AC leaking water',
      description: 'Split AC leaking water down wall',
      category: 'HVAC',
      severity: 'medium',
      urgent: false,
      responsibility: 'landlord (lease 01 clause 7)',
      status: 'draft',
      createdAt: '2026-10-04T14:05:00.000Z',
    };

    await repos.issues.createWorkOrder(workOrder);
    const fetchedWo = await repos.issues.getWorkOrder('wo-1');
    expect(fetchedWo).toEqual(workOrder);

    const updatedWo: WorkOrder = {
      ...workOrder,
      status: 'accepted',
      urgent: true,
    };
    await repos.issues.updateWorkOrder(updatedWo);

    const reFetchedWo = await repos.issues.getWorkOrder('wo-1');
    expect(reFetchedWo?.status).toBe('accepted');
    expect(reFetchedWo?.urgent).toBe(true);

    const woList = await repos.issues.listWorkOrdersByUnit('MC-B-1204');
    expect(woList).toHaveLength(1);
    expect(woList[0]?.id).toBe('wo-1');

    const nonExistentWo: WorkOrder = {
      ...workOrder,
      id: 'NON_EXISTENT',
    };
    await expect(repos.issues.updateWorkOrder(nonExistentWo)).rejects.toThrow(
      'WorkOrder NON_EXISTENT not found'
    );
  });

  it('DocumentRepository: create, get, and listByConversation', async () => {
    const conv: Conversation = {
      id: 'conv-doc-1',
      kind: 'lease',
      unitId: 'MC-B-1204',
      status: 'open',
      createdAt: '2026-10-04T12:00:00.000Z',
      updatedAt: '2026-10-04T12:00:00.000Z',
    };
    await repos.conversations.create(conv);

    const doc: LeaseDocument = {
      id: 'doc-1',
      conversationId: 'conv-doc-1',
      filename: 'lease.pdf',
      mimeType: 'application/pdf',
      textSource: 'text',
      clauseSplit: 'headings',
      pageCount: 3,
      clauses: [
        {
          id: 'preamble',
          heading: 'Preamble',
          text: 'Lease Agreement',
          pages: { start: 1, end: 1 },
        },
        {
          id: '1',
          heading: 'Term',
          text: '12 months',
          pages: { start: 1, end: 2 },
        },
      ],
      createdAt: '2026-10-04T12:00:00.000Z',
    };

    await repos.documents.create(doc, 'doc-1.pdf');

    const fetched = await repos.documents.get('doc-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.filePath).toBe('doc-1.pdf');
    expect(fetched?.document).toEqual(doc);

    const missing = await repos.documents.get('doc-unknown');
    expect(missing).toBeNull();

    const list = await repos.documents.listByConversation('conv-doc-1');
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(doc);

    const emptyList = await repos.documents.listByConversation('conv-other');
    expect(emptyList).toEqual([]);
  });
});

