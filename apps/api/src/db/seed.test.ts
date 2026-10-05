import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Kysely } from 'kysely';
import { createDb } from './db.ts';
import { migrateToLatest } from '../migrations/migrate.ts';
import { seed } from './seed.ts';
import type { Database } from './schema.ts';

describe('seed', () => {
  let db: Kysely<Database>;

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('is idempotent: running twice inserts 0 rows on the second pass and retains 5 units', async () => {
    const first = await seed(db);
    expect(first.unitsInserted).toBe(5);
    expect(first.rulesetInserted).toBe(1);

    const unitsCount1 = await db.selectFrom('units').select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();
    expect(Number(unitsCount1.count)).toBe(5);

    const second = await seed(db);
    expect(second.unitsInserted).toBe(0);
    expect(second.rulesetInserted).toBe(0);

    const unitsCount2 = await db.selectFrom('units').select(db.fn.countAll().as('count')).executeTakeFirstOrThrow();
    expect(Number(unitsCount2.count)).toBe(5);
  });

  it('does not overwrite unit occupancy status when re-seeded', async () => {
    await seed(db);

    // Initial status of MC-B-0902 in data/units.json is 'available'
    const initialUnit = await db
      .selectFrom('units')
      .selectAll()
      .where('unit_id', '=', 'MC-B-0902')
      .executeTakeFirstOrThrow();
    expect(initialUnit.status).toBe('available');

    // Simulate confirming a lease and changing status to 'occupied'
    await db
      .updateTable('units')
      .set({ status: 'occupied' })
      .where('unit_id', '=', 'MC-B-0902')
      .execute();

    // Re-run seed
    await seed(db);

    // Status should still be 'occupied'
    const updatedUnit = await db
      .selectFrom('units')
      .selectAll()
      .where('unit_id', '=', 'MC-B-0902')
      .executeTakeFirstOrThrow();
    expect(updatedUnit.status).toBe('occupied');
  });
});
