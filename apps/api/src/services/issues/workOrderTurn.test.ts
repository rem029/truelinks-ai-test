import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Kysely } from 'kysely';
import type { Lease, LeaseDocument } from '@truelinks/shared';
import { createDb } from '../../db/db.ts';
import { migrateToLatest } from '../../migrations/migrate.ts';
import { seed } from '../../db/seed.ts';
import { createRepositories, type Repositories } from '../../db/repositories/index.ts';
import type { Database } from '../../db/schema.ts';
import { createStubProvider } from '../agents/modelProvider/stubProvider.ts';
import { sampleLeaseRecords } from '../leases/sampleLeaseRecords.ts';
import { REPO_ROOT } from '../../env.ts';
import { reportIssue } from './reportIssue.ts';
import { runWorkOrderTurn } from './workOrderTurn.ts';
import { applyWorkOrderAction, applyWorkOrderEdit, describeEdit } from './applyWorkOrderAction.ts';

const NOW = new Date().toISOString();

async function addConfirmedLease(repos: Repositories, unitId: string): Promise<Lease> {
  await repos.conversations.create({ id: 'conv-lease', kind: 'lease', unitId, status: 'confirmed', createdAt: NOW, updatedAt: NOW });
  const doc: LeaseDocument = {
    id: 'doc-1',
    conversationId: 'conv-lease',
    filename: 'lease-02-problems-MC-B-0902.pdf',
    mimeType: 'application/pdf',
    textSource: 'text',
    clauseSplit: 'headings',
    pageCount: 1,
    clauses: [{ id: 'c7', heading: '7. Maintenance', text: 'The Tenant is responsible for minor repairs under QAR 500.', pages: null }],
    createdAt: NOW,
  };
  await repos.documents.create(doc, 'lease.pdf');
  const lease: Lease = {
    id: 'lease-1',
    conversationId: 'conv-lease',
    unitId,
    record: sampleLeaseRecords['lease-02-problems-MC-B-0902.pdf']!,
    flags: [],
    ruleResults: [],
    rulesetVersion: '1.0',
    status: 'confirmed',
    analysisStatus: 'done',
    overrideReason: null,
    confirmedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
  return repos.leases.create(lease);
}

describe('work order turn and review', () => {
  let db: Kysely<Database>;
  let repos: Repositories;
  let uploadDir: string;
  const modelProvider = createStubProvider();

  beforeEach(async () => {
    uploadDir = mkdtempSync(join(tmpdir(), 'truelinks-wo-test-'));
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repos = createRepositories(db);
  });

  afterEach(async () => {
    await db.destroy();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  async function reportIssue02() {
    await repos.conversations.create({ id: 'conv-02', kind: 'issue', unitId: 'MC-B-0902', status: 'open', createdAt: NOW, updatedAt: NOW });
    const photos = ['issue-02-tap-drip-1.jpg', 'issue-02-tap-drip-2.jpg'].map((name) => ({
      buffer: readFileSync(resolve(REPO_ROOT, 'data/sample-photos', name)),
      originalName: name,
      mimeType: 'image/jpeg',
    }));
    return reportIssue(
      { conversationId: 'conv-02', reporterRole: 'tenant', photos },
      { repositories: repos, uploadDir, modelProvider }
    );
  }

  it('drafts against the confirmed lease, redrafts on a typed correction, and saves on accept', async () => {
    const lease = await addConfirmedLease(repos, 'MC-B-0902');
    const report = await reportIssue02();
    expect(report.workOrder).toMatchObject({ status: 'draft', leaseId: lease.id, responsibility: 'split' });

    const redraft = await runWorkOrderTurn('conv-02', 'make it high please', { repositories: repos, modelProvider });
    expect(redraft.workOrder?.id).toBe(report.workOrder?.id);
    expect(redraft.workOrder?.severity).toBe('high');
    expect(redraft.messages.map((m) => m.role)).toEqual(['user', 'assistant']);

    const accepted = await applyWorkOrderAction('conv-02', { type: 'accept', cardId: 'workOrder' }, { repositories: repos });
    expect(accepted.workOrder?.status).toBe('accepted');
    expect((await repos.conversations.get('conv-02'))?.status).toBe('confirmed');
    expect(await repos.issues.listWorkOrdersByUnit('MC-B-0902')).toHaveLength(1);

    await expect(
      applyWorkOrderAction('conv-02', { type: 'reject', cardId: 'workOrder' }, { repositories: repos })
    ).rejects.toMatchObject({ status: 409 });
  });

  it('reject keeps the conversation open and shows no card; edit validates the value', async () => {
    await reportIssue02();
    const rejected = await applyWorkOrderAction('conv-02', { type: 'reject', cardId: 'workOrder', reason: 'wrong room' }, { repositories: repos });
    expect(rejected.workOrder?.status).toBe('rejected');
    expect(rejected.messages[1]?.cards).toEqual([]);
    expect((await repos.conversations.get('conv-02'))?.status).toBe('open');

    await expect(
      applyWorkOrderAction('conv-02', { type: 'edit', cardId: 'workOrder', value: { severity: 'urgent' } }, { repositories: repos })
    ).rejects.toMatchObject({ status: 400 });

    const edited = await applyWorkOrderAction('conv-02', { type: 'edit', cardId: 'workOrder', value: { title: 'Sink leak' } }, { repositories: repos });
    expect(edited.workOrder).toMatchObject({ title: 'Sink leak', status: 'draft' });
  });
});

describe('applyWorkOrderEdit', () => {
  it("drops the quoted clause when the owner changes the responsible party", () => {
    const workOrder = {
      id: 'wo-1',
      issueId: 'iss-1',
      unitId: 'MC-B-0902',
      title: 'Leak',
      description: 'Drain leaks',
      category: 'plumbing',
      severity: 'medium' as const,
      urgent: false,
      responsibility: 'tenant' as const,
      responsibilityReason: 'Minor repair',
      responsibilityClause: { clauseId: 'c7', heading: '7. Maintenance', quote: 'minor repairs' },
      leaseId: 'lease-1',
      status: 'draft' as const,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const edited = applyWorkOrderEdit(workOrder, { responsibility: 'landlord' }, NOW);
    expect(edited.responsibilityClause).toBeNull();
    expect(edited.responsibilityReason).toBe('Set by the owner');
    expect(applyWorkOrderEdit(workOrder, { title: 'Drain leak' }, NOW).responsibilityClause).not.toBeNull();
  });

  it('describes an edit in the user message', () => {
    expect(describeEdit({ severity: 'high', urgent: true })).toBe('Changed severity to high, marked urgent');
    expect(describeEdit({ description: 'long text' })).toBe('Changed the description');
  });
});
