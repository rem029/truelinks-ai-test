import type { Kysely } from 'kysely';
import { Lease } from '@truelinks/shared';
import type { Database, LeasesTable } from '../schema.ts';

export interface LeaseRepository {
  create(lease: Lease): Promise<Lease>;
  get(id: string): Promise<Lease | null>;
  getByConversation(conversationId: string): Promise<Lease | null>;
  listByUnit(unitId: string): Promise<Lease[]>;
  update(lease: Lease): Promise<Lease>;
  delete(id: string): Promise<void>;
}

function toDomain(row: LeasesTable): Lease {
  return Lease.parse({
    id: row.id,
    conversationId: row.conversation_id,
    unitId: row.unit_id,
    record: JSON.parse(row.record_json),
    flags: JSON.parse(row.flags_json),
    ruleResults: JSON.parse(row.rule_results_json),
    rulesetVersion: row.ruleset_version,
    status: row.status,
    analysisStatus: row.analysis_status,
    overrideReason: row.override_reason,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function toRow(lease: Lease): LeasesTable {
  return {
    id: lease.id,
    conversation_id: lease.conversationId,
    unit_id: lease.unitId,
    record_json: JSON.stringify(lease.record),
    flags_json: JSON.stringify(lease.flags),
    rule_results_json: JSON.stringify(lease.ruleResults),
    ruleset_version: lease.rulesetVersion,
    status: lease.status,
    analysis_status: lease.analysisStatus,
    override_reason: lease.overrideReason,
    confirmed_at: lease.confirmedAt,
    created_at: lease.createdAt,
    updated_at: lease.updatedAt,
  };
}

export function createLeaseRepository(db: Kysely<Database>): LeaseRepository {
  return {
    async create(lease: Lease): Promise<Lease> {
      await db.insertInto('leases').values(toRow(lease)).execute();
      return lease;
    },

    async get(id: string): Promise<Lease | null> {
      const row = await db.selectFrom('leases').selectAll().where('id', '=', id).executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async getByConversation(conversationId: string): Promise<Lease | null> {
      const row = await db
        .selectFrom('leases')
        .selectAll()
        .where('conversation_id', '=', conversationId)
        .executeTakeFirst();
      return row ? toDomain(row) : null;
    },

    async listByUnit(unitId: string): Promise<Lease[]> {
      const rows = await db
        .selectFrom('leases')
        .selectAll()
        .where('unit_id', '=', unitId)
        .orderBy('created_at', 'desc')
        .execute();
      return rows.map(toDomain);
    },

    async update(lease: Lease): Promise<Lease> {
      const row = toRow(lease);
      const updated = await db
        .updateTable('leases')
        .set({
          unit_id: row.unit_id,
          record_json: row.record_json,
          flags_json: row.flags_json,
          rule_results_json: row.rule_results_json,
          ruleset_version: row.ruleset_version,
          status: row.status,
          analysis_status: row.analysis_status,
          override_reason: row.override_reason,
          confirmed_at: row.confirmed_at,
          updated_at: row.updated_at,
        })
        .where('id', '=', row.id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        throw new Error(`Lease ${lease.id} not found`);
      }

      return toDomain(updated);
    },

    async delete(id: string): Promise<void> {
      await db.deleteFrom('leases').where('id', '=', id).execute();
    },
  };
}
