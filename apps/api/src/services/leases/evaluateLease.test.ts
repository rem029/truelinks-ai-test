import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Kysely } from 'kysely';
import { createDb } from '../../db/db.ts';
import { migrateToLatest } from '../../migrations/migrate.ts';
import { seed } from '../../db/seed.ts';
import { createRepositories, type Repositories } from '../../db/repositories/index.ts';
import type { Database } from '../../db/schema.ts';
import { evaluateLease } from './evaluateLease.ts';
import { sampleLeaseRecords } from './sampleLeaseRecords.ts';

describe('evaluateLease', () => {
  let db: Kysely<Database>;
  let repos: Repositories;

  beforeEach(async () => {
    db = createDb('file::memory:');
    await migrateToLatest(db);
    repos = createRepositories(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('loads ruleset from database, executes evaluation, and returns rulesetVersion', async () => {
    await seed(db);

    const record = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
    const result = await evaluateLease({ record }, repos);

    expect(result.rulesetVersion).toBe('1.0');
    expect(result.unitMatch.status).toBe('matched');
    if (result.unitMatch.status === 'matched') {
      expect(result.unitMatch.unit.unitId).toBe('MC-B-1204');
    }
    expect(result.ruleResults).toHaveLength(7);
    expect(result.ruleResults.every((r) => r.status === 'PASS')).toBe(true);
    expect(result.flags).toHaveLength(0);
  });

  it('throws a clear error when no ruleset is seeded', async () => {
    const record = sampleLeaseRecords['lease-01-clean-MC-B-1204.pdf']!;
    await expect(evaluateLease({ record }, repos)).rejects.toThrow(
      'No ruleset found in database; please ensure migrations and seed have run'
    );
  });
});
