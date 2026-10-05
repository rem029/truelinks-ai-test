import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Kysely } from 'kysely';
import { createDb } from '../../../db/db.ts';
import { migrateToLatest } from '../../../migrations/migrate.ts';
import { seed } from '../../../db/seed.ts';
import { createRepositories, type Repositories } from '../../../db/repositories/index.ts';
import type { Database } from '../../../db/schema.ts';
import { createStubProvider } from '../../agents/modelProvider/stubProvider.ts';
import { createConversation } from '../../conversations/createConversation.ts';
import { ingestLease } from '../ingest/ingestLease.ts';
import { extractLease } from '../extract/extractLease.ts';
import { createLeaseTools, type LeaseTurnState } from './leaseTools.ts';
import { acceptField } from './patchRecord.ts';
import { getField } from '../leaseFields.ts';

const sampleLeasesDir = resolve(import.meta.dirname, '../../../../../../data/sample-leases');

describe('leaseTools', () => {
  let db: Kysely<Database>;
  let repositories: Repositories;
  let uploadDir: string;
  const modelProvider = createStubProvider();

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    await seed(db);
    repositories = createRepositories(db);
    uploadDir = mkdtempSync(join(tmpdir(), 'lease-tools-test-'));
  });

  afterEach(async () => {
    await db.destroy();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  async function setupLease01() {
    const conversation = await createConversation({ kind: 'lease' }, repositories);
    const filename = 'lease-01-clean-MC-B-1204.pdf';
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

  it('search_clauses finds the rent clause in lease-01', async () => {
    const { document, lease } = await setupLease01();
    const state: LeaseTurnState = {
      lease: { ...lease },
      document,
      messageId: 'msg-1',
    };
    const tools = createLeaseTools(state, { repositories });
    const searchTool = tools.find((t) => t.name === 'search_clauses')!;
    expect(searchTool).toBeDefined();

    const result = await searchTool.run({ query: 'monthly rent amount' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const clauses = result.result as Array<{ id: string; heading: string; text: string }>;
      expect(clauses.length).toBeGreaterThan(0);
      const rentClause = clauses.find((c) => c.id === '2');
      expect(rentClause).toBeDefined();
      expect(rentClause?.heading.toLowerCase()).toContain('rent');
    }
  });

  it('update_field returns error for invalid path or invalid value', async () => {
    const { document, lease } = await setupLease01();
    const state: LeaseTurnState = {
      lease: { ...lease },
      document,
      messageId: 'msg-1',
    };
    const tools = createLeaseTools(state, { repositories });
    const updateTool = tools.find((t) => t.name === 'update_field')!;

    // Invalid field path
    const badPathRes = await updateTool.run({ fieldPath: 'invalid.path', value: '1000' });
    expect(badPathRes.ok).toBe(false);

    // Invalid value for number field
    const badValRes = await updateTool.run({ fieldPath: 'rent.amount', value: 'not-a-number' });
    expect(badValRes.ok).toBe(false);

    // Valid string value parses and updates
    const goodRes = await updateTool.run({ fieldPath: 'rent.amount', value: '8500' });
    expect(goodRes.ok).toBe(true);
    expect(getField(state.lease.record, 'rent.amount').value).toBe(8500);
  });

  it('update_field only sets the unit ID to one of the owner\'s units', async () => {
    const { document, lease } = await setupLease01();
    const state: LeaseTurnState = { lease: { ...lease }, document, messageId: 'msg-1' };
    const updateTool = createLeaseTools(state, { repositories }).find((t) => t.name === 'update_field')!;

    const unknown = await updateTool.run({ fieldPath: 'unit.unitId', value: 'Apartment 1204' });
    expect(unknown).toMatchObject({ ok: false });
    expect(unknown.ok ? '' : unknown.error).toContain('find_unit');

    const known = await updateTool.run({ fieldPath: 'unit.unitId', value: 'MC-B-1205' });
    expect(known.ok).toBe(true);
    expect(getField(state.lease.record, 'unit.unitId').value).toBe('MC-B-1205');
  });

  it('update_field refuses locked field and leaves it unchanged', async () => {
    const { document, lease } = await setupLease01();
    const lockedRecord = acceptField(lease.record, 'rent.amount', new Date().toISOString());
    const initialRent = getField(lockedRecord, 'rent.amount').value;

    const state: LeaseTurnState = {
      lease: { ...lease, record: lockedRecord },
      document,
      messageId: 'msg-1',
    };
    const tools = createLeaseTools(state, { repositories });
    const updateTool = tools.find((t) => t.name === 'update_field')!;

    const result = await updateTool.run({ fieldPath: 'rent.amount', value: '12000' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('already accepted by the owner');
    }

    expect(getField(state.lease.record, 'rent.amount').value).toBe(initialRent);
  });

  it('find_unit finds matching units by label', async () => {
    const { document, lease } = await setupLease01();
    const state: LeaseTurnState = {
      lease: { ...lease },
      document,
      messageId: 'msg-1',
    };
    const tools = createLeaseTools(state, { repositories });
    const findTool = tools.find((t) => t.name === 'find_unit')!;

    const result = await findTool.run({ query: 'Apartment 1204' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const units = result.result as Array<{ unitId: string; label: string; status: string }>;
      expect(units.length).toBeGreaterThan(0);
      expect(units.some((u) => u.unitId === 'MC-B-1204')).toBe(true);
    }
  });
});
