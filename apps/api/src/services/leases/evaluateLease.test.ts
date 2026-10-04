import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Kysely } from 'kysely';
import { createDb } from '../db/db.js';
import { migrateToLatest } from '../db/migrations/migrate.js';
import { seed } from '../db/seed.js';
import { createRepositories, type Repositories } from '../db/repositories/index.js';
import type { Database } from '../db/schema.js';
import { evaluateLease } from './evaluateLease.js';
import { sampleLeaseRecords } from './sampleLeaseRecords.js';

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
