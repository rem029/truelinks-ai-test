import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Kysely } from 'kysely';
import { createDb } from '../db.js';
import { migrateToLatest } from './migrate.js';
import type { Database } from '../schema.js';

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
  });
});
