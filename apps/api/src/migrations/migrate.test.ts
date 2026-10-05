import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type Kysely, sql } from 'kysely';
import { createDb } from '../services/db/db.ts';
import { migrateToLatest } from './migrate.ts';
import type { Database } from '../services/db/schema.ts';

describe('migrateToLatest', () => {
  let db: Kysely<Database>;

  beforeEach(() => {
    db = createDb('file::memory:');
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('runs all migrations successfully on in-memory db', async () => {
    await expect(migrateToLatest(db)).resolves.not.toThrow();

    // Verify all tables were created
    const tables = ['units', 'rulesets', 'conversations', 'messages', 'leases', 'issues', 'work_orders'] as const;
    for (const table of tables) {
      const rows = await db.selectFrom(table).selectAll().execute();
      expect(rows).toEqual([]);
    }

    // Verify migration 004: tool_calls_json column on messages
    const messageColumns = await db
      .selectFrom('messages')
      .select(['id', 'tool_calls_json'])
      .execute();
    expect(messageColumns).toEqual([]);

    // Verify migration 004 indexes
    const indexes = await sql<{ name: string }>`select name from sqlite_master where type = 'index'`.execute(db);
    const indexNames = indexes.rows.map((i) => i.name);
    expect(indexNames).toContain('idx_messages_conversation_created');
    expect(indexNames).toContain('idx_leases_unit');
    expect(indexNames).toContain('idx_issues_unit');
    expect(indexNames).toContain('idx_work_orders_unit');
  });
});
